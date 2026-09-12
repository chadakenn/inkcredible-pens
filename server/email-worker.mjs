import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonFile, writeJsonAtomic } from './security.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ORDERS_FILE = path.resolve(__dirname, '../data/orders/orders.json')
const QUOTES_FILE = path.resolve(__dirname, '../data/quotes/quotes.json')
const EMAIL_DIR = path.resolve(__dirname, '../data/email')
const STATE_FILE = path.join(EMAIL_DIR, 'email-state.json')

const API_KEY = String(process.env.RESEND_API_KEY || '').trim()
const FROM_EMAIL = String(process.env.ORDER_FROM_EMAIL || '').trim()
const OWNER_EMAILS = String(process.env.ORDER_NOTIFICATION_EMAILS || process.env.ORDER_NOTIFICATION_EMAIL || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value, index, values) => validEmail(value) && values.indexOf(value) === index)
const REPLY_TO = String(process.env.ORDER_REPLY_TO || OWNER_EMAILS[0] || '').trim()
const STORE_ORIGIN = String(process.env.ORIGIN || '').trim().replace(/\/$/, '')
const SEND_EXISTING = String(process.env.EMAIL_SEND_EXISTING_ORDERS || '') === '1'
const POLL_SECONDS = Math.min(300, Math.max(5, Math.round(Number(process.env.EMAIL_POLL_SECONDS) || 15)))
const POLL_MS = POLL_SECONDS * 1000
const BASE_RETRY_MS = 30_000
const MAX_RETRY_MS = 60 * 60 * 1000

mkdirSync(EMAIL_DIR, { recursive: true })

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0)
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function clean(value, max = 300) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, max)
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function readOrders() {
  const data = readJsonFile(ORDERS_FILE)
  if (data == null) return []
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.orders)) return data.orders
  throw new Error('unexpected_orders_shape')
}

function readQuotes() {
  const data = readJsonFile(QUOTES_FILE)
  return Array.isArray(data) ? data : []
}

function readState() {
  const data = readJsonFile(STATE_FILE)
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  if (!data.orders || typeof data.orders !== 'object' || Array.isArray(data.orders)) data.orders = {}
  return data
}

function writeState(state) {
  writeJsonAtomic(STATE_FILE, state, { keepBackups: 5 })
}

function addressText(customer) {
  const c = customer && typeof customer === 'object' ? customer : {}
  return [
    clean(c.name),
    clean(c.address),
    [clean(c.city), clean(c.state), clean(c.zip)].filter(Boolean).join(' '),
  ].filter(Boolean).join('\n')
}

const HIDDEN_CUSTOM_KEYS = new Set([
  'artworkUrl', 'artworkId', 'artworkFileName', 'fileName', 'archivedArtworkPath', 'estimateOnly',
])

const FRIENDLY_LABELS = {
  type: 'Type', style: 'Style', cut: 'Cut', stickerQty: 'Sticker quantity',
  stickerSize: 'Sticker size', stickerSizeId: 'Sticker size', bannerSizeLabel: 'Banner size',
  bannerWidthFt: 'Banner width', bannerHeightFt: 'Banner height', bannerSides: 'Banner sides',
  bannerNotes: 'Banner notes', canvasSizeLabel: 'Canvas size', canvasFinish: 'Canvas finish',
  canvasNotes: 'Canvas notes', cardPackQty: 'Card quantity', cardNotes: 'Card notes',
  photoFreshieSize: 'Freshie size', freshieScent: 'Scent', freshieNote: 'Freshie note',
  scent: 'Scent', scentName: 'Scent', selectedScent: 'Scent', color: 'Color',
  colorName: 'Color', notes: 'Notes', logoComingByEmail: 'Logo coming by email',
}

