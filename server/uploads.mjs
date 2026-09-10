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

/** Save a verified storefront product image from trusted server-side callers. */
export function saveProductImageBuffer(buf) {
  const saved = writeVerifiedBuffer(PRODUCT_UPLOAD_DIR, buf)
  return { ...saved, url: `/uploads/products/${saved.filename}` }
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
 * Walk checkout/order JSON shapes (single record, {orders|items|lines}, or array)
 * and collect custom artwork file ids still in use.
 */
function collectArtworkRefsFromValue(data, ids) {
  if (data == null) return
  if (Array.isArray(data)) {
    for (const item of data) collectArtworkRefsFromValue(item, ids)
    return
  }
  if (typeof data !== 'object') return

  if (Array.isArray(data.orders)) collectArtworkRefsFromValue(data.orders, ids)
  if (Array.isArray(data.checkouts)) collectArtworkRefsFromValue(data.checkouts, ids)

  const lines = data.lines || data.items
  if (Array.isArray(lines)) {
    for (const line of lines) {
      const c = line?.custom || line?.config
      if (!c || typeof c !== 'object') continue
      if (c.artworkId) ids.add(path.basename(String(c.artworkId)))
      if (c.artworkFileName) ids.add(path.basename(String(c.artworkFileName)))
      if (typeof c.artworkUrl === 'string') {
        const m = /\/([a-f0-9-]{36}\.(?:jpe?g|png|webp|gif))$/i.exec(c.artworkUrl)
        if (m) ids.add(m[1])
      }
    }
  }
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
      files = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.includes('.bak'))
    } catch {
      continue
    }
    for (const f of files) {
      try {
        const data = readJsonFile(path.join(dir, f))
        collectArtworkRefsFromValue(data, ids)
      } catch {
        /* skip */
      }
    }
  }
  return ids
}

const PRODUCT_UPLOAD_URL_RE =
  /^\/uploads\/products\/([a-f0-9-]{36}\.(?:jpe?g|png|webp|gif))$/i

/**
 * Extract product upload filename from a catalog imageUrl path, or null.
 */
export function productUploadFilenameFromUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null
  const m = PRODUCT_UPLOAD_URL_RE.exec(imageUrl.trim())
  return m ? m[1] : null
}

/**
 * Delete a product photo under uploads/products/ if no catalog product references it.
 * Safe no-op for non-local URLs or missing files.
 * @param {string|undefined|null} imageUrl
 * @param {Array<{ imageUrl?: string }>} catalogProducts current catalog (after mutation)
 * @returns {{ deleted: boolean, filename: string|null }}
 */
export function deleteProductUploadIfUnreferenced(imageUrl, catalogProducts) {
  const filename = productUploadFilenameFromUrl(imageUrl)
  if (!filename) return { deleted: false, filename: null }
  const stillUsed = (Array.isArray(catalogProducts) ? catalogProducts : []).some(
    (p) => productUploadFilenameFromUrl(p?.imageUrl) === filename,
  )
  if (stillUsed) return { deleted: false, filename }
  const full = path.join(PRODUCT_UPLOAD_DIR, filename)
  if (!existsSync(full)) return { deleted: false, filename }
  try {
    unlinkSync(full)
    console.log('[uploads] removed unreferenced product photo', filename)
    return { deleted: true, filename }
  } catch (err) {
    console.error('[uploads] failed to remove product photo', filename, err)
    return { deleted: false, filename }
  }
}

/**
 * Sweep product photos older than maxAgeMs that are not referenced by catalog.
 * Conservative: only UUID-named files under uploads/products/.
 */
export function cleanupOrphanProductUploads(maxAgeMs = 0) {
  const catalogPath = path.resolve(__dirname, '../data/catalog/products.json')
  let products = []
  try {
    if (existsSync(catalogPath)) {
      const data = readJsonFile(catalogPath)
      if (Array.isArray(data)) products = data
      else if (data && Array.isArray(data.products)) products = data.products
    }
  } catch (err) {
    console.error('[uploads] catalog read for product orphan sweep failed', err)
    return { removed: 0, scanned: 0, keptReferenced: 0 }
  }
  const referenced = new Set()
  for (const p of products) {
    const name = productUploadFilenameFromUrl(p?.imageUrl)
    if (name) referenced.add(name)
  }
  const now = Date.now()
  let removed = 0
  let scanned = 0
  let keptReferenced = 0
  try {
    const files = readdirSync(PRODUCT_UPLOAD_DIR).filter((f) =>
      /^[a-f0-9-]{36}\.(jpe?g|png|webp|gif)$/i.test(f),
    )
    for (const f of files) {
      scanned += 1
      if (referenced.has(f)) {
        keptReferenced += 1
        continue
      }
      const full = path.join(PRODUCT_UPLOAD_DIR, f)
      try {
        const st = statSync(full)
        if (maxAgeMs > 0 && now - st.mtimeMs < maxAgeMs) continue
        unlinkSync(full)
        removed += 1
      } catch (err) {
        console.error('[uploads] product orphan skip', f, err)
      }
    }
  } catch (err) {
    console.error('[uploads] product orphan sweep failed', err)
  }
  return { removed, scanned, keptReferenced }
}

/**
 * Delete abandoned customer artwork older than maxAgeMs that is not referenced
 * by a checkout or order JSON. Unreferenced product photos are swept separately.
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
    // Product photos: delete only files not referenced by catalog (immediate when unreferenced).
    const p = cleanupOrphanProductUploads(0)
    console.log(
      `[retention] product photos: removed=${p.removed} scanned=${p.scanned} keptReferenced=${p.keptReferenced}`,
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
