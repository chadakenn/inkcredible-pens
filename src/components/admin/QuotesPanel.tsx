import { useEffect, useState } from 'react'
import { Download, Mail, RefreshCw } from 'lucide-react'
import { fetchQuotes, sendQuotePayment, type QuoteRequest } from '../../lib/quotesApi'
import { downloadAdminArtwork } from '../../lib/uploadCustomArtwork'

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function QuotesPanel() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [shipping, setShipping] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Record<string, string>>({})
  const [turnarounds, setTurnarounds] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmResend, setConfirmResend] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try { setQuotes(await fetchQuotes()) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load quotes') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const finalPriceValue = (quote: QuoteRequest) =>
    prices[quote.id] ?? (quote.finalPriceCents ? String(quote.finalPriceCents / 100) : '')
  const shippingValue = (quote: QuoteRequest) => {
    if (shipping[quote.id] != null) return shipping[quote.id]
    if (quote.shippingCents != null) return String(quote.shippingCents / 100)
    return Number(finalPriceValue(quote)) > 60 ? '0' : '8'
  }
  const messageValue = (quote: QuoteRequest) => messages[quote.id] ?? quote.managerMessage ?? ''
  const turnaroundValue = (quote: QuoteRequest) => turnarounds[quote.id] ?? quote.turnaround ?? ''

  const send = (quote: QuoteRequest) => {
    const finalPrice = Number(finalPriceValue(quote))
    const shippingPrice = Number(shippingValue(quote))
    setBusy(quote.id)
    setError(null)
    void sendQuotePayment(quote.id, {
      finalPrice,
      shipping: shippingPrice,
      managerMessage: messageValue(quote),
      turnaround: turnaroundValue(quote),
    })
      .then((updated) => {
        setQuotes((current) => current.map((item) => item.id === quote.id ? updated : item))
        setConfirmResend(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not queue payment email'))
      .finally(() => setBusy(null))
  }

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-3xl text-cream">Custom Quotes</h2>
        <p className="mt-1 text-sm text-mute">Approve pricing, include a message, and email secure Stripe checkout.</p>
      </div>
      <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-ink-2 px-4 text-sm font-extrabold text-cream">
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
      </button>
    </div>

    {error && <p className="mt-4 rounded-xl border border-pink/40 bg-pink/10 p-3 text-sm font-bold text-pink">{error}</p>}
    <ul className="mt-5 space-y-4">
      {!loading && !quotes.length && <li className="rounded-3xl border border-dashed border-line bg-ink-2 p-10 text-center text-mute">No quote requests yet.</li>}
      {quotes.map((quote) => {
        const canSend = Number(finalPriceValue(quote)) > 0 && Number(shippingValue(quote)) >= 0
        return <li key={quote.id} className="rounded-3xl border border-line bg-ink-2 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold uppercase ${quote.status === 'paid' ? 'bg-lime/15 text-lime' : quote.status === 'payment_sent' ? 'bg-cyan/15 text-cyan' : 'bg-lavender/15 text-lavender'}`}>
                {quote.status === 'requested' ? 'Needs approval' : quote.status === 'payment_sent' ? `Payment email sent${quote.paymentRevision && quote.paymentRevision > 1 ? ` · revision ${quote.paymentRevision}` : ''}` : 'Paid'}
              </span>
              <h3 className="mt-2 font-display text-2xl text-cream">{quote.customer.name}</h3>
              <p className="text-sm text-mute">{quote.customer.email} · {quote.displayCode}</p>
            </div>
            <p className="text-right text-sm text-mute">Estimate shown<br/><strong className="font-display text-xl text-cream">{money(quote.estimateTotal)}</strong></p>
          </div>

          <ul className="mt-4 space-y-2">
            {quote.items.map((item, index) => <li key={index} className="rounded-xl bg-ink p-3">
              <strong className="text-cream">{item.name} × {item.qty}</strong>
              {item.custom?.bannerNotes && <p className="text-xs text-mute">Notes: {item.custom.bannerNotes}</p>}
              {item.custom?.canvasNotes && <p className="text-xs text-mute">Notes: {item.custom.canvasNotes}</p>}
              {item.custom?.artworkUrl && <button type="button" onClick={() => void downloadAdminArtwork(item.custom!.artworkUrl!, item.custom?.artworkFileName || item.custom?.fileName || 'artwork')} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-cyan"><Download className="h-3 w-3" /> Download artwork</button>}
            </li>)}
          </ul>

          {quote.status !== 'paid' && <div className="mt-4 rounded-2xl border border-line bg-ink p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-extrabold uppercase text-mute">Final project price</span>
                <span className="flex items-center rounded-xl border border-line bg-ink-2 px-3 focus-within:border-cyan"><span className="font-bold text-lime">$</span><input type="number" min="1" step="0.01" value={finalPriceValue(quote)} onChange={(event) => setPrices((current) => ({ ...current, [quote.id]: event.target.value }))} className="min-h-12 min-w-0 flex-1 bg-transparent px-2 text-cream outline-none" /></span>
              </label>
              <label>
                <span className="mb-1 block text-xs font-extrabold uppercase text-mute">Shipping</span>
                <span className="flex items-center rounded-xl border border-line bg-ink-2 px-3 focus-within:border-cyan"><span className="font-bold text-lime">$</span><input type="number" min="0" max="500" step="0.01" value={shippingValue(quote)} onChange={(event) => setShipping((current) => ({ ...current, [quote.id]: event.target.value }))} className="min-h-12 min-w-0 flex-1 bg-transparent px-2 text-cream outline-none" /></span>
              </label>
              <label>
                <span className="mb-1 block text-xs font-extrabold uppercase text-mute">Estimated turnaround</span>
                <input value={turnaroundValue(quote)} onChange={(event) => setTurnarounds((current) => ({ ...current, [quote.id]: event.target.value }))} placeholder="Example: 7–10 business days" maxLength={120} className="min-h-12 w-full rounded-xl border border-line bg-ink-2 px-3 text-cream outline-none focus:border-cyan" />
              </label>
              <label>
                <span className="mb-1 block text-xs font-extrabold uppercase text-mute">Message to customer</span>
                <textarea value={messageValue(quote)} onChange={(event) => setMessages((current) => ({ ...current, [quote.id]: event.target.value }))} placeholder="What is included, artwork notes, or next steps…" maxLength={1000} rows={3} className="w-full rounded-xl border border-line bg-ink-2 p-3 text-cream outline-none focus:border-cyan" />
              </label>
            </div>
            <p className="mt-3 text-xs text-mute">The customer pays exactly the final price plus the shipping entered here.</p>

            {quote.status === 'payment_sent' && confirmResend !== quote.id
              ? <button type="button" disabled={busy === quote.id || !canSend} onClick={() => setConfirmResend(quote.id)} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl border border-cyan px-4 font-extrabold text-cyan disabled:opacity-40"><Mail className="h-4 w-4" /> Revise and send a new payment link</button>
              : <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy === quote.id || !canSend} onClick={() => send(quote)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-lime px-4 font-extrabold text-ink disabled:opacity-40"><Mail className="h-4 w-4" /> {busy === quote.id ? 'Creating secure checkout…' : quote.status === 'payment_sent' ? 'Confirm revision & email' : 'Approve & email payment link'}</button>
                  {quote.status === 'payment_sent' && <button type="button" onClick={() => setConfirmResend(null)} className="min-h-12 rounded-xl border border-line px-4 font-bold text-cream">Cancel</button>}
                </div>}
          </div>}

          {quote.status === 'payment_sent' && <div className="mt-4 rounded-2xl border border-cyan/40 bg-cyan/10 p-4 text-sm text-cream"><strong>Secure payment link emailed.</strong> Final price: {money((quote.finalPriceCents || 0) / 100)} · Shipping: {quote.shippingCents ? money(quote.shippingCents / 100) : 'FREE'}{quote.turnaround ? <><br/>Turnaround: {quote.turnaround}</> : null}</div>}
          {quote.status === 'paid' && <div className="mt-4 rounded-2xl border border-lime/40 bg-lime/10 p-4 text-sm text-cream"><strong>Paid and converted to an order.</strong>{quote.orderId ? <> Order record: {quote.orderId}</> : null}</div>}
        </li>
      })}
    </ul>
  </div>
}
