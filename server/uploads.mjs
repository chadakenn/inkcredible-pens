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
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAdmin } from './adminAuth.mjs'
import {
  createRateLimiter,
  detectImageType,
} from './security.mjs'

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
