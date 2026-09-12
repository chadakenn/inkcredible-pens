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
import { mountUploads, startRetentionJobs } from './uploads.mjs'
import { mountOrders, createPaidOrder, findOrderByStripeSession } from './orders.mjs'
import { mountTracking, startTrackingPoll } from './tracking.mjs'
import { mountCatalog, readProducts, writeProducts } from './catalog.mjs'
import { mountScents } from './scents.mjs'
import { mountCustomerFiles } from './customer-files.mjs'
import { mountProofs } from './proofs.mjs'
import { mountListingsMcp } from './listings-mcp.mjs'
import { markQuotePaid, mountQuotes, quoteShippingCents } from './quotes.mjs'
import { assertAdminPinSafeToBoot, mountAdminAuth } from './adminAuth.mjs'
import { activityMiddleware, mountActivity } from './activity.mjs'
import { mountStoreSettings } from './store-settings.mjs'
import { mountProductImageMigration } from './product-image-migration.mjs'
import { priceCart } from './pricing.mjs'
import {
  attachStripeSession,
  cleanupAbandonedCheckouts,
  findCheckoutByStripeSession,
  markCheckoutCompleted,
  newCheckoutId,
  readCheckout,
  savePendingCheckout,
} from './checkouts.mjs'
import {
  allowUnsignedWebhook,
  assertCartWithinLimits,
  configureTrustProxy,
  createRateLimiter,
  isProductionHardening,
  resolveReturnOrigin,
} from './security.mjs'

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

function truncateMeta(value, max = 500) {
  const s = String(value ?? '')
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

const secret = loadSecret()
const webhookSecret = loadWebhookSecret()

const app = express()
configureTrustProxy(app)
app.use(cors({ origin: true }))

// Stripe webhook MUST receive the raw body for signature verification.
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!secret) {
      return res.status(503).json({ error: 'missing_stripe_key' })
    }

    // Fail closed: production (or REQUIRE_STRIPE_WEBHOOK / prod ORIGIN) must have a signing secret.
    if (!webhookSecret) {
      if (isProductionHardening() || !allowUnsignedWebhook()) {
        console.error(
          '[stripe-webhook] REFUSING unsigned webhook — STRIPE_WEBHOOK_SECRET required in production',
        )
        return res.status(503).json({ error: 'webhook_secret_required' })
      }
    }

    const stripe = new Stripe(secret)
    let event
    try {
      if (webhookSecret) {
        const sig = req.headers['stripe-signature']
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
      } else if (allowUnsignedWebhook()) {
        // Local/dev only — set ALLOW_INSECURE_WEBHOOK=1 intentionally; never in production.
        console.warn(
          '[stripe-webhook] STRIPE_WEBHOOK_SECRET missing — parsing body without verify (ALLOW_INSECURE_WEBHOOK / local)',
        )
        event = JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body)
      } else {
        console.error('[stripe-webhook] unsigned webhook blocked')
        return res.status(503).json({ error: 'webhook_secret_required' })
      }
    } catch (err) {
      console.error('[stripe-webhook] verify failed', err)
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    try {
      if (
        event.type === 'checkout.session.completed' ||
        event.type === 'checkout.session.async_payment_succeeded'
      ) {
        const session = event.data.object
        // Do not mark Paid until Stripe says paid (async methods may complete unpaid).
        if (session.payment_status !== 'paid') {
          console.warn(
            '[stripe-webhook]',
            event.type,
            session.id,
            'payment_status=',
            session.payment_status,
            '— skipping paid-order create',
          )
        } else {
          await fulfillCheckoutSession(session)
        }
      } else if (event.type === 'checkout.session.async_payment_failed') {
        console.warn(
          '[stripe-webhook] async_payment_failed',
          event.data.object?.id,
        )
      }
    } catch (err) {
      console.error('[stripe-webhook] handler failed', err)
      return res.status(500).json({ error: 'handler_failed' })
    }
    return res.json({ received: true })
  },
)

app.use(express.json({ limit: '2mb' }))
app.use(activityMiddleware)

mountAdminAuth(app)
mountActivity(app)
mountStoreSettings(app)
mountUploads(app)
mountCustomerFiles(app)
mountOrders(app)
mountProofs(app)
mountTracking(app)
mountCatalog(app)
mountProductImageMigration(app)
mountScents(app)
mountListingsMcp(app)
mountQuotes(app, { createPaymentSession: createQuotePaymentSession })

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    stripe: Boolean(secret),
    webhook: Boolean(webhookSecret),
    productionHardening: isProductionHardening(),
    trackingConfigured: Boolean(
      typeof process.env.TRACK17_API_KEY === 'string' &&
        process.env.TRACK17_API_KEY.trim(),
    ),
  })
})

/**
 * Public-ish success lookup: order number + status only (no full PII dump).
 */
