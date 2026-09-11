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
  const [busy, setBusy] = useState<string | null>(null)
  const load = async () => {
    setLoading(true); setError(null)
    try { setQuotes(await fetchQuotes()) } catch (err) { setError(err instanceof Error ? err.message : 'Could not load quotes') } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const finalPriceValue = (quote: QuoteRequest) => prices[quote.id] ?? (quote.finalPriceCents ? String(quote.finalPriceCents / 100) : '')

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-3xl text-cream">Custom Quotes</h2><p className="mt-1 text-sm text-mute">Review requests, enter the final project price, and email secure Stripe checkout.</p></div><button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-ink-2 px-4 text-sm font-extrabold text-cream"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>
    {error && <p className="mt-4 rounded-xl border border-pink/40 bg-pink/10 p-3 text-sm font-bold text-pink">{error}</p>}
    <ul className="mt-5 space-y-4">
      {!loading && !quotes.length && <li className="rounded-3xl border border-dashed border-line bg-ink-2 p-10 text-center text-mute">No quote requests yet.</li>}
      {quotes.map((quote) => <li key={quote.id} className="rounded-3xl border border-line bg-ink-2 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold uppercase ${quote.status === 'paid' ? 'bg-lime/15 text-lime' : quote.status === 'payment_sent' ? 'bg-cyan/15 text-cyan' : 'bg-lavender/15 text-lavender'}`}>{quote.status === 'requested' ? 'Needs price' : quote.status === 'payment_sent' ? 'Payment email queued' : 'Paid'}</span><h3 className="mt-2 font-display text-2xl text-cream">{quote.customer.name}</h3><p className="text-sm text-mute">{quote.customer.email} · {quote.displayCode}</p></div><p className="text-right text-sm text-mute">Estimate shown<br/><strong className="font-display text-xl text-cream">{money(quote.estimateTotal)}</strong></p></div>
        <ul className="mt-4 space-y-2">{quote.items.map((item, index) => <li key={index} className="rounded-xl bg-ink p-3"><strong className="text-cream">{item.name} × {item.qty}</strong>{item.custom?.bannerNotes && <p className="text-xs text-mute">Notes: {item.custom.bannerNotes}</p>}{item.custom?.canvasNotes && <p className="text-xs text-mute">Notes: {item.custom.canvasNotes}</p>}{item.custom?.artworkUrl && <button type="button" onClick={() => void downloadAdminArtwork(item.custom!.artworkUrl!, item.custom?.artworkFileName || item.custom?.fileName || 'artwork')} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-cyan"><Download className="h-3 w-3" /> Download artwork</button>}</li>)}</ul>
        {quote.status === 'requested' && <div className="mt-4 rounded-2xl border border-line bg-ink p-4"><label><span className="mb-1 block text-xs font-extrabold uppercase text-mute">Final project price</span><span className="flex max-w-xs items-center rounded-xl border border-line bg-ink-2 px-3 focus-within:border-cyan"><span className="font-bold text-lime">$</span><input type="number" min="1" step="0.01" value={finalPriceValue(quote)} onChange={(event) => setPrices((current) => ({ ...current, [quote.id]: event.target.value }))} className="min-h-12 min-w-0 flex-1 bg-transparent px-2 text-cream outline-none" /></span></label><p className="mt-2 text-xs text-mute">Shipping is added automatically: $8, or free when the final price is over $60.</p><button type="button" disabled={busy === quote.id || !(Number(finalPriceValue(quote)) > 0)} onClick={() => { const price = Number(finalPriceValue(quote)); setBusy(quote.id); setError(null); void sendQuotePayment(quote.id, price).then((updated) => setQuotes((current) => current.map((item) => item.id === quote.id ? updated : item))).catch((err) => setError(err instanceof Error ? err.message : 'Could not queue payment email')).finally(() => setBusy(null)) }} className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-lime px-4 font-extrabold text-ink disabled:opacity-40"><Mail className="h-4 w-4" /> Email final price & payment link</button></div>}
        {quote.status === 'payment_sent' && <div className="mt-4 rounded-2xl border border-cyan/40 bg-cyan/10 p-4 text-sm text-cream"><strong>Payment email queued.</strong> Final price: {money((quote.finalPriceCents || 0) / 100)} · Shipping: {quote.shippingCents ? money(quote.shippingCents / 100) : 'FREE'}</div>}
      </li>)}
    </ul>
  </div>
}