function labelFor(key) {
  return FRIENDLY_LABELS[key] || String(key)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

function customDetails(custom) {
  if (!custom || typeof custom !== 'object' || Array.isArray(custom)) return []
  const details = []
  const labels = new Set()
  for (const [key, raw] of Object.entries(custom)) {
    if (HIDDEN_CUSTOM_KEYS.has(key) || raw == null || raw === '' || typeof raw === 'object') continue
    const label = labelFor(key)
    if (labels.has(label)) continue
    labels.add(label)
    const value = typeof raw === 'boolean' ? (raw ? 'Yes' : 'No') : clean(raw, 500)
    if (value) details.push([label, value])
    if (details.length >= 12) break
  }
  const artworkName = clean(custom.artworkFileName || custom.fileName || custom.artworkId, 180)
  if (artworkName || custom.artworkUrl) details.push(['Artwork', artworkName || 'Uploaded artwork'])
  return details
}

function itemRows(order) {
  return (Array.isArray(order.items) ? order.items : []).map((item) => {
    const qty = Math.max(1, Math.round(Number(item.qty) || 1))
    const unit = Number(item.price) || 0
    return {
      name: clean(item.name || 'Item', 240), qty, unit, lineTotal: unit * qty,
      details: customDetails(item.custom),
    }
  })
}

function totals(order) {
  const total = Number(order.total) || 0
  const shipping = Number.isFinite(Number(order.shippingCents)) ? Number(order.shippingCents) / 100 : 0
  const subtotal = Number.isFinite(Number(order.subtotalCents)) ? Number(order.subtotalCents) / 100 : Math.max(0, total - shipping)
  return { subtotal, shipping, total }
}

function orderCode(order) {
  if (order.displayCode) return clean(order.displayCode, 40)
  const created = new Date(order.createdAt || 0)
  const date = Number.isFinite(created.getTime())
    ? `${String(created.getUTCFullYear()).slice(-2)}${String(created.getUTCMonth() + 1).padStart(2, '0')}${String(created.getUTCDate()).padStart(2, '0')}`
    : 'ORDER'
  let hash = 0
  for (const char of String(order.id || order.stripeSessionId || 'order')) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return `IP-${date}-${String(hash % 10000).padStart(4, '0')}`
}

function itemsHtml(rows) {
  if (!rows.length) return '<p style="color:#aaaab3;">No item details found.</p>'
  return rows.map((row) => {
    const details = row.details.length
      ? `<ul style="margin:8px 0 0;padding-left:20px;color:#c9c9d1;">${row.details.map(([k, v]) => `<li><strong>${esc(k)}:</strong> ${esc(v)}</li>`).join('')}</ul>`
      : ''
    return `<div style="padding:14px 0;border-bottom:1px solid #2b2b31;"><strong>${esc(row.name)} × ${row.qty}</strong><span style="float:right;color:#c9ff37;">${money(row.lineTotal)}</span>${details}</div>`
  }).join('')
}

function itemsText(rows) {
  return rows.map((row) => {
    const details = row.details.length ? `\n${row.details.map(([k, v]) => `    ${k}: ${v}`).join('\n')}` : ''
    return `- ${row.name} x${row.qty} — ${money(row.lineTotal)}${details}`
  }).join('\n') || 'No item details found.'
}

function ownerMessage(order) {
  const customer = order.customer && typeof order.customer === 'object' ? order.customer : {}
  const rows = itemRows(order)
  const t = totals(order)
  const code = orderCode(order)
  const address = addressText(customer)
  const adminUrl = STORE_ORIGIN ? `${STORE_ORIGIN}/admin` : ''
  const customerName = clean(customer.name, 80)
  return {
    subject: `New paid order • ${money(t.total)}${customerName ? ` • ${customerName}` : ''}`,
    html: `<!doctype html><html><body style="margin:0;background:#09090b;color:#f6f6f7;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:680px;margin:0 auto;padding:32px 18px;"><div style="border-top:4px solid #c9ff37;background:#121216;border-radius:16px;padding:28px;"><div style="font-size:12px;letter-spacing:2px;color:#26d9ff;font-weight:700;">INKCREDIBLE PENS</div><h1 style="margin:8px 0 4px;font-size:30px;">New paid order 🔥</h1><p style="color:#aaaab3;">Stripe payment confirmed. Order is saved in Store Manager.</p><div style="background:#0d0d10;border:1px solid #2b2b31;border-radius:12px;padding:16px;margin:20px 0;"><strong>Order:</strong> ${esc(code)}<br><strong>Customer:</strong> ${esc(clean(customer.name) || 'Not provided')}<br><strong>Email:</strong> ${esc(clean(customer.email) || 'Not provided')}</div><h2>Items</h2>${itemsHtml(rows)}<div style="margin-top:20px;padding-top:16px;border-top:2px solid #2b2b31;">Subtotal: ${money(t.subtotal)}<br>Shipping: ${t.shipping === 0 ? 'FREE' : money(t.shipping)}<br><strong style="font-size:22px;color:#c9ff37;">Total: ${money(t.total)}</strong></div><h2>Ship to</h2><div style="white-space:pre-line;">${esc(address || 'No shipping address found')}</div>${adminUrl ? `<p style="margin-top:28px;"><a href="${esc(adminUrl)}" style="display:inline-block;background:#c9ff37;color:#09090b;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px;">Open Store Manager</a></p>` : ''}</div></div></body></html>`,
    text: `NEW INKCREDIBLE ORDER\n\nOrder: ${code}\nCustomer: ${clean(customer.name) || 'Not provided'}\nEmail: ${clean(customer.email) || 'Not provided'}\n\nITEMS\n${itemsText(rows)}\n\nSubtotal: ${money(t.subtotal)}\nShipping: ${t.shipping === 0 ? 'FREE' : money(t.shipping)}\nTOTAL: ${money(t.total)}\n\nSHIP TO\n${address || 'No shipping address found'}${adminUrl ? `\n\nStore Manager: ${adminUrl}` : ''}`,
  }
}

function customerMessage(order) {
  const customer = order.customer && typeof order.customer === 'object' ? order.customer : {}
  const rows = itemRows(order)
  const t = totals(order)
  const code = orderCode(order)
  const address = addressText(customer)
  return {
    subject: `Inkcredible Pens order received • ${code}`,
    html: `<!doctype html><html><body style="margin:0;background:#09090b;color:#f6f6f7;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:680px;margin:0 auto;padding:32px 18px;"><div style="border-top:4px solid #ff3ea5;background:#121216;border-radius:16px;padding:28px;"><div style="font-size:12px;letter-spacing:2px;color:#26d9ff;font-weight:700;">INKCREDIBLE PENS</div><h1 style="margin:8px 0 4px;font-size:30px;">Order vibes received ✨</h1><p style="color:#aaaab3;">Your payment is confirmed and we have your order.</p><div style="background:#0d0d10;border:1px solid #2b2b31;border-radius:12px;padding:16px;margin:20px 0;"><div style="font-size:12px;color:#26d9ff;font-weight:700;">ORDER CODE</div><div style="margin-top:6px;word-break:break-all;">${esc(code)}</div></div><h2>Your order</h2>${itemsHtml(rows)}<div style="margin-top:20px;padding-top:16px;border-top:2px solid #2b2b31;">Subtotal: ${money(t.subtotal)}<br>Shipping: ${t.shipping === 0 ? 'FREE' : money(t.shipping)}<br><strong style="font-size:22px;color:#c9ff37;">Total paid: ${money(t.total)}</strong></div><h2>Shipping address</h2><div style="white-space:pre-line;">${esc(address || 'Address confirmed during checkout')}</div><p style="margin-top:26px;color:#aaaab3;">Questions or a custom-order detail to add? Reply to this email and include your order code.</p></div></div></body></html>`,
    text: `INKCREDIBLE PENS\n\nOrder vibes received! Your payment is confirmed and we have your order.\n\nOrder code: ${code}\n\nYOUR ORDER\n${itemsText(rows)}\n\nSubtotal: ${money(t.subtotal)}\nShipping: ${t.shipping === 0 ? 'FREE' : money(t.shipping)}\nTOTAL PAID: ${money(t.total)}\n\nSHIPPING ADDRESS\n${address || 'Address confirmed during checkout'}\n\nQuestions? Reply to this email and include your order code.`,
  }
}

function trackingUrl(carrier, trackingNumber) {
  const number = encodeURIComponent(clean(trackingNumber, 120))
  const key = clean(carrier, 30).toLowerCase()
  if (key === 'usps') return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`
  if (key === 'ups') return `https://www.ups.com/track?tracknum=${number}`
  if (key === 'fedex') return `https://www.fedex.com/fedextrack/?trknbr=${number}`
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier || ''} ${trackingNumber}`.trim())}`
}

