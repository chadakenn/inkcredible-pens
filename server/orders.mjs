/**
 * Shared orders persistence (JSON on disk) — mounted on Express (4242).
 * File: /workspace/inkcredible-pens/data/orders/orders.json
 * All HTTP routes require admin auth; webhook uses createPaidOrder().
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAdmin } from './adminAuth.mjs'

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
    if (row.productId) out.productId = String(row.productId)
    return out
  })
}

/**
 * Create or return existing paid order (idempotent by stripeSessionId).
 * Used by Stripe webhook — not exposed as a public HTTP create path for customers.
 */
export function createPaidOrder(input) {
  const customer = normalizeCustomer(input.customer)
  const items = normalizeItems(input.items)
  if (items.length === 0) {
    throw Object.assign(new Error('invalid_items'), { code: 'invalid_items' })
  }

  const stripeSessionId =
    typeof input.stripeSessionId === 'string' && input.stripeSessionId.trim()
      ? input.stripeSessionId.trim()
      : undefined

  const orders = readOrders()

  if (stripeSessionId) {
    const dup = orders.find((o) => o.stripeSessionId === stripeSessionId)
    if (dup) return { order: dup, created: false }
  }

  let id =
    typeof input.id === 'string' && input.id.trim() ? input.id.trim() : newOrderId()
  if (orders.some((o) => o.id === id)) {
    if (stripeSessionId) {
      const existing = orders.find((o) => o.id === id)
      if (existing) return { order: existing, created: false }
    }
    id = newOrderId()
  }

  const order = {
    id,
    createdAt:
      typeof input.createdAt === 'string' && input.createdAt
        ? input.createdAt
        : new Date().toISOString(),
    customer,
    items,
    status:
      typeof input.status === 'string' && STATUSES.has(input.status)
        ? input.status
        : 'new',
    total: Number(input.total) || 0,
  }
  if (input.paid === true) order.paid = true
  if (stripeSessionId) order.stripeSessionId = stripeSessionId
  if (input.shippingCents != null && Number.isFinite(Number(input.shippingCents))) {
    order.shippingCents = Math.round(Number(input.shippingCents))
  }
  if (input.checkoutId) order.checkoutId = String(input.checkoutId)
  if (input.subtotalCents != null) order.subtotalCents = Math.round(Number(input.subtotalCents))

  orders.unshift(order)
  writeOrders(orders)
  return { order, created: true }
}

export function findOrderByStripeSession(sessionId) {
  const sid = String(sessionId || '')
  if (!sid) return null
  return readOrders().find((o) => o.stripeSessionId === sid) ?? null
}

export function findOrderById(id) {
  return readOrders().find((o) => o.id === id) ?? null
}

/**
 * @param {import('express').Express} app
 */
export function mountOrders(app) {
  app.get('/api/orders', requireAdmin, (_req, res) => {
    const orders = newestFirst(readOrders())
    return res.json({ orders })
  })

  app.post('/api/orders', requireAdmin, (req, res) => {
    const body = req.body ?? {}
    try {
      const { order, created } = createPaidOrder({
        ...body,
        paid: body.paid === true,
      })
      return res.status(created ? 201 : 409).json({
        order,
        ...(created ? {} : { error: 'duplicate_stripe_session' }),
      })
    } catch (err) {
      const code = err?.code || 'create_failed'
      return res.status(400).json({ error: code })
    }
  })

  app.patch('/api/orders/:id', requireAdmin, (req, res) => {
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
    } else if ((hasNumber || hasCarrier) && next.trackingNumber && !next.shippedAt) {
      next.shippedAt = new Date().toISOString()
    }

    orders[idx] = next
    writeOrders(orders)
    return res.json({ order: orders[idx] })
  })

  app.delete('/api/orders/:id', requireAdmin, (req, res) => {
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
