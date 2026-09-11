/** Permanent paid-order artwork archive, intended for a dedicated LXC mount. */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAdmin } from './adminAuth.mjs'
import { detectImageType } from './security.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEMP_ARTWORK_DIR = path.resolve(__dirname, '../uploads/custom')
export const CUSTOMER_FILES_DIR = path.resolve(
  process.env.CUSTOMER_FILES_DIR || path.resolve(__dirname, '../data/customer-files'),
)

mkdirSync(CUSTOMER_FILES_DIR, { recursive: true })

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
