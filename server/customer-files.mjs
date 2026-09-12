/** Permanent paid-order artwork archive, intended for a dedicated LXC mount. */
import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
const RECYCLE_DIR = path.join(CUSTOMER_FILES_DIR, '.recycle-bin')
mkdirSync(RECYCLE_DIR, { recursive: true })

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
        manual: nextRelative.split('/').some((part) => part.includes('_MANUAL-')),
      })
    }
    if (result.length >= 5000) break
  }
  return result
}

function listRecycledFiles() {
  const result = []
  for (const entry of readdirSync(RECYCLE_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9-]{36}$/i.test(entry.name)) continue
    try {
      const dir = path.join(RECYCLE_DIR, entry.name)
      const metadata = JSON.parse(readFileSync(path.join(dir, 'metadata.json'), 'utf8'))
      const stored = path.join(dir, 'file')
      if (!statSync(stored).isFile()) continue
      const info = statSync(stored)
      result.push({
        id: entry.name,
        name: String(metadata.name || 'file'),
        originalPath: String(metadata.originalPath || ''),
        deletedAt: String(metadata.deletedAt || info.mtime.toISOString()),
        size: info.size,
      })
    } catch {
      // Ignore incomplete recycle entries instead of breaking the manager page.
    }
  }
  return result.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
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

function assertManualFile(relativePath) {
  const resolved = resolveManagerFile(relativePath)
  if (!resolved) throw Object.assign(new Error('invalid_path'), { code: 'invalid_path' })
  if (!resolved.normalized.split('/').some((part) => part.includes('_MANUAL-'))) {
    throw Object.assign(new Error('order_file_locked'), { code: 'order_file_locked' })
  }
  if (!existsSync(resolved.absolute) || !statSync(resolved.absolute).isFile()) {
    throw Object.assign(new Error('not_found'), { code: 'not_found' })
  }
  return resolved
}

function uniqueDestination(dir, filename, currentPath = null) {
  let destination = path.join(dir, filename)
  if (currentPath && destination === currentPath) return destination
  if (!existsSync(destination)) return destination
  const ext = path.extname(filename)
  const stem = path.basename(filename, ext)
  destination = path.join(dir, `${stem}-${randomUUID().slice(0, 8)}${ext}`)
  return destination
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
      return res.json({ files, recycled: listRecycledFiles() })
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

  app.patch('/api/admin/customer-files/file', requireAdmin, (req, res) => {
    try {
      const source = assertManualFile(req.body?.path)
      const parts = source.normalized.split('/')
      if (parts.length < 4 || !/^\d{4}$/.test(parts[0]) || !/^\d{2}$/.test(parts[1])) {
        return res.status(400).json({ error: 'invalid_path' })
      }
      const customer = safePart(req.body?.customerName, 'Unsorted')
      const job = safePart(req.body?.jobName, 'Manual-Upload')
      const destinationDir = path.join(CUSTOMER_FILES_DIR, parts[0], parts[1], `${customer}_MANUAL-${job}`)
      mkdirSync(destinationDir, { recursive: true })
      const currentExt = path.extname(source.absolute).toLowerCase()
      const requestedStem = safePart(path.basename(String(req.body?.fileName || path.basename(source.absolute)), path.extname(String(req.body?.fileName || ''))), 'artwork')
      const destination = uniqueDestination(destinationDir, `${requestedStem}${currentExt}`, source.absolute)
      if (destination !== source.absolute) renameSync(source.absolute, destination)
      const relativePath = path.relative(CUSTOMER_FILES_DIR, destination).split(path.sep).join('/')
      const info = statSync(destination)
      return res.json({
        file: {
          path: relativePath,
          name: path.basename(destination),
          folder: path.dirname(relativePath).split(path.sep).join('/'),
          size: info.size,
          modifiedAt: info.mtime.toISOString(),
          previewable: /\.(?:jpe?g|png|webp|gif)$/i.test(destination),
          manual: true,
          url: managerFileUrl(relativePath),
        },
      })
    } catch (error) {
      const code = error?.code || 'update_failed'
      return res.status(code === 'not_found' ? 404 : 400).json({ error: code })
    }
  })

  app.delete('/api/admin/customer-files/file', requireAdmin, (req, res) => {
    try {
      const source = assertManualFile(req.query.path)
      const id = randomUUID()
      const recycleEntry = path.join(RECYCLE_DIR, id)
      mkdirSync(recycleEntry, { recursive: false, mode: 0o750 })
      renameSync(source.absolute, path.join(recycleEntry, 'file'))
      writeFileSync(path.join(recycleEntry, 'metadata.json'), JSON.stringify({
        name: path.basename(source.absolute),
        originalPath: source.normalized,
        deletedAt: new Date().toISOString(),
      }, null, 2), { mode: 0o640 })
      return res.json({ ok: true, id })
    } catch (error) {
      const code = error?.code || 'recycle_failed'
      return res.status(code === 'not_found' ? 404 : 400).json({ error: code })
    }
  })

  app.post('/api/admin/customer-files/recycle/:id/restore', requireAdmin, (req, res) => {
    const id = String(req.params.id || '')
    if (!/^[a-f0-9-]{36}$/i.test(id)) return res.status(400).json({ error: 'invalid_id' })
    try {
      const entry = path.join(RECYCLE_DIR, id)
      const metadata = JSON.parse(readFileSync(path.join(entry, 'metadata.json'), 'utf8'))
      const original = resolveManagerFile(metadata.originalPath)
      if (!original || !original.normalized.split('/').some((part) => part.includes('_MANUAL-'))) return res.status(400).json({ error: 'invalid_path' })
      mkdirSync(path.dirname(original.absolute), { recursive: true })
      const destination = uniqueDestination(path.dirname(original.absolute), path.basename(original.absolute))
      renameSync(path.join(entry, 'file'), destination)
      rmSync(entry, { recursive: true, force: true })
      return res.json({ ok: true })
    } catch {
      return res.status(404).json({ error: 'not_found' })
    }
  })

  app.delete('/api/admin/customer-files/recycle/:id', requireAdmin, (req, res) => {
    const id = String(req.params.id || '')
    if (!/^[a-f0-9-]{36}$/i.test(id)) return res.status(400).json({ error: 'invalid_id' })
    const entry = path.join(RECYCLE_DIR, id)
    if (!existsSync(entry)) return res.status(404).json({ error: 'not_found' })
    rmSync(entry, { recursive: true, force: false })
    return res.json({ ok: true })
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
