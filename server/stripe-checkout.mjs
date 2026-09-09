/**
 * Stripe Checkout + admin API (test mode).
 * Run: STRIPE_SECRET_KEY=sk_test_... npm run stripe:server
 * Or load key from /home/box/agent-data/box-secrets.json
 *
 * Pricing is server-authoritative. Orders are created by webhook, not the browser.
 */
import cors from 'cors'
import express from 'express'
import Stripe from 'stripe'
import { readFileSync, existsSync } from 'node:fs'
import { mountUploads } from './uploads.mjs'
import { mountOrders, createPaidOrder, findOrderByStripeSession } from './orders.mjs'
import { mountCatalog } from './catalog.mjs'
import { mountAdminAuth } from './adminAuth.mjs'
import { priceCart } from './pricing.mjs'
import {
  attachStripeSession,
  findCheckoutByStripeSession,
  markCheckoutCompleted,
  newCheckoutId,
  readCheckout,
  savePendingCheckout,
} from './checkouts.mjs'

const PORT = Number(process.env.PORT) || 4242
const DEFAULT_ORIGIN =
  process.env.ORIGIN || 'https://gentle-temple-breaking-copper.trycloudflare.com'

function loadSecret() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY
  const candidates = [
    '/home/box/agent-data/box-secrets.json',
    '/home/box/sand-data/box-secrets.json',
  ]
  for (const file of candidates) {
    try {
      if (!existsSync(file)) continue
      const data = JSON.parse(readFileSync(file, 'utf8'))
      const key = data?.secrets?.STRIPE_SECRET_KEY
      if (typeof key === 'string' && key.length > 0) return key
    } catch {
      /* ignore */
    }
  }
  return undefined
}

function loadWebhookSecret() {
  if (process.env.STRIPE_WEBHOOK_SECRET) return process.env.STRIPE_WEBHOOK_SECRET
  const candidates = [
    '/home/box/agent-data/box-secrets.json',
    '/home/box/sand-data/box-secrets.json',
  ]
  for (const file of candidates) {
    try {
      if (!existsSync(file)) continue
      const data = JSON.parse(readFileSync(file, 'utf8'))
      const key = data?.secrets?.STRIPE_WEBHOOK_SECRET
      if (typeof key === 'string' && key.length > 0) return key
    } catch {
      /* ignore */
    }
  }
  return undefined
}

function isHttpOrigin(value) {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function resolveReturnOrigin(bodyOrigin) {
  if (isHttpOrigin(bodyOrigin)) return String(bodyOrigin).replace(/\/$/, '')
  if (isHttpOrigin(process.env.ORIGIN)) return String(process.env.ORIGIN).replace(/\/$/, '')
  if (isHttpOrigin(DEFAULT_ORIGIN)) return DEFAULT_ORIGIN.replace(/\/$/, '')
  return 'http://127.0.0.1:5173'
}

function truncateMeta(value, max = 500) {
  const s = String(value ?? '')
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

const secret = loadSecret()
const webhookSecret = loadWebhookSecret()

const app = express()
app.use(cors({ origin: true }))

// Stripe webhook MUST receive the raw body for signature verification.
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!secret) {
      return res.status(503).json({ error: 'missing_stripe_key' })
    }
    const stripe = new Stripe(secret)
    let event
    try {
      if (webhookSecret) {
        const sig = req.headers['stripe-signature']
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
      } else {
        // Local convenience only — set STRIPE_WEBHOOK_SECRET in real deploys.
        console.warn(
          '[stripe-webhook] STRIPE_WEBHOOK_SECRET missing — parsing body without verify',
        )
        event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body)
      }
    } catch (err) {
      console.error('[stripe-webhook] verify failed', err)
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object
        await fulfillCheckoutSession(session)
      }
    } catch (err) {
      console.error('[stripe-webhook] handler failed', err)
      return res.status(500).json({ error: 'handler_failed' })
    }
    return res.json({ received: true })
  },
)

app.use(express.json({ limit: '1mb' }))

mountAdminAuth(app)
mountUploads(app)
mountOrders(app)
mountCatalog(app)

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    stripe: Boolean(secret),
    webhook: Boolean(webhookSecret),
  })
})

/**
 * Public-ish success lookup: order number + status only (no full PII dump).
 */
app.get('/api/checkout/session/:id', (req, res) => {
  const id = String(req.params.id || '')
  if (!id.startsWith('cs_')) {
    return res.status(400).json({ error: 'invalid_session_id' })
  }

  const order = findOrderByStripeSession(id)
  if (order) {
    return res.json({
      sessionId: id,
      status: 'paid',
      orderId: order.id,
      orderStatus: order.status,
      total: order.total,
    })
  }

  const pending = findCheckoutByStripeSession(id)
  if (pending) {
    return res.json({
      sessionId: id,
      status: pending.status === 'completed' ? 'paid' : 'pending',
      orderId: pending.orderId ?? null,
      orderStatus: pending.status === 'completed' ? 'new' : 'pending',
      checkoutId: pending.id,
    })
  }

  return res.status(404).json({ error: 'not_found', sessionId: id, status: 'unknown' })
})