function shipmentMessage(order) {
  const customer = order.customer && typeof order.customer === 'object' ? order.customer : {}
  const code = orderCode(order)
  const carrier = clean(order.trackingCarrier || 'Carrier', 40)
  const number = clean(order.trackingNumber, 120)
  const url = trackingUrl(carrier, number)
  const firstName = clean(customer.name, 80).split(' ')[0]
  return {
    subject: `Your Inkcredible Pens order has shipped • ${code}`,
    html: `<!doctype html><html><body style="margin:0;background:#09090b;color:#f6f6f7;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:680px;margin:0 auto;padding:32px 18px;"><div style="border-top:4px solid #26d9ff;background:#121216;border-radius:16px;padding:28px;"><div style="font-size:12px;letter-spacing:2px;color:#ff3ea5;font-weight:700;">INKCREDIBLE PENS</div><h1 style="margin:8px 0 4px;font-size:30px;">Your order is on the way 📦</h1><p style="color:#aaaab3;">${firstName ? `Hey ${esc(firstName)}, your` : 'Your'} order has shipped.</p><div style="background:#0d0d10;border:1px solid #2b2b31;border-radius:12px;padding:16px;margin:20px 0;"><strong>Order:</strong> ${esc(code)}<br><strong>Carrier:</strong> ${esc(carrier)}<br><strong>Tracking number:</strong> ${esc(number)}</div><p><a href="${esc(url)}" style="display:inline-block;background:#c9ff37;color:#09090b;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px;">Track your package</a></p><p style="margin-top:26px;color:#aaaab3;">Questions? Reply to this email and include your order code.</p></div></div></body></html>`,
    text: `INKCREDIBLE PENS\n\nYour order is on the way!\n\nOrder: ${code}\nCarrier: ${carrier}\nTracking number: ${number}\n\nTrack your package: ${url}\n\nQuestions? Reply to this email and include your order code.`,
  }
}

