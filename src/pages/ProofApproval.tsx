import { useEffect, useState } from 'react'
import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

interface ProofView {
  orderCode: string
  customerName: string
  status: 'pending' | 'approved'
  requestedAt: string | null
  approvedAt: string | null
  message: string
  items: { name: string; qty: number; previewUrl: string | null; previewDataUrl: string | null }[]
}

export default function ProofApproval() {
  useDocumentTitle('Artwork proof')
  const { token = '' } = useParams()
  const [proof, setProof] = useState<ProofView | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetch(`/api/proofs/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { proof?: ProofView }
        if (!response.ok || !body.proof) throw new Error('This proof link is invalid or no longer available.')
        setProof(body.proof)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load proof.'))
  }, [token])

  const approve = () => {
    if (!window.confirm('Approve this exact artwork for production?')) return
    setBusy(true)
    void fetch(`/api/proofs/${encodeURIComponent(token)}/approve`, { method: 'POST' })
      .then(async (response) => {
        const body = await response.json().catch(() => ({})) as { proof?: ProofView }
        if (!response.ok || !body.proof) throw new Error('Approval could not be saved.')
        setProof(body.proof)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Approval failed.'))
      .finally(() => setBusy(false))
  }

  return <section className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
    <div className="rounded-3xl border border-line bg-ink-2 p-5 sm:p-8">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan">Inkcredible Pens</p>
      <h1 className="mt-2 font-display text-4xl text-cream">Artwork approval</h1>
      {error && <p className="mt-5 rounded-xl border border-pink/40 bg-pink/10 p-4 font-bold text-pink">{error}</p>}
      {!proof && !error && <p className="mt-8 flex items-center gap-2 text-mute"><LoaderCircle className="h-5 w-5 animate-spin" /> Loading your proof…</p>}
      {proof && <>
        <p className="mt-3 text-mute">Order <strong className="text-cream">{proof.orderCode}</strong>{proof.customerName ? ` for ${proof.customerName}` : ''}</p>
        {proof.message && <p className="mt-5 rounded-2xl border border-lavender/40 bg-lavender/10 p-4 text-cream">{proof.message}</p>}
        <div className="mt-6 space-y-5">
          {proof.items.map((item, index) => <article key={`${item.name}-${index}`} className="rounded-2xl border border-line bg-ink p-4">
            <div className="flex justify-between gap-3"><h2 className="font-display text-xl text-cream">{item.name}</h2><span className="text-sm font-bold text-mute">Qty {item.qty}</span></div>
            {(item.previewDataUrl || item.previewUrl) ? <img src={item.previewDataUrl || item.previewUrl || ''} alt={`Artwork proof for ${item.name}`} className="mt-4 max-h-[70vh] w-full rounded-xl bg-white object-contain" /> : <p className="mt-4 text-sm text-mute">This item has no online artwork preview.</p>}
          </article>)}
        </div>
        {proof.status === 'approved'
          ? <div className="mt-6 flex items-center gap-3 rounded-2xl border border-lime/40 bg-lime/10 p-5 font-bold text-lime"><CheckCircle2 className="h-6 w-6" /> Artwork approved. Inkcredible can begin production.</div>
          : <button type="button" onClick={approve} disabled={busy} className="mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lime px-5 text-lg font-extrabold text-ink disabled:opacity-50"><CheckCircle2 className="h-5 w-5" /> {busy ? 'Saving approval…' : 'Approve this artwork for production'}</button>}
        <p className="mt-4 text-xs text-mute">Only approve after checking spelling, colors, layout, and the artwork shown above.</p>
      </>}
    </div>
  </section>
}
