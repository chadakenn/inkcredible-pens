import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { requireAdmin } from './adminAuth.mjs'
import { CUSTOMER_FILES_DIR } from './customer-files.mjs'
import { findOrderById, findOrderByProofToken, updateOrderById } from './orders.mjs'
import { createRateLimiter, detectImageType } from './security.mjs'

const publicProofLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60, name: 'proofs' })

function clean(value, max = 1000) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)
}

function proofView(order) {
  return {
    orderCode: order.displayCode || order.id,
    customerName: clean(order.customer?.name, 100),
    status: order.proofStatus || 'pending',
    requestedAt: order.proofRequestedAt || null,
    approvedAt: order.proofApprovedAt || null,
    message: clean(order.proofMessage, 1000),
    items: (order.items || []).map((item, index) => ({
      name: clean(item.name, 200),
      qty: Math.max(1, Number(item.qty) || 1),
      previewUrl: item.custom?.archivedArtworkPath
        ? `/api/proofs/${encodeURIComponent(order.proofToken)}/artwork/${index}`
        : null,
      previewDataUrl: /^data:image\/(?:png|jpeg|webp);base64,/i.test(String(item.custom?.logoDataUrl || ''))
        ? item.custom.logoDataUrl
        : null,
    })),
  }
}

function resolveProofArtwork(order, index) {
  const item = order.items?.[index]
  const relative = String(item?.custom?.archivedArtworkPath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  const absolute = path.resolve(CUSTOMER_FILES_DIR, relative)
  if (!relative || absolute === CUSTOMER_FILES_DIR || !absolute.startsWith(`${CUSTOMER_FILES_DIR}${path.sep}`)) return null
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return null
  return absolute
}

export function mountProofs(app) {
  app.post('/api/orders/:id/proof', requireAdmin, (req, res) => {
    const order = findOrderById(String(req.params.id || ''))
    if (!order) return res.status(404).json({ error: 'not_found' })
    if (!(order.items || []).some((item) => item.custom?.archivedArtworkPath || item.custom?.logoDataUrl)) {
      return res.status(400).json({ error: 'no_artwork' })
    }
    const saved = updateOrderById(order.id, (current) => ({
      ...current,
      proofToken: current.proofToken || randomUUID().replaceAll('-', ''),
      proofStatus: 'pending',
      proofRequestedAt: new Date().toISOString(),
      proofMessage: clean(req.body?.message, 1000),
      proofRevision: Math.max(0, Number(current.proofRevision) || 0) + 1,
      proofApprovedAt: undefined,
    }))
    return res.json({ order: saved, proofUrl: `${String(process.env.ORIGIN || '').replace(/\/$/, '')}/proof/${saved.proofToken}` })
  })

  app.get('/api/proofs/:token', publicProofLimit, (req, res) => {
    const order = findOrderByProofToken(String(req.params.token || ''))
    if (!order) return res.status(404).json({ error: 'not_found' })
    res.setHeader('Cache-Control', 'no-store')
    return res.json({ proof: proofView(order) })
  })

  app.get('/api/proofs/:token/artwork/:index', publicProofLimit, (req, res) => {
    const order = findOrderByProofToken(String(req.params.token || ''))
    if (!order) return res.status(404).send('Not found')
    const absolute = resolveProofArtwork(order, Number(req.params.index))
    if (!absolute) return res.status(404).send('Not found')
    const detected = detectImageType(readFileSync(absolute))
    if (!detected || detected.ext === '.svg') return res.status(404).send('Preview unavailable')
    res.type(detected.mime)
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.sendFile(absolute)
  })

  app.post('/api/proofs/:token/approve', publicProofLimit, (req, res) => {
    const order = findOrderByProofToken(String(req.params.token || ''))
    if (!order) return res.status(404).json({ error: 'not_found' })
    if (order.proofStatus === 'approved') return res.json({ proof: proofView(order) })
    const saved = updateOrderById(order.id, (current) => ({
      ...current,
      proofStatus: 'approved',
      proofApprovedAt: new Date().toISOString(),
    }))
    return res.json({ proof: proofView(saved) })
  })
}