app.get('/api/checkout/session/:id', async (req, res) => {
  const id = String(req.params.id || '')
  if (!id.startsWith('cs_')) {
    return res.status(400).json({ error: 'invalid_session_id' })
  }

  const order = findOrderByStripeSession(id)
  if (order) {
    return res.json({
      sessionId: id,
      status: 'paid',
      orderId: order.displayCode || order.id,
      orderStatus: order.status,
      total: order.total,
      paymentConfirmed: true,
    })
  }

  // If webhook lagged: confirm payment_status=paid via Stripe API and fulfill safely.
  if (secret) {
    try {
      const stripe = new Stripe(secret)
      const session = await stripe.checkout.sessions.retrieve(id)
      if (session.payment_status === 'paid') {
        try {
          const fulfilled = fulfillCheckoutSession(session)
          return res.json({
            sessionId: id,
            status: 'paid',
            orderId: fulfilled.displayCode || fulfilled.id,
            orderStatus: fulfilled.status,
            total: fulfilled.total,
            paymentConfirmed: true,
            confirmedVia: 'stripe_api',
          })
        } catch (err) {
          // Pending checkout missing or race — still do not invent a paid order id
          console.error('[checkout-session] fulfill after Stripe confirm failed', err)
          return res.json({
            sessionId: id,
            status: 'pending_confirmation',
            orderId: null,
            paymentConfirmed: false,
            stripePaymentStatus: session.payment_status,
            message: 'Payment seen at Stripe; order not ready yet. Refresh shortly.',
          })
        }
      }
      const ps = session.payment_status
      return res.json({
        sessionId: id,
        status:
          ps === 'processing'
            ? 'processing'
            : 'pending_confirmation',
        orderId: null,
        paymentConfirmed: false,
        stripePaymentStatus: ps,
        message:
          ps === 'processing'
            ? 'Payment is still processing. Refresh shortly — order is not marked Paid yet.'
            : undefined,
      })
    } catch (err) {
      console.error('[checkout-session] stripe retrieve failed', err)
    }
  }

  const pending = findCheckoutByStripeSession(id)
  if (pending) {
    const paid = pending.status === 'completed' && pending.orderId
    return res.json({
      sessionId: id,
      status: paid ? 'paid' : 'pending_confirmation',
      orderId: pending.orderId ?? null,
      orderStatus: paid ? 'new' : 'pending',
      checkoutId: pending.id,
      paymentConfirmed: Boolean(paid),
    })
  }

  return res.status(404).json({
    error: 'not_found',
    sessionId: id,
    status: 'unknown',
    paymentConfirmed: false,
  })
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
      orderId: order.displayCode || order.id,
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

/**
 * Prefer Stripe Checkout finalized customer/shipping over the pre-Stripe pending checkout.
 * App contact/shipping fields are prefill / fallback only — Stripe shipping_address_collection
 * is the authority when present.
 */
function customerFromStripeSession(session, fallback) {
  const fb = fallback && typeof fallback === 'object' ? fallback : {}
  const shipping = session.shipping_details
  const details = session.customer_details
  const addr =
    (shipping && shipping.address) ||
    (details && details.address) ||
    null

  const line1 = addr?.line1 ? String(addr.line1).trim() : ''
  const line2 = addr?.line2 ? String(addr.line2).trim() : ''
  const street = [line1, line2].filter(Boolean).join(', ')

  return {
    email: String(details?.email || fb.email || ''),
    name: String(
      (shipping && shipping.name) || details?.name || fb.name || '',
    ),
    address: street || String(fb.address || ''),
    city: String(addr?.city || fb.city || ''),
    state: String(addr?.state || fb.state || ''),
    zip: String(addr?.postal_code || fb.zip || ''),
  }
}

function decrementTrackedInventory(lines) {
  const products = readProducts()
  let changed = false
  for (const line of Array.isArray(lines) ? lines : []) {
    const catalogId = String(line.catalogId || line.custom?.catalogId || line.productId || '')
      .split('__scent__')[0]
      .split('__option__')[0]
    const product = products.find((item) => item.id === catalogId)
    if (!product || !Number.isInteger(product.inventoryQuantity)) continue
    product.inventoryQuantity = Math.max(0, product.inventoryQuantity - Math.max(1, Number(line.quantity) || 1))
    changed = true
  }
  if (changed) writeProducts(products)
}

function fulfillCheckoutSession(session) {
  const sessionId = session.id

  if (session.payment_status !== 'paid') {
    const err = new Error(`payment_not_paid:${session.payment_status || 'unknown'}`)
    err.code = 'payment_not_paid'
    err.payment_status = session.payment_status
    throw err
  }

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
  const items = Array.isArray(pending.orderItems) && pending.orderItems.length
    ? pending.orderItems
    : lines.map((line) => ({
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

  // Stripe finalized shipping/customer wins; pending checkout is fallback only.
  const customer = customerFromStripeSession(session, pending.customer)

  const { order, created } = createPaidOrder({
    id: `stripe-${sessionId}`,
    stripeSessionId: sessionId,
    checkoutId: pending.id,
    customer,
    items,
    total,
    shippingCents: pending.shippingCents,
    subtotalCents: pending.subtotalCents,
    status: 'new',
    paid: true,
  })

  if (created) decrementTrackedInventory(lines)

  markCheckoutCompleted(pending.id, {
    orderId: order.id,
    stripeSessionId: sessionId,
  })
  if (pending.quoteId) markQuotePaid(pending.quoteId, order.id)
  return order
}

async function createQuotePaymentSession(quote, finalPriceCents, requestedShippingCents) {
  if (!secret) throw new Error('missing_stripe_key')
  const shippingCents = Number.isInteger(requestedShippingCents)
    ? requestedShippingCents
    : quoteShippingCents(finalPriceCents)
  const checkoutId = newCheckoutId()
  const quantity = quote.items.reduce((sum, item) => sum + Math.max(1, Number(item.qty) || 1), 0)
  const estimatedTotal = quote.items.reduce((sum, item) => sum + Math.max(0, Number(item.estimate) || 0) * Math.max(1, Number(item.qty) || 1), 0)
  const summary = quote.items.map((item) => `${item.name} x${item.qty}`).join('; ').slice(0, 500)
  const orderItems = quote.items.map((item) => ({
    name: item.name,
    qty: item.qty,
    price: estimatedTotal > 0
      ? (finalPriceCents / 100) * Math.max(0, Number(item.estimate) || 0) / estimatedTotal
      : (finalPriceCents / 100) / quantity,
    custom: item.custom,
  }))
  savePendingCheckout({
    id: checkoutId, status: 'pending', quoteId: quote.id, customer: quote.customer,
    lines: [{ productId: quote.id, name: `Custom quote ${quote.displayCode}`, description: summary, quantity: 1, unitAmountCents: finalPriceCents, custom: { quoteId: quote.id } }],
    orderItems, subtotalCents: finalPriceCents, shippingCents, totalCents: finalPriceCents + shippingCents,
  })
  const stripe = new Stripe(secret)
  if (quote.stripeSessionId) {
    try {
      const previous = await stripe.checkout.sessions.retrieve(quote.stripeSessionId)
      if (previous.status === 'open') await stripe.checkout.sessions.expire(quote.stripeSessionId)
    } catch (error) {
      console.warn('[quotes] previous Stripe session could not be expired', quote.displayCode, error instanceof Error ? error.message : error)
    }
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', customer_email: quote.customer.email, client_reference_id: checkoutId,
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: finalPriceCents, product_data: { name: `Inkcredible custom project ${quote.displayCode}`, description: summary } } }],
    shipping_address_collection: { allowed_countries: ['US'] },
    shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', fixed_amount: { amount: shippingCents, currency: 'usd' }, display_name: shippingCents === 0 ? 'Free shipping' : 'Standard shipping' } }],
    success_url: `${DEFAULT_ORIGIN}/checkout?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${DEFAULT_ORIGIN}/checkout?canceled=1`,
    metadata: { checkoutId, quoteId: quote.id, shippingCents: String(shippingCents), subtotalCents: String(finalPriceCents), quotedItems: String(quantity) },
  })
  if (!session.url) throw new Error('no_checkout_url')
  attachStripeSession(checkoutId, session.id)
  return { url: session.url, sessionId: session.id, shippingCents }
}

const checkoutCreateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  name: 'create-checkout',
})

