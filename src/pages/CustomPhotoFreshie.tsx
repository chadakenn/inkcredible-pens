import { useCallback, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { ArrowLeft, ImagePlus, ShoppingBag, Sparkles, Trash2, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Product } from '../data/products'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  sanitizeCustomMeta,
  uploadCustomArtwork,
  validateCustomArtworkFile,
} from '../lib/uploadCustomArtwork'
import { useCart } from '../store/cart'
import { useScents } from '../store/scents'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg'
const PRICE = 10

export default function CustomPhotoFreshie() {
  useDocumentTitle('Custom photo freshie')
  const addItem = useCart((state) => state.addItem)
  const scents = useScents((state) => state.scents)
  const fileRef = useRef<HTMLInputElement>(null)
  const [scent, setScent] = useState('')
  const [note, setNote] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [logoPreviewData, setLogoPreviewData] = useState<string | null>(null)
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null)
  const [artworkId, setArtworkId] = useState<string | null>(null)
  const [artworkFileName, setArtworkFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearPhoto = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setLogoPreviewData(null)
    setArtworkUrl(null)
    setArtworkId(null)
    setArtworkFileName(null)
    setError(null)
  }

  const readFile = useCallback(async (file: File) => {
    const validation = validateCustomArtworkFile(file)
    if (validation) { setError(validation); return }
    setError(null)
    setUploading(true)
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
    const localPreview = isSvg ? null : URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setArtworkUrl(null)
    setArtworkId(null)
    setArtworkFileName(null)
    setLogoPreviewData(null)
    const dataUrlPromise = new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => resolve('')
      reader.readAsDataURL(file)
    })
    try {
      const [uploaded, dataUrl] = await Promise.all([uploadCustomArtwork(file), dataUrlPromise])
      const safePreview = uploaded.previewDataUrl || dataUrl
      if (uploaded.previewDataUrl) {
        if (localPreview) URL.revokeObjectURL(localPreview)
        setPreviewUrl(uploaded.previewDataUrl)
      }
      if (safePreview && safePreview.length < 400_000) setLogoPreviewData(safePreview)
      setArtworkUrl(uploaded.url)
      setArtworkId(uploaded.id)
      setArtworkFileName(uploaded.fileName)
    } catch (reason) {
      if (localPreview) URL.revokeObjectURL(localPreview)
      setPreviewUrl(null)
      setLogoPreviewData(null)
      setArtworkUrl(null)
      setArtworkId(null)
      setArtworkFileName(null)
      setError(reason instanceof Error ? reason.message : 'Upload failed — try again.')
    } finally {
      setUploading(false)
    }
  }, [previewUrl])

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void readFile(file)
    event.target.value = ''
  }

  const onDrop = useCallback((event: DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files?.[0]
    if (file) void readFile(file)
  }, [readFile])

  const addFreshie = () => {
    if (!artworkUrl) { setError('Upload the photo you want printed first.'); return }
    if (!scent) { setError('Choose a scent first.'); return }
    const custom = sanitizeCustomMeta({
      type: 'photo-freshie',
      photoFreshieSize: '3-inch round',
      freshieScent: scent,
      freshieNote: note.trim() || undefined,
      logoDataUrl: logoPreviewData || undefined,
      artworkUrl,
      artworkId: artworkId || undefined,
      artworkFileName: artworkFileName || undefined,
      fileName: artworkFileName || undefined,
    })
    const product: Product = {
      id: `custom-photo-freshie-${Date.now().toString(36)}`,
      name: 'Custom Round Photo Freshie',
      category: 'Custom',
      price: PRICE,
      tagline: `3-inch round · ${scent}`,
      description: 'A round scented car freshie with your photo printed in the center.',
      accent: '#c8f542',
      badge: 'Custom photo',
      art: 'freshie',
      imageUrl: logoPreviewData || undefined,
      custom,
    }
    addItem(product, 1)
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-lime/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-48 h-64 w-64 rounded-full bg-cyan/10 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Link to="/custom" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-mute hover:text-cyan">
          <ArrowLeft className="h-4 w-4" /> Back to Custom
        </Link>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-lime">
              <Sparkles className="h-3.5 w-3.5" /> Custom configurator
            </p>
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">Round Photo Freshie</h1>
            <p className="mt-2 max-w-xl text-sm text-mute sm:text-base">Upload a favorite photo, choose the scent, and Kellie will make it ready to hang.</p>
          </div>
          <p className="font-display text-3xl text-lime">$10.00</p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileRef.current?.click() }
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-6 text-center transition ${dragOver ? 'border-cyan bg-cyan/10' : 'border-line bg-ink-2 hover:border-cyan/50'}`}
            >
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={onInputChange} />
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-3 text-cyan"><Upload className="h-7 w-7" /></span>
              <div><p className="font-display text-lg text-cream">Drop your photo here or tap to upload</p><p className="mt-1 text-xs text-mute">PNG · JPG · WebP · GIF · SVG · max 12MB</p></div>
            </div>

            <div className="rounded-3xl border border-line bg-ink-2 p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-mute">3-inch round preview</p>
              <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row">
                <div className="relative flex h-56 w-56 shrink-0 items-center justify-center rounded-full border-[14px] border-lime/60 bg-ink shadow-[0_0_40px_rgba(200,245,66,0.2)] outline outline-4 outline-offset-[-8px] outline-cyan/50">
                  <div className="absolute inset-3 overflow-hidden rounded-full border-2 border-cream/50 bg-ink-3">
                    {previewUrl ? <img src={previewUrl} alt="Custom freshie photo preview" className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-mute"><ImagePlus className="h-10 w-10" /><span className="text-xs font-bold">Your photo</span></div>}
                  </div>
                  <span className="absolute -top-6 left-1/2 h-8 w-4 -translate-x-1/2 rounded-full border-4 border-lime bg-ink" />
                </div>
                <div className="text-center sm:text-left">
                  <p className="font-bold text-cream">Printed picture in the center</p>
                  <p className="mt-1 text-sm text-mute">We’ll crop it into the circle and confirm the final placement before making it.</p>
                  {artworkFileName && <p className="mt-3 max-w-xs truncate text-xs text-cyan">{artworkFileName}</p>}
                  {artworkUrl && <button type="button" onClick={clearPhoto} className="btn-ghost mt-3 min-h-11 text-sm"><Trash2 className="h-4 w-4 text-pink" /> Replace photo</button>}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-3xl border border-line bg-ink-2 p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-mute">Choose a scent</p>
              {scents.length ? <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">{scents.map((name) => <button key={name} type="button" onClick={() => { setScent(name); setError(null) }} aria-pressed={scent === name} className={`min-h-12 rounded-2xl border px-3 py-2 text-sm font-bold transition ${scent === name ? 'border-lime bg-lime text-ink' : 'border-line bg-ink text-cream hover:border-lime/50'}`}>{name}</button>)}</div> : <p className="mt-3 rounded-xl border border-pink/30 bg-pink/10 p-3 text-sm text-pink">No scents are available right now.</p>}
            </div>

            <div className="rounded-3xl border border-line bg-ink-2 p-5">
              <label htmlFor="photo-freshie-note" className="text-xs font-extrabold uppercase tracking-wider text-mute">Color or design note (optional)</label>
              <textarea id="photo-freshie-note" value={note} onChange={(event) => setNote(event.target.value.slice(0, 500))} rows={4} placeholder="Example: green glitter edge, use the whole photo if possible…" className="mt-3 w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-cream outline-none focus:border-cyan" />
            </div>

            {error && <p role="alert" className="rounded-2xl border border-pink/40 bg-pink/10 p-4 text-sm font-bold text-pink">{error}</p>}
            {uploading && <p role="status" className="rounded-2xl border border-cyan/40 bg-cyan/10 p-4 text-sm font-bold text-cyan">Saving your artwork securely…</p>}
            <button type="button" onClick={addFreshie} disabled={uploading || !scents.length} className="btn-primary min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-50"><ShoppingBag className="h-5 w-5" /> Add to cart — $10.00</button>
            <p className="text-center text-xs text-mute">Your original artwork stays protected and is attached to the paid order for Kellie.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
