/**
 * Stripe Checkout Session stub (test mode).
 * Run: STRIPE_SECRET_KEY=sk_test_... npm run stripe:server
 * Or load key from /home/box/agent-data/box-secrets.json
 */
import cors from 'cors'
import express from 'express'
import Stripe from 'stripe'
import { readFileSync, existsSync } from 'node:fs'
import { mountUploads } from './uploads.mjs'
import { mountOrders } from './orders.mjs'
import { mountCatalog } from './catalog.mjs'

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

const FLAT_SHIPPING_CENTS = 800
const FREE_SHIPPING_THRESHOLD_CENTS = 3500

/** Recompute shipping from line-item subtotal (cents). Do not trust client alone. */
function shippingCentsForSubtotal(subtotalCents) {
  const cents = Math.max(0, Math.round(Number(subtotalCents) || 0))
  return cents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS
}

function merchandiseSubtotalCents(items) {
  return items.reduce((sum, item) => {
    const amountCents = Math.round(Number(item.amountCents))
    const quantity = Math.max(1, Math.round(Number(item.quantity) || 1))
    if (!Number.isFinite(amountCents) || amountCents < 1) return sum
    return sum + amountCents * quantity
  }, 0)
}


const secret = loadSecret()

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))

mountUploads(app)
mountOrders(app)
mountCatalog(app)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, stripe: Boolean(secret) })
})

app.get('/api/checkout-session/:id', async (req, res) => {
  if (!secret) {
    return res.status(503).json({ error: 'missing_stripe_key' })
  }
  const id = String(req.params.id || '')
  if (!id.startsWith('cs_')) {
    return res.status(400).json({ error: 'invalid_session_id' })
  }
  try {
    const stripe = new Stripe(secret)
    const session = await stripe.checkout.sessions.retrieve(id, {
      expand: ['line_items'],
    })
    const lineItems = session.line_items?.data ?? []
    return res.json({
      id: session.id,
      payment_status: session.payment_status,
      customer_email: session.customer_email ?? session.customer_details?.email ?? null,
      amount_total: session.amount_total,
      metadata: session.metadata ?? {},
      line_items: lineItems.map((li) => ({
        description: li.description ?? 'Item',
        quantity: li.quantity ?? 1,
        amount_total: li.amount_total ?? null,
        amount_subtotal: li.amount_subtotal ?? null,
        unit_amount: li.price?.unit_amount ?? null,
        currency: li.currency ?? li.price?.currency ?? 'usd',
      })),
    })
  } catch (err) {
    console.error('[stripe-checkout] retrieve', err)
    const message = err instanceof Error ? err.message : 'retrieve_failed'
    return res.status(500).json({ error: message })
  }
})

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
    cartSnapshot,
  } = req.body ?? {}

  if (!email || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'invalid_body' })
  }

  const origin = resolveReturnOrigin(returnOrigin)

  try {
    const stripe = new Stripe(secret)

    const line_items = items.map((item) => {
      const name = String(item.name || 'Item')
      const amountCents = Math.round(Number(item.amountCents))
      const quantity = Math.max(1, Math.round(Number(item.quantity) || 1))
      if (!Number.isFinite(amountCents) || amountCents < 1) {
        throw new Error(`invalid_amount: ${name}`)
      }
      return {
        quantity,
        price_data: {
          currency: 'usd',
          unit_amount: amountCents,
          product_data: {
            name,
            ...(item.productId
              ? { metadata: { productId: String(item.productId) } }
              : {}),
          },
        },
      }
    })

    const shipping = {
      address: String(address || ''),
      city: String(city || ''),
      state: String(state || ''),
      zip: String(zip || ''),
    }

    const snapshotSource = Array.isArray(cartSnapshot)
      ? cartSnapshot
      : items.map((item) => ({
          name: String(item.name || 'Item'),
          price:
            Number.isFinite(Number(item.price))
              ? Number(item.price)
              : Math.round(Number(item.amountCents) || 0) / 100,
          qty: Math.max(1, Math.round(Number(item.quantity) || 1)),
        }))

    const cartJson = truncateMeta(
      JSON.stringify(
        snapshotSource.map((row) => ({
          name: String(row.name || 'Item'),
          price: Number(row.price) || 0,
          qty: Math.max(1, Math.round(Number(row.qty ?? row.quantity) || 1)),
        })),
      ),
    )

    const subtotalCents = merchandiseSubtotalCents(items)
    const shippingFeeCents = shippingCentsForSubtotal(subtotalCents)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: String(email),
      line_items,
      shipping_address_collection: { allowed_countries: ['US'] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: shippingFeeCents,
              currency: 'usd',
            },
            display_name:
              shippingFeeCents === 0 ? 'Free shipping' : 'Standard shipping',
          },
        },
      ],
      success_url: `${origin}/checkout?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?canceled=1`,
      metadata: {
        email: truncateMeta(String(email || '')),
        fullName: truncateMeta(String(fullName || '')),
        shipping: truncateMeta(JSON.stringify(shipping)),
        cartJson,
        shippingCents: String(shippingFeeCents),
        subtotalCents: String(subtotalCents),
      },
    })

    if (!session.url) {
      return res.status(502).json({ error: 'no_checkout_url' })
    }

    return res.json({ url: session.url, id: session.id })
  } catch (err) {
    console.error('[stripe-checkout]', err)
    const message = err instanceof Error ? err.message : 'checkout_failed'
    return res.status(500).json({ error: message })
  }
})

app.listen(PORT, () => {
  console.log(
    `[stripe-checkout] listening on http://127.0.0.1:${PORT} (ORIGIN=${DEFAULT_ORIGIN}, stripe=${Boolean(secret)})`,
  )
  if (!secret) {
    console.warn(
      '[stripe-checkout] STRIPE_SECRET_KEY not set — /api/create-checkout-session returns 503',
    )
  }
})