function quoteReceivedMessage(quote) {
  const code = clean(quote.displayCode || quote.id, 40)
  const firstName = clean(quote.customer?.name, 80).split(' ')[0]
  return {
    subject: `We received your Inkcredible quote request • ${code}`,
    html: `<!doctype html><html><body style="margin:0;background:#09090b;color:#f6f6f7;font-family:Arial,sans-serif"><div style="max-width:680px;margin:auto;padding:32px 18px"><div style="border-top:4px solid #26d9ff;background:#121216;border-radius:16px;padding:28px"><div style="font-size:12px;letter-spacing:2px;color:#ff3ea5;font-weight:700">INKCREDIBLE PENS</div><h1>Quote request received</h1><p>${firstName ? `Hey ${esc(firstName)}, we` : 'We'} received your custom project request. Nothing has been charged.</p><p><strong>Quote:</strong> ${esc(code)}</p><p style="color:#aaaab3">We’ll review your artwork and details, then email the final price and a secure Stripe checkout button.</p></div></div></body></html>`,
    text: `INKCREDIBLE PENS\n\nQuote request received: ${code}\n\nNothing has been charged. We’ll review your artwork and details, then email the final price and a secure Stripe checkout link.`,
  }
}

function quoteOwnerMessage(quote) {
  const code = clean(quote.displayCode || quote.id, 40)
  return {
    subject: `New quote request • ${code} • ${clean(quote.customer?.name, 80)}`,
    html: `<!doctype html><html><body style="margin:0;background:#09090b;color:#f6f6f7;font-family:Arial,sans-serif"><div style="max-width:680px;margin:auto;padding:32px 18px"><div style="border-top:4px solid #c9ff37;background:#121216;border-radius:16px;padding:28px"><div style="font-size:12px;letter-spacing:2px;color:#26d9ff;font-weight:700">INKCREDIBLE PENS</div><h1>New quote request</h1><p><strong>${esc(code)}</strong><br>${esc(clean(quote.customer?.name))}<br>${esc(clean(quote.customer?.email))}</p><p>Estimate shown: ${money(quote.estimateTotal)}</p>${STORE_ORIGIN ? `<p><a href="${esc(`${STORE_ORIGIN}/admin?tab=quotes`)}" style="display:inline-block;background:#c9ff37;color:#09090b;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:999px">Review quote</a></p>` : ''}</div></div></body></html>`,
    text: `NEW QUOTE REQUEST\n\n${code}\n${clean(quote.customer?.name)}\n${clean(quote.customer?.email)}\nEstimate shown: ${money(quote.estimateTotal)}${STORE_ORIGIN ? `\n\nReview: ${STORE_ORIGIN}/admin?tab=quotes` : ''}`,
  }
}

