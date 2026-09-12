import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAdmin } from './adminAuth.mjs'
import { readJsonFile, writeJsonAtomic } from './security.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ACTIVITY_FILE = path.resolve(__dirname, '../data/admin/activity.json')
const MAX_ENTRIES = 2000

function readActivity() {
  const data = readJsonFile(ACTIVITY_FILE)
  return Array.isArray(data) ? data : Array.isArray(data?.entries) ? data.entries : []
}

function describe(method, url, body = {}) {
  const clean = url.split('?')[0]
  if (clean === '/api/admin/users') return ['account.created', body.displayName || body.username || 'Manager account']
  if (clean === '/api/admin/change-password') return ['account.password_changed', 'Own password']
  if (clean === '/api/admin/reset-password') return ['account.password_reset', body.userId || 'Manager account']
  if (clean.startsWith('/api/catalog/products')) return [`product.${method === 'POST' ? 'created' : method === 'PATCH' ? 'updated' : 'deleted'}`, body.name || decodeURIComponent(clean.split('/').at(-1) || 'Product')]
  if (clean === '/api/catalog/reset') return ['product.catalog_restored', 'Product catalog']
  if (clean.startsWith('/api/scents')) return [`scent.${method === 'POST' ? 'changed' : method === 'PATCH' ? 'renamed' : 'deleted'}`, body.name || body.oldName || decodeURIComponent(clean.split('/').at(-1) || 'Scent list')]
  if (clean.includes('/quotes/')) return [clean.endsWith('/send-payment') ? 'quote.payment_sent' : 'quote.updated', decodeURIComponent(clean.split('/')[4] || 'Quote')]
  if (clean.startsWith('/api/orders')) return [`order.${method === 'DELETE' ? 'deleted' : 'updated'}`, decodeURIComponent(clean.split('/')[3] || 'Order')]
  if (clean.includes('/customer-files')) return [`file.${method === 'DELETE' ? 'recycled_or_deleted' : method === 'PATCH' ? 'renamed_or_moved' : 'uploaded_or_restored'}`, body.fileName || body.path || 'Customer file']
  if (clean.includes('/proof')) return ['order.proof_changed', decodeURIComponent(clean.split('/')[3] || 'Proof')]
  return ['manager.change', clean]
}

export function activityMiddleware(req, res, next) {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) || !req.path.startsWith('/api/')) return next()
  res.on('finish', () => {
    if (!req.admin?.user || res.statusCode < 200 || res.statusCode >= 300) return
    try {
      const [action, subject] = describe(req.method, req.originalUrl, req.body)
      const entries = readActivity()
      entries.unshift({ id: randomUUID(), at: new Date().toISOString(), action, subject: String(subject).slice(0, 160), method: req.method, manager: req.admin.user })
      writeJsonAtomic(ACTIVITY_FILE, { version: 1, entries: entries.slice(0, MAX_ENTRIES) }, { keepBackups: 5, mode: 0o600 })
    } catch (error) { console.error('[activity] write failed', error) }
  })
  next()
}

export function mountActivity(app) {
  app.get('/api/admin/activity', requireAdmin, (_req, res) => res.json({ entries: readActivity().slice(0, 500) }))
}
