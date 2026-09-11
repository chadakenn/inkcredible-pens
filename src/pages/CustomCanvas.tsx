import { useCallback, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ImagePlus,
  Mail,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import type { Product } from '../data/products'
import {
  CANVAS_FRAMED_ADD,
  CANVAS_SIZE_PRESETS,
  estimateCanvasPrice,
  getCanvasPreset,
  type CanvasFinish,
  type CanvasSizeId,
} from '../data/canvasPrints'
import { useCart } from '../store/cart'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  sanitizeCustomMeta,
  uploadCustomArtwork,
  validateCustomArtworkFile,
} from '../lib/uploadCustomArtwork'
import GraphicsLogo from '../components/GraphicsLogo'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif'

export default function CustomCanvas() {
  useDocumentTitle('Custom canvas')
  const addItem = useCart((s) => s.addItem)
  const fileRef = useRef<HTMLInputElement>(null)

  const [sizeId, setSizeId] = useState<CanvasSizeId>('8x10')
  const [finish, setFinish] = useState<CanvasFinish>('stretched')
  const [notes, setNotes] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null)
  const [logoPreviewData, setLogoPreviewData] = useState<string | null>(null)
  const [artworkId, setArtworkId] = useState<string | null>(null)
  const [artworkFileName, setArtworkFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preset = getCanvasPreset(sizeId)
  const estimate = useMemo(
    () => estimateCanvasPrice(sizeId, finish),
    [sizeId, finish],
  )

  const readFile = useCallback(async (file: File) => {
    const validation = validateCustomArtworkFile(file)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    setUploading(true)
    setFileName(file.name)
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setArtworkUrl(null)
    setArtworkId(null)
    setArtworkFileName(null)
    setLogoPreviewData(null)
    const dataUrlPromise = new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('read_failed'))
      reader.readAsDataURL(file)
    })
    try {
      const [uploaded, dataUrl] = await Promise.all([
        uploadCustomArtwork(file),
        dataUrlPromise.catch(() => ''),
      ])
      setArtworkUrl(uploaded.url)
      setArtworkId(uploaded.id)
      setArtworkFileName(uploaded.fileName)
      setFileName(uploaded.fileName)
      // Keep blob preview on page; small-ish data URL for cart (admin URL is not public)
      if (dataUrl && dataUrl.length < 400_000) setLogoPreviewData(dataUrl)
    } catch (err) {
      URL.revokeObjectURL(localPreview)
      setPreviewUrl(null)
      setFileName(null)
      setArtworkUrl(null)
      setArtworkId(null)
      setArtworkFileName(null)
      setLogoPreviewData(null)
      setError(
        err instanceof Error
          ? err.message
          : 'Upload failed — you can email the file later.',
      )
    } finally {
      setUploading(false)
    }
  }, [previewUrl])

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void readFile(file)
    e.target.value = ''
  }

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void readFile(file)
  }, [readFile])

  const clearLogo = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFileName(null)
    setArtworkUrl(null)
    setArtworkId(null)
    setArtworkFileName(null)
    setLogoPreviewData(null)
    setError(null)
    setUploading(false)
  }

  const buildProduct = (): Product => {
    const id = `custom-canvas-${Date.now().toString(36)}`
    const hasArt = Boolean(artworkUrl)
    const finishLabel = finish === 'framed' ? 'Framed' : 'Stretched'
    const custom = sanitizeCustomMeta({
      type: 'canvas',
      canvasSizeId: sizeId,
      canvasSizeLabel: preset.label,
      canvasFinish: finish,
      canvasNotes: notes.trim() || undefined,
      fileName: fileName ?? undefined,
      logoDataUrl: logoPreviewData ?? undefined,
      artworkUrl: artworkUrl ?? undefined,
      artworkId: artworkId ?? undefined,
      artworkFileName: artworkFileName ?? undefined,
      logoComingByEmail: !hasArt,
      estimateOnly: true,
    })
    return {
      id,
      name: `Custom Canvas — ${preset.label}`,
      category: 'Custom',
      price: estimate,
      tagline: `${preset.label} · ${finishLabel} · estimate`,
      description: notes.trim()
        ? `Custom canvas request (${preset.label}, ${finishLabel}). Notes: ${notes.trim()}. Final quote by email.`
        : `Custom canvas request (${preset.label}, ${finishLabel}). Final quote by email before production.`,
      accent: '#c084fc',
      art: 'pack',
      imageUrl: logoPreviewData ?? undefined,
      badge: 'Estimate',
      custom,
    }
  }

  const requestCanvas = () => {
    if (uploading) return
    addItem(buildProduct(), 1)
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-lavender/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-40 h-56 w-56 rounded-full bg-pink/15 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          to="/custom"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-mute transition hover:text-cyan"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Custom
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4">
              <GraphicsLogo size="xl" />
            </div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-lavender">
              <Sparkles className="h-3.5 w-3.5" /> Custom configurator
            </p>
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">
              Custom Canvas
            </h1>
            <p className="mt-2 max-w-xl text-sm text-mute sm:text-base">
              Powered by Inkcredible Graphics. Upload your image, pick a size &amp; finish. Price shown is an estimate —
              final quote by email.
            </p>
          </div>
          <p className="font-display text-2xl text-lime sm:text-3xl">
            ~${estimate.toFixed(2)}
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  fileRef.current?.click()
                }
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`relative flex min-h-[12rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-4 py-8 text-center transition ${
                dragOver
                  ? 'border-lavender bg-lavender/10'
                  : 'border-line bg-ink-2 hover:border-lavender/50 active:bg-ink-3'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={onInputChange}
              />
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-3 text-lavender">
                <Upload className="h-7 w-7" />
              </span>
              <div>
                <p className="font-display text-lg text-cream">
                  Drop your image here or tap to upload
                </p>
                <p className="mt-1 text-xs text-mute">PNG · JPG · WebP · SVG · preview only</p>
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-pink/40 bg-pink/10 px-3 py-2 text-sm font-bold text-pink">
                {error}
              </p>
            )}
            {uploading && (
              <p className="rounded-xl border border-cyan/40 bg-cyan/10 px-3 py-2 text-sm font-bold text-cyan">
                Uploading artwork to server…
              </p>
            )}

            <div className="rounded-3xl border border-line bg-ink-2 p-4 sm:p-5">
              <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-mute">
                Preview
              </p>
              <div className="flex flex-col items-center gap-4 sm:flex-row">
                <div
                  className={`relative flex h-48 w-40 shrink-0 items-center justify-center overflow-hidden border-4 border-lavender/60 bg-ink shadow-[0_0_28px_rgba(192,132,252,0.2)] ${
                    finish === 'framed' ? 'rounded-md ring-4 ring-cream/20' : 'rounded-sm'
                  }`}
                >
                  <div className="absolute inset-0 checker-sm opacity-25" />
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Canvas preview"
                      className="relative z-[1] h-full w-full object-cover"
                    />
                  ) : (
                    <div className="relative z-[1] flex flex-col items-center gap-1 px-4 text-center">
                      <ImagePlus className="h-8 w-8 text-mute" />
                      <p className="text-xs font-bold text-mute">Your image</p>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                  {fileName ? (
                    <>
                      <p className="truncate text-sm font-bold text-cream">{fileName}</p>
                      <p className="text-xs text-mute">
                        Client-side preview — we&apos;ll confirm final art by email.
                      </p>
                      <button
                        type="button"
                        onClick={clearLogo}
                        className="btn-ghost !min-h-11 !px-4 !py-2 text-sm"
                      >
                        <Trash2 className="h-4 w-4 text-pink" /> Clear / replace
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-cream">No image yet</p>
                      <p className="text-xs text-mute">
                        Configure size & finish now — email the file later if you want.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-3xl border border-line bg-ink-2 p-4 sm:p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-mute">
                Size (inches)
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {CANVAS_SIZE_PRESETS.map((s) => {
                  const active = s.id === sizeId
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSizeId(s.id)}
                      className={`min-h-14 rounded-2xl border px-3 py-2 text-left transition ${
                        active
                          ? 'border-lavender bg-lavender/15 text-cream shadow-[0_0_0_1px_rgba(192,132,252,0.5)]'
                          : 'border-line bg-ink text-mute hover:text-cream'
                      }`}
                    >
                      <p className="font-display text-base text-cream">{s.label}</p>
                      <p className="text-[11px] text-mute">est. ${s.estimate}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-ink-2 p-4 sm:p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-mute">
                Finish <span className="font-normal lowercase">(optional)</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(
                  [
                    ['stretched', 'Stretched'],
                    ['framed', 'Framed'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFinish(id)}
                    className={`min-h-12 rounded-2xl border px-3 font-extrabold transition ${
                      finish === id
                        ? 'border-lime bg-lime text-ink'
                        : 'border-line bg-ink text-mute hover:text-cream'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {finish === 'framed' && (
                <p className="mt-2 text-xs text-mute">
                  Framed adds ~${CANVAS_FRAMED_ADD} to the size estimate.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-line bg-ink-2 p-4 sm:p-5">
              <label className="block">
                <span className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-mute">
                  Notes <span className="font-normal">(optional)</span>
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Colors, crop notes, gift message…"
                  className="w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-cream outline-none placeholder:text-mute focus:border-cyan"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-lime/30 bg-lime/10 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-lime">
                Estimate — final quote by email
              </p>
              <p className="mt-1 font-display text-xl text-lime">~${estimate.toFixed(2)}</p>
              <ul className="mt-2 space-y-0.5 text-[11px] text-mute">
                <li>8×10 $35 · 11×14 $45 · 16×20 $65 · 18×24 $85 (estimates)</li>
                <li>Framed +${CANVAS_FRAMED_ADD} estimate bump</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={requestCanvas}
              disabled={uploading}
              className="btn-primary min-h-12 w-full text-base disabled:opacity-60"
            >
              <ShoppingBag className="h-5 w-5" />{' '}
              {uploading ? 'Uploading…' : `Request quote — est. ~$${estimate.toFixed(2)}`}
            </button>

            <p className="text-center text-xs text-mute">
              Final art approval by email ·{' '}
              <a
                className="font-bold text-cyan underline-offset-2 hover:underline"
                href="mailto:inkcredible.pens@gmail.com?subject=Custom%20canvas%20quote"
              >
                inkcredible.pens@gmail.com
              </a>
            </p>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-mute">
              <Mail className="h-3.5 w-3.5" /> Questions? Same inbox.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
