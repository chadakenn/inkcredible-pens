/** Permanent paid-order artwork archive, intended for a dedicated LXC mount. */
import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import multer from 'multer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAdmin } from './adminAuth.mjs'
import { createRateLimiter, detectImageType } from './security.mjs'
import { sanitizeSvgBuffer } from './svg-artwork.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMP_ARTWORK_DIR = path.resolve(__dirname, '../uploads/custom')
export const CUSTOMER_FILES_DIR = path.resolve(
  process.env.CUSTOMER_FILES_DIR || path.resolve(__dirname, '../data/customer-files'),
)

mkdirSync(CUSTOMER_FILES_DIR, { recursive: true })

const MAX_MANAGER_FILE_BYTES = 25 * 1024 * 1024
const managerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MANAGER_FILE_BYTES },
})
const managerUploadLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  name: 'customer-files',
})

function safePart(value, fallback) {
  return String(value || fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._ -]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || fallback
}

function archivedUrl(year, month, orderCode, filename) {
  return `/api/admin/customer-files/${year}/${month}/${orderCode}/${filename}`
}

function isPdf(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-'
}

function walkFiles(dir, relative = '', result = []) {
  if (!existsSync(dir) || result.length >= 5000) return result
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const nextRelative = relative ? `${relative}/${entry.name}` : entry.name
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(absolute, nextRelative, result)
    else if (entry.isFile()) {
      const info = statSync(absolute)
      result.push({
        path: nextRelative,
        name: entry.name,
        folder: relative,
        size: info.size,
        modifiedAt: info.mtime.toISOString(),
        previewable: /\.(?:jpe?g|png|webp|gif)$/i.test(entry.name),
      })
    }
    if (result.length >= 5000) break
  }
  return result
}

function resolveManagerFile(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const absolute = path.resolve(CUSTOMER_FILES_DIR, normalized)
  if (!normalized || absolute === CUSTOMER_FILES_DIR || !absolute.startsWith(`${CUSTOMER_FILES_DIR}${path.sep}`)) return null
  return { normalized, absolute }
}

function managerFileUrl(relativePath) {
  return `/api/admin/customer-files/file?path=${encodeURIComponent(relativePath)}`
}

/** Copy referenced temporary artwork into a durable YYYY/MM/order-code folder. */
export function archivePaidOrderArtwork(items, { displayCode, createdAt, customerName }) {
  const date = new Date(createdAt)
  const year = String(date.getUTCFullYear())
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const orderCode = safePart(displayCode, 'order')
  const customer = safePart(customerName, 'Customer')
  const customerOrder = `${customer}_${orderCode}`
  const orderDir = path.join(CUSTOMER_FILES_DIR, year, month, customerOrder)

  return items.map((item, index) => {
    const custom = item?.custom
    if (!custom || typeof custom !== 'object') return item
    const sourceName = path.basename(String(custom.artworkId || ''))
    if (!/^[a-f0-9-]{36}\.(?:jpe?g|png|webp|gif|svg)$/i.test(sourceName)) return item
    const source = path.join(TEMP_ARTWORK_DIR, sourceName)
    if (!existsSync(source)) return item

    try {
      mkdirSync(orderDir, { recursive: true })
      const ext = path.extname(sourceName).toLowerCase()
      const originalStem = path.basename(String(custom.artworkFileName || 'artwork'), path.extname(String(custom.artworkFileName || '')))
      const filename = `${String(index + 1).padStart(2, '0')}-${safePart(originalStem, 'artwork')}-${sourceName.slice(0, 8)}${ext}`
      const destination = path.join(orderDir, filename)
      if (!existsSync(destination)) copyFileSync(source, destination)
      const archivedCustom = {
        ...custom,
          artworkUrl: archivedUrl(year, month, customerOrder, filename),
          archivedArtworkPath: `${year}/${month}/${customerOrder}/${filename}`,
      }
      // The paid order now points at the durable copy; let retention remove the temporary UUID.
      delete archivedCustom.artworkId
      return {
        ...item,
        custom: archivedCustom,
      }
    } catch (error) {
      console.error('[customer-files] archive failed', displayCode, sourceName, error)
      return item
    }
  })
}

