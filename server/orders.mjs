/**
 * Shared orders persistence (JSON on disk) — mounted on Express (4242).
 * File: /workspace/inkcredible-pens/data/orders/orders.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ORDERS_DIR = path.resolve(__dirname, '../data/orders')
export const ORDERS_FILE = path.join(ORDERS_DIR, 'orders.json')

const STATUSES = new Set(['new', 'in_progress', 'done', 'cancelled'])

mkdirSync(ORDERS_DIR, { recursive: true })

function newOrderId() {
  return `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function readOrders() {
  if (!existsSync(ORDERS_FILE)) return []
  try {
    const raw = readFileSync(ORDERS_FILE, 'utf8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.orders)) return data.orders
    return []
  } catch (err) {
    console.error('[orders] read failed', err)
    return []
  }
}

function writeOrders(orders) {
  writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8')
}

function newestFirst(orders) {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

function normalizeCustomer(raw) {
  const c = raw && typeof raw === 'object' ? raw : {}
  return {
    email: String(c.email || ''),
    name: String(c.name || ''),
    address: String(c.address || ''),
    city: String(c.city || ''),
    state: String(c.state || ''),
    zip: String(c.zip || ''),
  }
}

function normalizeItems(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const row = item && typeof item === 'object' ? item : {}
    const out = {
      name: String(row.name || 'Item'),
      price: Number(row.price) || 0,
      qty: Math.max(1, Math.round(Number(row.qty) || 1)),
    }
    if (row.custom && typeof row.custom === 'object') {
      out.custom = row.custom
    }
    return out
  })
}

/**
 * @param {import('express').Express} app
 */
export function mountOrders(app) {
  app.get('/api/orders', (_req, res) => {
    const orders = newestFirst(readOrders())
    return res.json({ orders })
  })

  app.post('/api/orders', (req, res) => {
    const body = req.body ?? {}
    const customer = normalizeCustomer(body.customer)
    const items = normalizeItems(body.items)
    if (!customer.email && !customer.name) {
      return res.status(400).json({ error: 'invalid_customer' })
    }
    if (items.length === 0) {
      return res.status(400).json({ error: 'invalid_items' })
    }

    const stripeSessionId =
      typeof body.stripeSessionId === 'string' && body.stripeSessionId.trim()
        ? body.stripeSessionId.trim()
        : undefined

    const orders = readOrders()

    if (stripeSessionId) {
      const dup = orders.find((o) => o.stripeSessionId === stripeSessionId)
      if (dup) {
        return res.status(409).json({ error: 'duplicate_stripe_session', order: dup })
      }
    }

    let id =
      typeof body.id === 'string' && body.id.trim() ? body.id.trim() : newOrderId()
    if (orders.some((o) => o.id === id)) {
      if (stripeSessionId) {
        // Idempotent: same id + session already handled above; same id without session → reject
        const existing = orders.find((o) => o.id === id)
        if (existing) {
          return res.status(409).json({ error: 'duplicate_id', order: existing })
        }
      } else {
        id = newOrderId()
      }
    }

    const status =
      typeof body.status === 'string' && STATUSES.has(body.status)
        ? body.status
        : 'new'

    const order = {
      id,
      createdAt:
        typeof body.createdAt === 'string' && body.createdAt
          ? body.createdAt
          : new Date().toISOString(),
      customer,
      items,
      status,
      total: Number(body.total) || 0,
    }
    if (stripeSessionId) order.stripeSessionId = stripeSessionId
    if (body.shippingCents != null && Number.isFinite(Number(body.shippingCents))) {
      order.shippingCents = Math.round(Number(body.shippingCents))
    }

    orders.unshift(order)
    writeOrders(orders)
    return res.status(201).json({ order })
  })

  app.patch('/api/orders/:id', (req, res) => {
    const id = String(req.params.id || '')
    if (!id) return res.status(400).json({ error: 'invalid_id' })
    const body = req.body ?? {}
    const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status')
    const hasCarrier = Object.prototype.hasOwnProperty.call(body, 'trackingCarrier')
    const hasNumber = Object.prototype.hasOwnProperty.call(body, 'trackingNumber')
    const hasShippedAt = Object.prototype.hasOwnProperty.call(body, 'shippedAt')

    if (!hasStatus && !hasCarrier && !hasNumber && !hasShippedAt) {
      return res.status(400).json({ error: 'no_updates' })
    }

    if (hasStatus) {
      if (typeof body.status !== 'string' || !STATUSES.has(body.status)) {
        return res.status(400).json({ error: 'invalid_status' })
      }
    }

    const orders = readOrders()
    const idx = orders.findIndex((o) => o.id === id)
    if (idx < 0) return res.status(404).json({ error: 'not_found' })

    const next = { ...orders[idx] }

    if (hasStatus) next.status = body.status

    if (hasCarrier) {
      if (body.trackingCarrier == null || body.trackingCarrier === '') {
        delete next.trackingCarrier
      } else if (typeof body.trackingCarrier === 'string') {
        next.trackingCarrier = body.trackingCarrier.trim()
      } else {
        return res.status(400).json({ error: 'invalid_trackingCarrier' })
      }
    }

    if (hasNumber) {
      if (body.trackingNumber == null || body.trackingNumber === '') {
        delete next.trackingNumber
      } else if (typeof body.trackingNumber === 'string') {
        next.trackingNumber = body.trackingNumber.trim()
      } else {
        return res.status(400).json({ error: 'invalid_trackingNumber' })
      }
    }

    if (hasShippedAt) {
      if (body.shippedAt == null || body.shippedAt === '') {
        delete next.shippedAt
      } else if (typeof body.shippedAt === 'string') {
        next.shippedAt = body.shippedAt
      } else {
        return res.status(400).json({ error: 'invalid_shippedAt' })
      }
    } else if (
      (hasNumber || hasCarrier) &&
      next.trackingNumber &&
      !next.shippedAt
    ) {
      next.shippedAt = new Date().toISOString()
    }

    orders[idx] = next
    writeOrders(orders)
    return res.json({ order: orders[idx] })
  })

  app.delete('/api/orders/:id', (req, res) => {
    const id = String(req.params.id || '')
    if (!id) return res.status(400).json({ error: 'invalid_id' })
    const orders = readOrders()
    const next = orders.filter((o) => o.id !== id)
    if (next.length === orders.length) {
      return res.status(404).json({ error: 'not_found' })
    }
    writeOrders(next)
    return res.json({ ok: true })
  })
}
