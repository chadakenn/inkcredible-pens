/**
 * Custom artwork uploads (disk) — mounted on the Stripe Express app (4242).
 * Files: /workspace/inkcredible-pens/uploads/custom/
 */
import multer from 'multer'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const UPLOAD_DIR = path.resolve(__dirname, '../uploads/custom')

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
])

mkdirSync(UPLOAD_DIR, { recursive: true })

function safeOriginalName(name) {
  const base = path.basename(String(name || 'artwork'))
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_')
  const trimmed = cleaned.slice(0, 80)
  return trimmed.length > 0 ? trimmed : 'artwork'
}

function isAllowedFile(file) {
  if (ALLOWED_MIME.has(file.mimetype)) return true
  return /\.(png|jpe?g|webp|svg)$/i.test(file.originalname || '')
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${safeOriginalName(file.originalname)}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedFile(file)) {
      cb(null, true)
      return
    }
    cb(new Error('invalid_type'))
  },
})

/**
 * @param {import('express').Express} app
 */
export function mountUploads(app) {
  app.post('/api/uploads/custom', (req, res) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        const code =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? 'file_too_large'
            : err.message === 'invalid_type'
              ? 'invalid_type'
              : 'upload_failed'
        const status = code === 'file_too_large' || code === 'invalid_type' ? 400 : 500
        console.error('[uploads]', code, err.message || err)
        return res.status(status).json({ error: code })
      }
      if (!req.file) {
        return res.status(400).json({ error: 'missing_file' })
      }
      const storedName = req.file.filename
      return res.json({
        id: storedName,
        fileName: req.file.originalname,
        url: `/uploads/custom/${storedName}`,
        size: req.file.size,
        mime: req.file.mimetype,
      })
    })
  })

  /** Metadata lookup — id is the stored filename */
  app.get('/api/uploads/custom/:id', (req, res) => {
    const id = path.basename(String(req.params.id || ''))
    if (!id || id === '.' || id === '..') {
      return res.status(400).json({ error: 'invalid_id' })
    }
    const filePath = path.join(UPLOAD_DIR, id)
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'not_found' })
    }
    let size = 0
    try {
      size = statSync(filePath).size
    } catch {
      /* ignore */
    }
    return res.json({
      id,
      fileName: id,
      url: `/uploads/custom/${id}`,
      size,
    })
  })

  app.get('/uploads/custom/:name', (req, res) => {
    const name = path.basename(String(req.params.name || ''))
    if (!name || name === '.' || name === '..') {
      return res.status(400).send('Bad request')
    }
    const filePath = path.join(UPLOAD_DIR, name)
    if (!existsSync(filePath)) {
      return res.status(404).send('Not found')
    }
    if (String(req.query.download) === '1') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${name.replace(/"/g, '')}"`,
      )
    }
    return res.sendFile(filePath)
  })
}