function quotePaymentMessage(quote) {
  const code = clean(quote.displayCode || quote.id, 40)
  const price = Number(quote.finalPriceCents || 0) / 100
  const shipping = Number(quote.shippingCents || 0) / 100
  const turnaround = clean(quote.turnaround, 120)
  const managerMessage = clean(quote.managerMessage, 1000)
  const detailsHtml = `${turnaround ? `<p><strong>Estimated turnaround:</strong> ${esc(turnaround)}</p>` : ''}${managerMessage ? `<div style="background:#0d0d10;border:1px solid #2b2b31;border-radius:12px;padding:14px;margin:18px 0"><strong>Message from Inkcredible:</strong><br>${esc(managerMessage)}</div>` : ''}`
  const detailsText = `${turnaround ? `\nEstimated turnaround: ${turnaround}` : ''}${managerMessage ? `\nMessage from Inkcredible: ${managerMessage}` : ''}`
  return {
    subject: `Your Inkcredible custom quote is ready • ${code}`,
    html: `<!doctype html><html><body style="margin:0;background:#09090b;color:#f6f6f7;font-family:Arial,sans-serif"><div style="max-width:680px;margin:auto;padding:32px 18px"><div style="border-top:4px solid #c9ff37;background:#121216;border-radius:16px;padding:28px"><div style="font-size:12px;letter-spacing:2px;color:#26d9ff;font-weight:700">INKCREDIBLE PENS</div><h1>Your quote is ready</h1><p><strong>${esc(code)}</strong></p><p>Final project price: <strong style="color:#c9ff37">${money(price)}</strong><br>Shipping: ${shipping ? money(shipping) : 'FREE'}</p>${detailsHtml}<p><a href="${esc(quote.paymentUrl)}" style="display:inline-block;background:#c9ff37;color:#09090b;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:999px">Review & pay securely</a></p><p style="color:#aaaab3">You’ll confirm your shipping address on Stripe’s secure checkout page.</p></div></div></body></html>`,
    text: `INKCREDIBLE PENS\n\nYour quote ${code} is ready.\nFinal project price: ${money(price)}\nShipping: ${shipping ? money(shipping) : 'FREE'}${detailsText}\n\nReview and pay securely: ${quote.paymentUrl}`,
  }
}

async function sendEmail({ to, subject, html, text, idempotencyKey }) {
  const payload = { from: FROM_EMAIL, to: [to], subject: clean(subject, 240), html, text }
  if (REPLY_TO) payload.reply_to = REPLY_TO
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey.slice(0, 256),
      'User-Agent': 'inkcredible-pens/1.0',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })
  const body = await response.text()
  let parsed = null
  try { parsed = body ? JSON.parse(body) : null } catch { /* plain-text error */ }
  if (!response.ok) {
    throw new Error(`resend_${response.status}:${clean(parsed?.message || parsed?.name || body || response.statusText, 300)}`)
  }
  return typeof parsed?.id === 'string' ? parsed.id : null
}

function deliveryRecord(state, orderId, kind) {
  if (!state.orders[orderId]) state.orders[orderId] = {}
  if (!state.orders[orderId][kind]) state.orders[orderId][kind] = {}
  return state.orders[orderId][kind]
}

function due(record) {
  if (record.sentAt || record.skippedAt) return false
  if (!record.nextAttemptAt) return true
  const at = new Date(record.nextAttemptAt).getTime()
  return !Number.isFinite(at) || at <= Date.now()
}

function retryDelay(attempts) {
  return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** Math.min(7, Math.max(0, attempts - 1)))
}

