/**
 * Artwork + product photo uploads.
 * - Customer artwork: uploads/custom/ — UUID names, magic-byte verified, admin-only download
 * - Product photos: uploads/products/ — public storefront assets
 */
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAdmin } from './adminAuth.mjs'
import {
  createRateLimiter,
  detectImageType,
  readJsonFile,
} from './security.mjs'
import { CHECKOUTS_DIR } from './checkouts.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CUSTOM_UPLOAD_DIR = path.resolve(__dirname, '../uploads/custom')
export const PRODUCT_UPLOAD_DIR = path.resolve(__dirname, '../uploads/products')
/** @deprecated use CUSTOM_UPLOAD_DIR */
export const UPLOAD_DIR = CUSTOM_UPLOAD_DIR

const MAX_CUSTOM_BYTES = 12 * 1024 * 1024
const MAX_PRODUCT_BYTES = 8 * 1024 * 1024

mkdirSync(CUSTOM_UPLOAD_DIR, { recursive: true })
mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true })

const customUploadLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: 'upload-custom',
})
const productUploadLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  name: 'upload-product',
})

const memory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CUSTOM_BYTES },
})

const productMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PRODUCT_BYTES },
})

function safeStoredName(ext) {
  return `${randomUUID()}${ext}`
}

function writeVerifiedBuffer(dir, buf) {
  const detected = detectImageType(buf)
  if (!detected) {
    const err = new Error('invalid_type')
    err.code = 'invalid_type'
    throw err
  }
  const filename = safeStoredName(detected.ext)
  const dest = path.join(dir, filename)
  const tmp = `${dest}.${process.pid}.tmp`
  writeFileSync(tmp, buf)
  renameSync(tmp, dest)
  return { filename, mime: detected.mime, size: buf.length, path: dest }
}

/**
 * @param {import('express').Express} app
 */
export function mountUploads(app) {
  // --- Customer custom artwork (print files) ---
  app.post('/api/uploads/custom', customUploadLimit, (req, res) => {
    memory.single('file')(req, res, (err) => {
      if (err) {
        const code =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? 'file_too_large'
            : 'upload_failed'
        const status = code === 'file_too_large' ? 400 : 500
        console.error('[uploads/custom]', code, err.message || err)
        return res.status(status).json({ error: code })
      }
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'missing_file' })
      }
      try {
        const saved = writeVerifiedBuffer(CUSTOM_UPLOAD_DIR, req.file.buffer)
        // Admin-only download path — not world-readable static
        const adminUrl = `/api/admin/uploads/custom/${saved.filename}`
        return res.json({
          id: saved.filename,
          fileName: req.file.originalname || saved.filename,
          url: adminUrl,
          adminUrl,
          size: saved.size,
          mime: saved.mime,
        })
      } catch (e) {
        if (e?.code === 'invalid_type' || e?.message === 'invalid_type') {
          return res.status(400).json({ error: 'invalid_type' })
        }
        console.error('[uploads/custom] save failed', e)
        return res.status(500).json({ error: 'upload_failed' })
      }
    })
  })

  app.get('/api/uploads/custom/:id', requireAdmin, (req, res) => {
    const id = path.basename(String(req.params.id || ''))
    if (!id || id === '.' || id === '..' || !/^[a-f0-9-]{36}\.(jpe?g|png|webp|gif)$/i.test(id)) {
      return res.status(400).json({ error: 'invalid_id' })
    }
    const filePath = path.join(CUSTOM_UPLOAD_DIR, id)
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'not_found' })
    }
    let size = 0
    try {
      size = readFileSync(filePath).length
    } catch {
      /* ignore */
    }
    return res.json({
      id,
      fileName: id,
      url: `/api/admin/uploads/custom/${id}`,
      size,
    })
  })

  /** Admin-protected download / preview of customer print files */
  app.get('/api/admin/uploads/custom/:name', requireAdmin, (req, res) => {
    const name = path.basename(String(req.params.name || ''))
    if (!name || name === '.' || name === '..') {
      return res.status(400).send('Bad request')
    }
    const filePath = path.join(CUSTOM_UPLOAD_DIR, name)
    if (!existsSync(filePath)) {
      return res.status(404).send('Not found')
    }
    const detected = detectImageType(readFileSync(filePath))
    if (detected) res.type(detected.mime)
    if (String(req.query.download) === '1') {
      const original = String(req.query.filename || name).replace(/[^\w.\-()+ ]+/g, '_')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${original.slice(0, 120)}"`,
      )
    }
    return res.sendFile(filePath)
  })

  // Legacy public path — refuse (do not serve customer artwork openly)
  app.get('/uploads/custom/:name', (_req, res) => {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Customer artwork is admin-only. Use Store Manager download.',
    })
  })

  // --- Product storefront photos (public) ---
  app.post(
    '/api/uploads/products',
    requireAdmin,
    productUploadLimit,
    (req, res) => {
      productMemory.single('file')(req, res, (err) => {
        if (err) {
          const code =
            err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
              ? 'file_too_large'
              : 'upload_failed'
          const status = code === 'file_too_large' ? 400 : 500
          console.error('[uploads/products]', code, err.message || err)
          return res.status(status).json({ error: code })
        }
        if (!req.file?.buffer) {
          return res.status(400).json({ error: 'missing_file' })
        }
        try {
          const saved = writeVerifiedBuffer(PRODUCT_UPLOAD_DIR, req.file.buffer)
          const url = `/uploads/products/${saved.filename}`
          return res.json({
            id: saved.filename,
            fileName: req.file.originalname || saved.filename,
            url,
            size: saved.size,
            mime: saved.mime,
          })
        } catch (e) {
          if (e?.code === 'invalid_type' || e?.message === 'invalid_type') {
            return res.status(400).json({ error: 'invalid_type' })
          }
          console.error('[uploads/products] save failed', e)
          return res.status(500).json({ error: 'upload_failed' })
        }
      })
    },
  )

  app.get('/uploads/products/:name', (req, res) => {
    const name = path.basename(String(req.params.name || ''))
    if (!name || name === '.' || name === '..') {
      return res.status(400).send('Bad request')
    }
    const filePath = path.join(PRODUCT_UPLOAD_DIR, name)
    if (!existsSync(filePath)) {
      return res.status(404).send('Not found')
    }
    try {
      const detected = detectImageType(readFileSync(filePath))
      if (detected) res.type(detected.mime)
    } catch {
      /* ignore */
    }
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.sendFile(filePath)
  })
}


