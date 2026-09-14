import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ImagePlus, ShoppingBag, Upload } from 'lucide-react'
import type { Product } from '../data/products'
import GraphicsLogo from '../components/GraphicsLogo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useCart } from '../store/cart'
import { sanitizeCustomMeta, uploadCustomArtwork, validateCustomArtworkFile } from '../lib/uploadCustomArtwork'

const PRICE_PER_SQFT = 12
const MINIMUM_PRICE = 15

export default function CustomVehicleDecals() {
  useDocumentTitle('Large custom prints')
  const addItem = useCart((s) => s.addItem)
  const [width, setWidth] = useState('')
  const [height, setHeight] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [art, setArt] = useState<{ id: string; url: string; fileName: string; previewData?: string } | null>(null)
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number; vector: boolean } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const widthIn = Number(width)
  const heightIn = Number(height)
  const qty = Number(quantity)
  const validSize = Number.isFinite(widthIn) && Number.isFinite(heightIn) && widthIn > 0 && heightIn > 0 && widthIn <= 600 && heightIn <= 600
  const squareFeet = validSize ? (widthIn * heightIn) / 144 : 0
  const unitPrice = useMemo(() => validSize ? Math.round(Math.max(MINIMUM_PRICE, squareFeet * PRICE_PER_SQFT) * 100) / 100 : MINIMUM_PRICE, [validSize, squareFeet])
  const total = unitPrice * (Number.isInteger(qty) && qty > 0 ? qty : 1)
  const estimatedDpi = useMemo(() => {
    if (!validSize || !imageInfo || imageInfo.vector) return null
    const normal = Math.min(imageInfo.width / widthIn, imageInfo.height / heightIn)
    const rotated = Math.min(imageInfo.width / heightIn, imageInfo.height / widthIn)
    return Math.round(Math.max(normal, rotated))
  }, [validSize, imageInfo, widthIn, heightIn])
  const quality = imageInfo?.vector ? 'vector' : estimatedDpi == null ? null : estimatedDpi >= 150 ? 'good' : estimatedDpi >= 100 ? 'caution' : 'blurry'

  useEffect(() => () => { if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview) }, [preview])

  async function selectArtwork(file?: File) {
    if (!file) return
    const invalid = validateCustomArtworkFile(file)
    if (invalid) { setError(invalid); return }
    setError('')
    setUploading(true)
    setArt(null)
    setImageInfo(null)
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview)
    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)
    const localPreview = isSvg ? null : URL.createObjectURL(file)
    setPreview(localPreview)
    if (isSvg) {
      setImageInfo({ width: 0, height: 0, vector: true })
    } else if (localPreview) {
      const image = new Image()
      image.onload = () => setImageInfo({ width: image.naturalWidth, height: image.naturalHeight, vector: false })
      image.onerror = () => setImageInfo(null)
      image.src = localPreview
    }
    const dataUrlPromise = new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => resolve('')
      reader.readAsDataURL(file)
    })
    try {
      const [uploaded, dataUrl] = await Promise.all([uploadCustomArtwork(file), dataUrlPromise])
      const safePreview = uploaded.previewDataUrl || (dataUrl.length < 400_000 ? dataUrl : '')
      setArt({ id: uploaded.id, url: uploaded.url, fileName: uploaded.fileName, previewData: safePreview || undefined })
      if (uploaded.previewDataUrl) {
        if (localPreview) URL.revokeObjectURL(localPreview)
        setPreview(uploaded.previewDataUrl)
      }
    } catch (err) {
      if (localPreview) URL.revokeObjectURL(localPreview)
      setPreview(null)
      setError(err instanceof Error ? err.message : 'Could not upload your image.')
    } finally { setUploading(false) }
  }

  function addToCart() {
    if (!validSize) { setError('Enter a width and height up to 600 inches.'); return }
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) { setError('Enter a quantity from 1 to 20.'); return }
    if (!art) { setError('Upload the image you want printed.'); return }
    setError('')
    const sizeLabel = `${widthIn}×${heightIn} in`
    const custom = sanitizeCustomMeta({
      type: 'large-print',
      printWidthIn: widthIn,
      printHeightIn: heightIn,
      printNotes: notes.trim() || undefined,
      artworkPixelWidth: imageInfo && !imageInfo.vector ? imageInfo.width : undefined,
      artworkPixelHeight: imageInfo && !imageInfo.vector ? imageInfo.height : undefined,
      estimatedPrintDpi: estimatedDpi ?? undefined,
      artworkQuality: quality ?? undefined,
      fileName: art.fileName,
      logoDataUrl: art.previewData,
      artworkUrl: art.url,
      artworkId: art.id,
      artworkFileName: art.fileName,
    })
    const product: Product = {
      id: `custom-large-print-${Date.now().toString(36)}`,
      name: `Large Custom Print — ${sizeLabel}`,
      category: 'Custom',
      price: unitPrice,
      tagline: `${sizeLabel} · $12/sq ft · $15 minimum`,
      description: notes.trim() ? `Large custom print (${sizeLabel}). Notes: ${notes.trim()}` : `Large custom print (${sizeLabel}).`,
      accent: '#22d3ee',
      art: 'sticker',
      imageUrl: art.previewData,
      badge: 'Custom',
      custom,
    }
    addItem(product, qty)
  }

  return <div className="relative overflow-hidden">
    <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan/15 blur-3xl" />
    <div className="pointer-events-none absolute -right-16 top-52 h-56 w-56 rounded-full bg-pink/15 blur-3xl" />
    <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link to="/custom" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-mute hover:text-cyan"><ArrowLeft className="h-4 w-4" /> Back to Custom</Link>
      <div className="mt-4"><GraphicsLogo size="xl" /></div>
      <p className="mt-6 text-xs font-extrabold uppercase tracking-widest text-cyan">Your image · your size</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Large Custom Prints</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-mute">Enter the finished size, upload your image, and order it online. We’ll check image quality and send a proof before printing.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="space-y-5 rounded-3xl border border-line bg-ink-2 p-5 sm:p-7">
          <h2 className="font-display text-2xl">1. Pick the size</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-bold">Width (inches)<input required inputMode="decimal" type="number" min="0.1" max="600" step="0.1" value={width} onChange={e=>setWidth(e.target.value)} placeholder="24" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
            <label className="block text-sm font-bold">Height (inches)<input required inputMode="decimal" type="number" min="0.1" max="600" step="0.1" value={height} onChange={e=>setHeight(e.target.value)} placeholder="18" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          </div>
          <label className="block text-sm font-bold">Quantity<input required inputMode="numeric" type="number" min="1" max="20" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)} className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>
          <label className="block text-sm font-bold">Anything else? <span className="font-normal text-mute">(optional)</span><textarea rows={4} maxLength={1200} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Cut shape, deadline, colors, or other details…" className="mt-2 w-full rounded-xl border border-line bg-ink p-3 text-cream" /></label>

          <div className="rounded-2xl border border-lime/40 bg-lime/10 p-5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-lime">Your price</p>
            <p className="mt-1 font-display text-4xl text-lime">${total.toFixed(2)}</p>
            <p className="mt-2 text-sm text-mute">{validSize ? `${squareFeet.toFixed(2)} sq ft × $${PRICE_PER_SQFT}${qty > 1 ? ` × ${qty} prints` : ''}` : `$${MINIMUM_PRICE} minimum per print`}</p>
            {validSize && unitPrice === MINIMUM_PRICE && <p className="mt-1 text-xs text-mute">The $15 minimum applies to this size.</p>}
          </div>
        </section>

        <section className="space-y-5 rounded-3xl border border-line bg-ink-2 p-5 sm:p-7">
          <h2 className="font-display text-2xl">2. Upload your image</h2>
          <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cyan/40 p-5 text-center transition hover:border-cyan">
            {preview ? <img src={preview} alt="Uploaded print preview" className="max-h-36 w-full object-contain" /> : <><Upload className="mb-2 h-8 w-8 text-cyan" /><span className="font-bold">Tap to upload your image</span><span className="mt-1 text-xs text-mute">PNG, JPG, WebP, GIF, or SVG · up to 12MB</span></>}
            <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={e=>{void selectArtwork(e.target.files?.[0]);e.target.value=''}} />
          </label>
          {uploading && <p role="status" className="text-sm font-bold text-cyan">Uploading image…</p>}
          {art && <div className="flex items-center gap-2 rounded-xl border border-line bg-ink p-3 text-sm text-lime"><ImagePlus className="h-4 w-4 shrink-0" /><span className="min-w-0 break-all">{art.fileName}</span></div>}
          {art && imageInfo && <div className={`rounded-2xl border p-4 ${quality === 'good' || quality === 'vector' ? 'border-lime/40 bg-lime/10' : quality === 'caution' ? 'border-amber-300/50 bg-amber-300/10' : quality === 'blurry' ? 'border-pink/50 bg-pink/10' : 'border-line bg-ink'}`}>
            <p className={`font-extrabold ${quality === 'good' || quality === 'vector' ? 'text-lime' : quality === 'caution' ? 'text-amber-200' : 'text-pink'}`}>{quality === 'vector' ? 'Excellent — vector artwork' : quality === 'good' ? 'Good print quality' : quality === 'caution' ? 'Use with caution' : quality === 'blurry' ? 'Likely to look blurry' : 'Enter a size to check quality'}</p>
            {imageInfo.vector ? <p className="mt-1 text-sm text-mute">SVG artwork can scale cleanly to large sizes.</p> : <><p className="mt-1 text-sm text-mute">{imageInfo.width} × {imageInfo.height} pixels{estimatedDpi ? ` · about ${estimatedDpi} DPI at this print size` : ''}</p>{quality === 'caution' && <p className="mt-2 text-xs text-mute">It may look fine from a few feet away, but may appear soft up close.</p>}{quality === 'blurry' && <p className="mt-2 text-xs text-mute">A larger original image is strongly recommended. You can still order, and we’ll review it before printing.</p>}</>}
          </div>}
          <div className="rounded-xl border border-cyan/30 bg-cyan/10 p-4 text-sm text-mute">Printed on durable vinyl. We’ll contact you if the uploaded image is too small for the requested print size.</div>
          {error && <p role="alert" className="rounded-xl border border-pink/40 bg-pink/10 p-3 text-sm font-bold text-pink">{error}</p>}
          <button disabled={uploading} onClick={addToCart} className="btn-primary min-h-12 w-full disabled:opacity-50" type="button"><ShoppingBag className="h-5 w-5" /> Add to cart · ${total.toFixed(2)}</button>
        </section>
      </div>
    </div>
  </div>
}