/** Admin-only download route used by Store Manager order records. */
export function mountCustomerFiles(app) {
  app.get('/api/admin/customer-files', requireAdmin, (_req, res) => {
    try {
      const files = walkFiles(CUSTOMER_FILES_DIR)
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
        .map((file) => ({ ...file, url: managerFileUrl(file.path) }))
      return res.json({ files })
    } catch (error) {
      console.error('[customer-files] list failed', error)
      return res.status(500).json({ error: 'list_failed' })
    }
  })

  app.post('/api/admin/customer-files', requireAdmin, managerUploadLimit, (req, res) => {
    managerUpload.single('file')(req, res, (uploadError) => {
      if (uploadError) {
        const tooLarge = uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE'
        return res.status(tooLarge ? 400 : 500).json({ error: tooLarge ? 'file_too_large' : 'upload_failed' })
      }
      if (!req.file?.buffer) return res.status(400).json({ error: 'missing_file' })
      try {
        const originalName = path.basename(String(req.file.originalname || 'artwork'))
        const requestedSvg = req.file.mimetype === 'image/svg+xml' || /\.svg$/i.test(originalName)
        let contents = req.file.buffer
        let ext = ''
        let previewable = false
        if (requestedSvg) {
          contents = sanitizeSvgBuffer(contents)
          ext = '.svg'
        } else {
          const image = detectImageType(contents)
          if (image) {
            ext = image.ext
            previewable = true
          } else if (isPdf(contents)) {
            ext = '.pdf'
          } else {
            return res.status(400).json({ error: 'invalid_type' })
          }
        }

        const now = new Date()
        const year = String(now.getUTCFullYear())
        const month = String(now.getUTCMonth() + 1).padStart(2, '0')
        const customer = safePart(req.body?.customerName, 'Unsorted')
        const job = safePart(req.body?.jobName, 'Manual-Upload')
        const folder = `${customer}_MANUAL-${job}`
        const targetDir = path.join(CUSTOMER_FILES_DIR, year, month, folder)
        mkdirSync(targetDir, { recursive: true })
        const stem = safePart(path.basename(originalName, path.extname(originalName)), 'artwork')
        const filename = `${stem}-${randomUUID().slice(0, 8)}${ext}`
        const destination = path.join(targetDir, filename)
        const temporary = `${destination}.${process.pid}.tmp`
        writeFileSync(temporary, contents, { mode: 0o640 })
        renameSync(temporary, destination)
        const relativePath = `${year}/${month}/${folder}/${filename}`
        return res.status(201).json({
          file: {
            path: relativePath,
            name: filename,
            folder: `${year}/${month}/${folder}`,
            size: contents.length,
            modifiedAt: now.toISOString(),
            previewable,
            url: managerFileUrl(relativePath),
          },
        })
      } catch (error) {
        if (error?.code === 'invalid_svg' || error?.code === 'unsafe_svg') return res.status(400).json({ error: 'invalid_type' })
        console.error('[customer-files] manager upload failed', error)
        return res.status(500).json({ error: 'upload_failed' })
      }
    })
  })

  app.get('/api/admin/customer-files/file', requireAdmin, (req, res) => {
    const resolved = resolveManagerFile(req.query.path)
    if (!resolved) return res.status(400).send('Bad request')
    if (!existsSync(resolved.absolute) || !statSync(resolved.absolute).isFile()) return res.status(404).send('Not found')
    const name = path.basename(resolved.absolute)
    const detected = detectImageType(readFileSync(resolved.absolute))
    if (detected) res.type(detected.mime)
    else if (/\.pdf$/i.test(name)) res.type('application/pdf')
    else if (/\.svg$/i.test(name)) {
      res.type('image/svg+xml')
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
      res.setHeader('X-Content-Type-Options', 'nosniff')
    }
    if (String(req.query.download) === '1' || /\.svg$/i.test(name)) {
      res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120)}"`)
    }
    return res.sendFile(resolved.absolute)
  })

  app.get('/api/admin/customer-files/:year/:month/:order/:name', requireAdmin, (req, res) => {
    const year = safePart(req.params.year, '')
    const month = safePart(req.params.month, '')
    const order = safePart(req.params.order, '')
    const name = path.basename(String(req.params.name || ''))
    if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !order || !name) {
      return res.status(400).send('Bad request')
    }
    const filePath = path.join(CUSTOMER_FILES_DIR, year, month, order, name)
    if (!existsSync(filePath)) return res.status(404).send('Not found')

    const detected = detectImageType(readFileSync(filePath))
    if (detected) res.type(detected.mime)
    if (/\.svg$/i.test(name)) {
      res.type('image/svg+xml')
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
      res.setHeader('X-Content-Type-Options', 'nosniff')
    }
    const original = String(req.query.filename || name).replace(/[^\w.\-()+ ]+/g, '_')
    res.setHeader('Content-Disposition', `attachment; filename="${original.slice(0, 120)}"`)
    return res.sendFile(filePath)
  })
}