/**
 * Collect artwork ids referenced by pending/completed checkouts and paid orders.
 * Used so cleanup does not delete files still needed for open checkouts / orders.
 */
function referencedArtworkIds() {
  const ids = new Set()
  const dirs = [
    CHECKOUTS_DIR,
    path.resolve(__dirname, '../data/orders'),
  ]
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    let files = []
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.json'))
    } catch {
      continue
    }
    for (const f of files) {
      try {
        const data = readJsonFile(path.join(dir, f))
        const lines = data?.lines || data?.items || []
        if (!Array.isArray(lines)) continue
        for (const line of lines) {
          const c = line?.custom || line?.config
          if (c?.artworkId) ids.add(String(c.artworkId))
          if (c?.artworkFileName) ids.add(path.basename(String(c.artworkFileName)))
          if (typeof c?.artworkUrl === 'string') {
            const m = /\/([a-f0-9-]{36}\.(?:jpe?g|png|webp|gif))$/i.exec(c.artworkUrl)
            if (m) ids.add(m[1])
          }
        }
      } catch {
        /* skip */
      }
    }
  }
  return ids
}

/**
 * Delete abandoned customer artwork older than maxAgeMs that is not referenced
 * by a checkout or order JSON. Product photos are never auto-deleted.
 * @returns {{ removed: number, scanned: number, keptReferenced: number }}
 */
export function cleanupAbandonedCustomUploads(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const now = Date.now()
  let removed = 0
  let scanned = 0
  let keptReferenced = 0
  const refs = referencedArtworkIds()
  try {
    const files = readdirSync(CUSTOM_UPLOAD_DIR).filter((f) =>
      /^[a-f0-9-]{36}\.(jpe?g|png|webp|gif)$/i.test(f),
    )
    for (const f of files) {
      scanned += 1
      if (refs.has(f)) {
        keptReferenced += 1
        continue
      }
      const full = path.join(CUSTOM_UPLOAD_DIR, f)
      try {
        const st = statSync(full)
        if (now - st.mtimeMs < maxAgeMs) continue
        unlinkSync(full)
        removed += 1
      } catch (err) {
        console.error('[uploads] cleanup skip', f, err)
      }
    }
  } catch (err) {
    console.error('[uploads] cleanup failed', err)
  }
  return { removed, scanned, keptReferenced }
}

/**
 * Run retention cleanup once and on an interval (default daily).
 * Env: UPLOAD_RETENTION_DAYS (default 7), CHECKOUT_RETENTION_DAYS (default 7).
 */
export function startRetentionJobs({ cleanupCheckouts } = {}) {
  const uploadDays = Math.max(1, Number(process.env.UPLOAD_RETENTION_DAYS) || 7)
  const checkoutDays = Math.max(1, Number(process.env.CHECKOUT_RETENTION_DAYS) || 7)
  const uploadMs = uploadDays * 24 * 60 * 60 * 1000
  const checkoutMs = checkoutDays * 24 * 60 * 60 * 1000

  const run = () => {
    const u = cleanupAbandonedCustomUploads(uploadMs)
    console.log(
      `[retention] custom uploads: removed=${u.removed} scanned=${u.scanned} keptReferenced=${u.keptReferenced} (age>${uploadDays}d)`,
    )
    if (typeof cleanupCheckouts === 'function') {
      const c = cleanupCheckouts(checkoutMs)
      console.log(
        `[retention] checkouts: removed=${c.removed} scanned=${c.scanned} (age>${checkoutDays}d)`,
      )
    }
  }

  // Startup sweep (delayed slightly so boot logs stay readable)
  setTimeout(run, 5000)
  const dayMs = 24 * 60 * 60 * 1000
  setInterval(run, dayMs)
}
