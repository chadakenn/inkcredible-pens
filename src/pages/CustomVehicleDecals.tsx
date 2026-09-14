import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, ImagePlus, Upload } from 'lucide-react'
import GraphicsLogo from '../components/GraphicsLogo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { uploadCustomArtwork, validateCustomArtworkFile } from '../lib/uploadCustomArtwork'

export default function CustomVehicleDecals() {
  useDocumentTitle('Large custom prints')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [art, setArt] = useState<{ id: string; url: string; fileName: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview) }, [preview])

  async function selectArtwork(file?: File) {
    if (!file) return
    const invalid = validateCustomArtworkFile(file)
    if (invalid) { setError(invalid); return }
    setError('')
    setUploading(true)
    setArt(null)
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    setPreview(null)
    try {
      const uploaded = await uploadCustomArtwork(file)
      setArt({ id: uploaded.id, url: uploaded.url, fileName: uploaded.fileName })
      setPreview(uploaded.previewDataUrl || (file.type === 'image/svg+xml' ? null : URL.createObjectURL(file)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload your image.')
    } finally { setUploading(false) }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending || uploading) return
    const w = Number(width), h = Number(height), qty = Number(quantity)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || w > 600 || h > 600 ||
        !Number.isInteger(qty) || qty < 1 || qty > 20) {
      setError('Enter a width and height up to 600 inches and a quantity from 1 to 20.')
      return
    }
    if (!art) { setError('Upload the image you want printed.'); return }
    setError('')
    setSending(true)
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: name.trim(), email: email.trim() },
          items: [{
            name: 'Large custom print',
            qty,
            estimate: 0,
            custom: {
              type: 'large-print',
              estimateOnly: true,
              printWidthIn: w,
              printHeightIn: h,
              printNotes: notes.trim(),
              artworkUrl: art.url,
              artworkId: art.id,
              artworkFileName: art.fileName,
            },
          }],
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.quoteId) throw new Error('Could not send your request. Please try again.')
      setCode(String(result.quoteId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your request.')
    } finally { setSending(false) }
  }

  return <div className="relative overflow-hidden">
    <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan/15 blur-3xl" />
    <div className="pointer-events-none absolute -right-16 top-52 h-56 w-56 rounded-full bg-pink/15 blur-3xl" />
    <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/custom" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-mute hover:text-cyan"><ArrowLeft className="h-4 w-4" /> Back to Custom</Link>
      <div className="mt-4"><GraphicsLogo size="xl" /></div>
      <p className="mt-6 text-xs font-extrabold uppercase tracking-widest text-cyan">Your image · your size</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Large Custom Prints</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-mute">Enter the finished size and upload the image you want printed. We’ll check the image quality and email you the exact price before anything is printed.</p>

      {code ? <div role="status" className="mt-8 rounded-3xl border border-lime/50 bg-lime/10 p-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-lime" /><h2 className="mt-3 font-display text-2xl">Request received</h2><p className="mt-2 text-mute">Save your quote code: <strong className="text-cream">{code}</strong>. We’ll email you with the price and proof.</p></div> :
      <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-3xl border border-line bg-ink-2 p-5 sm:p-7">
          <h2 className="font-display text-2xl">1. Pick the size</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-bold">Width (inches)<input required inputMode="decimal" type="number" min="0.1" max="600" step="0.1" value={width} onChange={e=>setWidth(e.target.value)} placeholder="24" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
            <label className="block text-sm font-bold">Height (inches)<input required inputMode="decimal" type="number" min="0.1" max="600" step="0.1" value={height} onChange={e=>setHeight(e.target.value)} placeholder="18" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          </div>
          <label className="block text-sm font-bold">Quantity<input required inputMode="numeric" type="number" min="1" max="20" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          <label className="block text-sm font-bold">Anything else? <span className="font-normal text-mute">(optional)</span><textarea rows={4} maxLength={1200} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Material, colors, cut shape, deadline, or other details…" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          <div className="rounded-2xl border border-cyan/30 bg-cyan/10 p-4"><p className="font-bold text-cyan">Exact price by email</p><p className="mt-1 text-sm text-mute">Large prints are priced by finished size, material, quantity, and artwork. There is no payment today.</p></div>
        </section>

        <section className="space-y-5 rounded-3xl border border-line bg-ink-2 p-5 sm:p-7">
          <h2 className="font-display text-2xl">2. Upload your image</h2>
          <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cyan/40 p-5 text-center transition hover:border-cyan">
            {preview ? <img src={preview} alt="Uploaded print preview" className="max-h-36 w-full object-contain" /> : <><Upload className="mb-2 h-8 w-8 text-cyan" /><span className="font-bold">Tap to upload your image</span><span className="mt-1 text-xs text-mute">PNG, JPG, WebP, GIF, or SVG · up to 12MB</span></>}
            <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={e=>{void selectArtwork(e.target.files?.[0]);e.target.value=''}} />
          </label>
          {uploading && <p role="status" className="text-sm font-bold text-cyan">Uploading image…</p>}
          {art && <div className="flex items-center gap-2 rounded-xl border border-line bg-ink p-3 text-sm text-lime"><ImagePlus className="h-4 w-4 shrink-0" /><span className="min-w-0 break-all">{art.fileName}</span></div>}
          <h2 className="pt-2 font-display text-2xl">3. Where should we send the quote?</h2>
          <label className="block text-sm font-bold">Your name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} autoComplete="name" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          <label className="block text-sm font-bold">Email<input required type="email" maxLength={180} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          {error && <p role="alert" className="rounded-xl border border-pink/40 bg-pink/10 p-3 text-sm font-bold text-pink">{error}</p>}
          <button disabled={sending||uploading} className="btn-primary min-h-12 w-full disabled:opacity-50" type="submit">{sending?'Sending request…':'Get my free quote'}</button>
        </section>
      </form>}
    </div>
  </div>
}