app.post('/api/create-checkout-session', checkoutCreateLimiter, async (req, res) => {
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
  if (items.some((item) => item?.config?.estimateOnly === true)) {
    return res.status(400).json({ error: 'quote_required', message: 'Estimate-only items must use the no-payment quote workflow.' })
  }

  try {
    assertCartWithinLimits(items)
  } catch (err) {
    const code = err?.code || 'invalid_cart'
    return res.status(400).json({ error: code, message: err instanceof Error ? err.message : code })
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

assertAdminPinSafeToBoot()

const BIND_HOST = '127.0.0.1'
app.listen(PORT, BIND_HOST, () => {
  const prod = isProductionHardening()
  console.log(
    `[stripe-checkout] listening on http://${BIND_HOST}:${PORT} (bound ${BIND_HOST} only — reverse proxy/tunnel is the external face; ORIGIN=${process.env.ORIGIN || DEFAULT_ORIGIN}, stripe=${Boolean(secret)}, webhook=${Boolean(webhookSecret)}, productionHardening=${prod}, trustProxy=${app.get('trust proxy')})`,
  )
  if (!secret) {
    console.warn(
      '[stripe-checkout] STRIPE_SECRET_KEY not set — /api/create-checkout-session returns 503',
    )
  }
  if (!webhookSecret) {
    if (prod) {
      console.error(
        '[stripe-checkout] FATAL CONFIG: STRIPE_WEBHOOK_SECRET missing under production hardening — webhooks return 503',
      )
    } else {
      console.warn(
        '[stripe-checkout] STRIPE_WEBHOOK_SECRET not set — use `stripe listen` or set ALLOW_INSECURE_WEBHOOK=1 for local unsigned only',
      )
    }
  }
  startRetentionJobs({ cleanupCheckouts: cleanupAbandonedCheckouts })
  startTrackingPoll()
})
