/** No-payment custom quote requests and admin approval workflow. */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAdmin } from './adminAuth.mjs'
import { createRateLimiter } from './security.mjs'
import { readJsonFile, writeJsonAtomic } from './security.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const QUOTES_DIR = path.resolve(__dirname, '../data/quotes')
export const QUOTES_FILE = path.join(QUOTES_DIR, 'quotes.json')
mkdirSync(QUOTES_DIR, { recursive: true })

function readQuotes() {
  const data = readJsonFile(QUOTES_FILE)
  if (data == null) return []
  if (Array.isArray(data)) return data
  throw new Error('invalid_quotes_file')
}
function writeQuotes(quotes) { writeJsonAtomic(QUOTES_FILE, quotes, { keepBackups: 5, mode: 0o600 }) }
function clean(value, max = 500) { return String(value ?? '').trim().slice(0, max) }
function quoteCode() {
  const now = new Date()
  const date = `${String(now.getUTCFullYear()).slice(-2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`
  return `IQ-${date}-${Math.floor(1000 + Math.random() * 9000)}`
}
export function normalizeQuoteItems(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 10) throw Object.assign(new Error('invalid_items'), { code: 'invalid_items' })
  return raw.map((rawItem) => {
    const item = rawItem && typeof rawItem === 'object' ? rawItem : {}
    if (item.custom?.estimateOnly !== true) throw Object.assign(new Error('quote_items_only'), { code: 'quote_items_only' })
    return {
      name: clean(item.name || 'Custom project', 180),
      qty: Math.min(20, Math.max(1, Math.round(Number(item.qty) || 1))),
      estimate: Math.max(0, Number(item.estimate) || 0),
      custom: item.custom && typeof item.custom === 'object' ? item.custom : {},
    }
  })
}
export function quoteShippingCents(finalPriceCents) { return finalPriceCents > 6000 ? 0 : 800 }

export function listQuotes() { return [...readQuotes()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) }
export function markQuotePaid(id, orderId) {
  const quotes = readQuotes()
  const index = quotes.findIndex((quote) => quote.id === id)
  if (index < 0) return null
  quotes[index] = { ...quotes[index], status: 'paid', paidAt: new Date().toISOString(), orderId }
  writeQuotes(quotes)
  return quotes[index]
}

export function mountQuotes(app, { createPaymentSession }) {
  const requestLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, name: 'quote-request' })
  app.post('/api/quotes', requestLimiter, (req, res) => {
    try {
      const body = req.body || {}
      const email = clean(body.customer?.email, 180).toLowerCase()
      const name = clean(body.customer?.name, 120)
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_customer' })
      const items = normalizeQuoteItems(body.items)
      const quote = {
        id: `quote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        displayCode: quoteCode(), createdAt: new Date().toISOString(), status: 'requested',
        customer: { email, name, address: clean(body.customer?.address, 240), city: clean(body.customer?.city, 100), state: clean(body.customer?.state, 40), zip: clean(body.customer?.zip, 20) },
        items,
        estimateTotal: items.reduce((sum, item) => sum + item.estimate * item.qty, 0),
      }
      const quotes = readQuotes(); quotes.unshift(quote); writeQuotes(quotes)
      return res.status(201).json({ quoteId: quote.displayCode })
    } catch (error) { return res.status(400).json({ error: error?.code || 'quote_failed' }) }
  })
  app.get('/api/admin/quotes', requireAdmin, (_req, res) => res.json({ quotes: listQuotes() }))
  app.post('/api/admin/quotes/:id/send-payment', requireAdmin, async (req, res) => {
    const quotes = readQuotes()
    const index = quotes.findIndex((quote) => quote.id === String(req.params.id || ''))
    if (index < 0) return res.status(404).json({ error: 'not_found' })
    if (quotes[index].status === 'paid') return res.status(409).json({ error: 'already_paid' })
    const finalPriceCents = Math.round(Number(req.body?.finalPrice) * 100)
    if (!Number.isInteger(finalPriceCents) || finalPriceCents < 100 || finalPriceCents > 1_000_000_00) return res.status(400).json({ error: 'invalid_final_price' })
    const requestedShippingCents = req.body?.shipping == null || req.body?.shipping === ''
      ? quoteShippingCents(finalPriceCents)
      : Math.round(Number(req.body.shipping) * 100)
    if (!Number.isInteger(requestedShippingCents) || requestedShippingCents < 0 || requestedShippingCents > 50_000) return res.status(400).json({ error: 'invalid_shipping' })
    const managerMessage = clean(req.body?.managerMessage, 1000)
    const turnaround = clean(req.body?.turnaround, 120)
    try {
      const payment = await createPaymentSession(quotes[index], finalPriceCents, requestedShippingCents)
      const paymentRevision = Math.max(0, Number(quotes[index].paymentRevision) || 0) + 1
      quotes[index] = { ...quotes[index], status: 'payment_sent', finalPriceCents, shippingCents: payment.shippingCents, managerMessage, turnaround, paymentRevision, paymentUrl: payment.url, stripeSessionId: payment.sessionId, paymentSentAt: new Date().toISOString() }
      writeQuotes(quotes)
      return res.json({ quote: quotes[index] })
    } catch (error) {
      console.error('[quotes] payment session failed', error)
      return res.status(500).json({ error: error instanceof Error ? error.message : 'payment_session_failed' })
    }
  })
}