async function attempt(state, order, kind, to, buildMessage) {
  const record = deliveryRecord(state, order.id, kind)
  if (!due(record)) return
  if (!validEmail(to)) {
    record.skippedAt = new Date().toISOString()
    record.reason = 'missing_or_invalid_email'
    writeState(state)
    console.warn(`[email] ${kind} skipped for ${order.id}: missing/invalid recipient`)
    return
  }

  const attempts = Math.max(0, Number(record.attempts) || 0) + 1
  record.attempts = attempts
  record.lastAttemptAt = new Date().toISOString()
  delete record.nextAttemptAt
  writeState(state)

  try {
    const emailId = await sendEmail({
      to,
      ...buildMessage(order),
      idempotencyKey: `paid-order/${kind}/${order.id}`,
    })
    record.sentAt = new Date().toISOString()
    if (emailId) record.emailId = emailId
    delete record.lastError
    delete record.nextAttemptAt
    writeState(state)
    console.log(`[email] ${kind} sent for ${order.id}${emailId ? ` (${emailId})` : ''}`)
  } catch (err) {
    record.lastError = clean(err instanceof Error ? err.message : String(err), 500)
    record.nextAttemptAt = new Date(Date.now() + retryDelay(attempts)).toISOString()
    writeState(state)
    console.error(`[email] ${kind} failed for ${order.id}: ${record.lastError}`)
  }
}

function paidStripeOrder(order) {
  return Boolean(order && typeof order === 'object' && order.paid === true && order.id && order.stripeSessionId)
}

let warnedMissingConfig = false
let running = false

async function runOnce() {
  if (running) return
  running = true
  try {
    if (!API_KEY || !FROM_EMAIL) {
      if (!warnedMissingConfig) {
        const missing = [!API_KEY ? 'RESEND_API_KEY' : null, !FROM_EMAIL ? 'ORDER_FROM_EMAIL' : null].filter(Boolean)
        console.warn(`[email] disabled until configured: missing ${missing.join(', ')}`)
        warnedMissingConfig = true
      }
      return
    }

    const orders = readOrders().filter(paidStripeOrder)
    let state = readState()
    if (!state) {
      state = { version: 1, initializedAt: new Date().toISOString(), orders: {} }
      if (!SEND_EXISTING) {
        const now = new Date().toISOString()
        for (const order of orders) {
          state.orders[order.id] = {
            customer: { skippedAt: now, reason: 'preexisting_order' },
            ...(order.trackingNumber ? { shipment: { skippedAt: now, reason: 'preexisting_tracking' } } : {}),
          }
          for (const index of OWNER_EMAILS.keys()) {
            state.orders[order.id][`owner_${index + 1}`] = { skippedAt: now, reason: 'preexisting_order' }
          }
        }
        writeState(state)
        console.log(`[email] delivery state initialized; skipped ${orders.length} pre-existing paid order(s)`)
        return
      }
      writeState(state)
    }

    for (const order of [...orders].reverse()) {
      if (OWNER_EMAILS.length) {
        for (const [index, email] of OWNER_EMAILS.entries()) {
          await attempt(state, order, `owner_${index + 1}`, email, ownerMessage)
        }
      }
      else {
        const record = deliveryRecord(state, order.id, 'owner')
        if (!record.sentAt && !record.skippedAt) {
          record.skippedAt = new Date().toISOString()
          record.reason = 'ORDER_NOTIFICATION_EMAIL_not_configured'
          writeState(state)
        }
      }
      await attempt(state, order, 'customer', String(order.customer?.email || '').trim(), customerMessage)
      if (order.status === 'shipped' && order.trackingNumber) {
        await attempt(state, order, 'shipment', String(order.customer?.email || '').trim(), shipmentMessage)
      }
    }

    for (const quote of [...readQuotes()].reverse()) {
      if (quote.status === 'requested') {
        for (const [index, email] of OWNER_EMAILS.entries()) await attempt(state, quote, `quote_owner_${index + 1}`, email, quoteOwnerMessage)
        await attempt(state, quote, 'quote_received', String(quote.customer?.email || '').trim(), quoteReceivedMessage)
      }
      if (quote.status === 'payment_sent' && quote.paymentUrl) {
        const revision = Math.max(1, Number(quote.paymentRevision) || 1)
        const kind = revision === 1 ? 'quote_payment' : `quote_payment_${revision}`
        await attempt(state, quote, kind, String(quote.customer?.email || '').trim(), quotePaymentMessage)
      }
    }
  } catch (err) {
    console.error('[email] worker cycle failed', err)
  } finally {
    running = false
  }
}

console.log(`[email] worker started (poll=${POLL_SECONDS}s, from=${FROM_EMAIL || 'not configured'}, owners=${OWNER_EMAILS.length}, sendExisting=${SEND_EXISTING})`)
await runOnce()
setInterval(() => { void runOnce() }, POLL_MS)
