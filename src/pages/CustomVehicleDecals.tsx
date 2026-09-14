import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Upload } from 'lucide-react'
import GraphicsLogo from '../components/GraphicsLogo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { uploadCustomArtwork, validateCustomArtworkFile } from '../lib/uploadCustomArtwork'

export default function CustomVehicleDecals() {
  useDocumentTitle('Large vehicle decals')
  const [vehicle, setVehicle] = useState('Car')
  const [placement, setPlacement] = useState('')
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [details, setDetails] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [art, setArt] = useState<{ id: string; url: string; fileName: string } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  async function selectArtwork(file?: File) {
    if (!file) return
    const invalid = validateCustomArtworkFile(file)
    if (invalid) { setError(invalid); return }
    setError('')
    setUploading(true)
    setArt(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    try {
      const uploaded = await uploadCustomArtwork(file)
      setArt({ id: uploaded.id, url: uploaded.url, fileName: uploaded.fileName })
      setPreview(uploaded.previewDataUrl ? null : file.type === 'image/svg+xml' ? null : URL.createObjectURL(file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload artwork.')
    } finally { setUploading(false) }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (sending || uploading) return
    const w = Number(width), h = Number(height), qty = Number(quantity)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || w > 600 || h > 600 ||
        !Number.isInteger(qty) || qty < 1 || qty > 20) {
      setError('Enter positive dimensions up to 600 inches and a quantity from 1 to 20.')
      return
    }
    setError('')
    setSending(true)
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: name.trim(), email: email.trim() },
          items: [{
            name: 'Large vehicle decals',
            qty,
            estimate: 0,
            custom: {
              type: 'vehicle-decal',
              estimateOnly: true,
              vehicleType: vehicle,
              decalPlacement: placement.trim(),
              decalWidthIn: w,
              decalHeightIn: h,
              decalNotes: details.trim(),
              artworkUrl: art?.url,
              artworkId: art?.id,
              artworkFileName: art?.fileName,
              logoComingByEmail: !art,
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/custom" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-mute hover:text-cyan"><ArrowLeft className="h-4 w-4" /> Back to Custom</Link>
      <div className="mt-4"><GraphicsLogo size="xl" /></div>
      <p className="mt-6 text-xs font-extrabold uppercase tracking-widest text-cyan">Inkcredible Graphics · made to fit your ride</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Large Vehicle Decals</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-mute">Window lettering, door logos, hood graphics, and larger custom vinyl for cars, trucks, trailers, and work vehicles. Tell us what you want and we’ll review the art, fit, material, and price before production.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {[
          ['01', 'Tell us the spot', 'Choose the vehicle and where the decal will go. Measure the usable flat area in inches.'],
          ['02', 'Send your artwork', 'Upload a logo or design if you have one. If you need a design made, describe it below.'],
          ['03', 'Approve your quote', 'We’ll email your final price, shipping or installation options, and a proof before printing.'],
        ].map(([number, title, copy]) => <div key={number} className="rounded-3xl border border-line bg-ink-2 p-5"><span className="font-display text-2xl text-cyan">{number}</span><h2 className="mt-2 font-display text-xl">{title}</h2><p className="mt-2 text-sm text-mute">{copy}</p></div>)}
      </div>
      {code ? <div role="status" className="mt-8 rounded-3xl border border-lime/50 bg-lime/10 p-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-lime" /><h2 className="mt-3 font-display text-2xl">Request received</h2><p className="mt-2 text-mute">Save your quote code: <strong className="text-cream">{code}</strong>. We’ll contact you by email with pricing and next steps.</p></div> :
      <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-3xl border border-line bg-ink-2 p-5 sm:p-7">
          <h2 className="font-display text-2xl">The decal</h2>
          <label className="block text-sm font-bold">Vehicle type<select value={vehicle} onChange={e => setVehicle(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream"><option>Car</option><option>Truck</option><option>Van</option><option>Trailer</option><option>Other</option></select></label>
          <label className="block text-sm font-bold">Where will it go? <span className="text-pink">*</span><input required maxLength={120} value={placement} onChange={e => setPlacement(e.target.value)} placeholder="Rear window, both doors, hood…" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-bold">Width (inches)<input required type="number" min="0.1" max="600" step="0.1" value={width} onChange={e => setWidth(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
            <label className="block text-sm font-bold">Height (inches)<input required type="number" min="0.1" max="600" step="0.1" value={height} onChange={e => setHeight(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          </div>
          <label className="block text-sm font-bold">How many?<input required type="number" min="1" max="20" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          <label className="block text-sm font-bold">Colors, material, installation, or design notes<textarea rows={5} maxLength={1200} value={details} onChange={e => setDetails(e.target.value)} placeholder="Vehicle year/model, color, cut lettering or full color, one side or both…" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
        </section>
        <section className="space-y-5 rounded-3xl border border-line bg-ink-2 p-5 sm:p-7">
          <h2 className="font-display text-2xl">Artwork & contact</h2>
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cyan/40 p-5 text-center hover:border-cyan"><Upload className="mb-2 h-7 w-7 text-cyan" /><span className="font-bold">Upload artwork (optional)</span><span className="mt-1 text-xs text-mute">PNG, JPG, WebP, GIF, SVG · up to 12MB</span><input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={e => { void selectArtwork(e.target.files?.[0]); e.target.value = '' }} /></label>
          {uploading && <p role="status" className="text-sm text-cyan">Uploading artwork…</p>}
          {art && <div className="rounded-xl border border-line bg-ink p-3 text-sm"><p className="break-all text-lime">Attached: {art.fileName}</p>{preview && <img src={preview} alt="Your uploaded artwork preview" className="mt-3 max-h-48 w-full object-contain" />}</div>}
          <p className="text-xs text-mute">The preview is for reference. Final size and art will be confirmed in your proof.</p>
          <label className="block text-sm font-bold">Your name<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} autoComplete="name" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          <label className="block text-sm font-bold">Email<input required type="email" maxLength={180} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          <p className="rounded-xl border border-cyan/30 bg-cyan/10 p-4 text-sm text-mute">Free quote request. No payment today. Price depends on size, artwork, material, quantity, and delivery or installation.</p>
          {error && <p role="alert" className="rounded-xl border border-pink/40 bg-pink/10 p-3 text-sm text-pink">{error}</p>}
          <button disabled={sending || uploading} className="btn-primary min-h-12 w-full disabled:opacity-50" type="submit">{sending ? 'Sending request…' : 'Request my free quote'}</button>
        </section>
      </form>}
    </div>
  )
}