/** @deprecated Prefer GET /api/checkout/session/:id — kept for debugging only. */
app.get('/api/checkout-session/:id', async (req, res) => {
  if (!secret) {
    return res.status(503).json({ error: 'missing_stripe_key' })
  }
  const id = String(req.params.id || '')
  if (!id.startsWith('cs_')) {
    return res.status(400).json({ error: 'invalid_session_id' })
  }
  const order = findOrderByStripeSession(id)
  if (order) {
    return res.json({
      id,
      payment_status: 'paid',
      orderId: order.id,
      orderStatus: order.status,
      amount_total: Math.round(Number(order.total) * 100),
    })
  }
  try {
    const stripe = new Stripe(secret)
    const session = await stripe.checkout.sessions.retrieve(id)
    return res.json({
      id: session.id,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      metadata: {
        checkoutId: session.metadata?.checkoutId ?? session.client_reference_id ?? null,
      },
    })
  } catch (err) {
    console.error('[stripe-checkout] retrieve', err)
    const message = err instanceof Error ? err.message : 'retrieve_failed'
    return res.status(500).json({ error: message })
  }
})

function fulfillCheckoutSession(session) {
  const sessionId = session.id
  const existing = findOrderByStripeSession(sessionId)
  if (existing) {
    return existing
  }

  const checkoutId =
    session.client_reference_id ||
    session.metadata?.checkoutId ||
    null

  let pending = checkoutId ? readCheckout(checkoutId) : null
  if (!pending) {
    pending = findCheckoutByStripeSession(sessionId)
  }
  if (!pending) {
    console.error('[stripe-webhook] no pending checkout for', sessionId, checkoutId)
    throw new Error('pending_checkout_missing')
  }

  const lines = Array.isArray(pending.lines) ? pending.lines : []
  const items = lines.map((line) => ({
    name: line.name,
    price: (line.unitAmountCents || 0) / 100,
    qty: line.quantity || 1,
    custom: line.custom,
    productId: line.productId,
  }))

  const total =
    pending.totalCents != null
      ? pending.totalCents / 100
      : (session.amount_total ?? 0) / 100

  const { order } = createPaidOrder({
    id: `stripe-${sessionId}`,
    stripeSessionId: sessionId,
    checkoutId: pending.id,
    customer: pending.customer,
    items,
    total,
    shippingCents: pending.shippingCents,
    subtotalCents: pending.subtotalCents,
    status: 'new',
    paid: true,
  })

  markCheckoutCompleted(pending.id, {
    orderId: order.id,
    stripeSessionId: sessionId,
  })
  return order
}

app.post('/api/create-checkout-session', async (req, res) => {
  if (!secret) {
    return res.status(503).json({ error: 'missing_stripe_key' })
  }

  const {
    email,
    fullName,
    address,
    city,
    state,
    zip,
    items,
    returnOrigin,
  } = req.body ?? {}

  if (!email || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'invalid_body' })
  }

  const origin = resolveReturnOrigin(returnOrigin)

  let priced
  try {
    priced = priceCart(items)
  } catch (err) {
    console.error('[stripe-checkout] priceCart', err)
    const code = err?.code || 'pricing_failed'
    return res.status(400).json({ error: code, message: err instanceof Error ? err.message : code })
  }

  const customer = {
    email: String(email),
    name: String(fullName || ''),
    address: String(address || ''),
    city: String(city || ''),
    state: String(state || ''),
    zip: String(zip || ''),
  }

  const checkoutId = newCheckoutId()
  savePendingCheckout({
    id: checkoutId,
    status: 'pending',
    customer,
    lines: priced.lines,
    subtotalCents: priced.subtotalCents,
    shippingCents: priced.shippingCents,
    totalCents: priced.totalCents,
  })

  try {
    const stripe = new Stripe(secret)

    const line_items = priced.lines.map((line) => ({
      quantity: line.quantity,
      price_data: {
        currency: 'usd',
        unit_amount: line.unitAmountCents,
        product_data: {
          name: line.description
            ? `${line.name} (${line.description})`
            : line.name,
          metadata: {
            productId: String(line.productId || ''),
            checkoutId,
          },
        },
      },
    }))

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: customer.email,
      client_reference_id: checkoutId,
      line_items,
      shipping_address_collection: { allowed_countries: ['US'] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: priced.shippingCents,
              currency: 'usd',
            },
            display_name:
              priced.shippingCents === 0 ? 'Free shipping' : 'Standard shipping',
          },
        },
      ],
      success_url: `${origin}/checkout?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?canceled=1`,
      metadata: {
        checkoutId,
        email: truncateMeta(customer.email),
        fullName: truncateMeta(customer.name),
        shippingCents: String(priced.shippingCents),
        subtotalCents: String(priced.subtotalCents),
      },
    })

    if (!session.url) {
      return res.status(502).json({ error: 'no_checkout_url' })
    }

    attachStripeSession(checkoutId, session.id)

    return res.json({
      url: session.url,
      id: session.id,
      checkoutId,
      subtotalCents: priced.subtotalCents,
      shippingCents: priced.shippingCents,
      totalCents: priced.totalCents,
    })
  } catch (err) {
    console.error('[stripe-checkout]', err)
    const message = err instanceof Error ? err.message : 'checkout_failed'
    return res.status(500).json({ error: message })
  }
})

app.listen(PORT, () => {
  console.log(
    `[stripe-checkout] listening on http://127.0.0.1:${PORT} (ORIGIN=${DEFAULT_ORIGIN}, stripe=${Boolean(secret)}, webhook=${Boolean(webhookSecret)})`,
  )
  if (!secret) {
    console.warn(
      '[stripe-checkout] STRIPE_SECRET_KEY not set — /api/create-checkout-session returns 503',
    )
  }
  if (!webhookSecret) {
    console.warn(
      '[stripe-checkout] STRIPE_WEBHOOK_SECRET not set — use `stripe listen --forward-to localhost:4242/api/stripe/webhook`',
    )
  }
})
