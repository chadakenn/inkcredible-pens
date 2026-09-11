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
  BANNER_SIZE_PRESETS,
  BANNER_SQFT_HIGH,
  BANNER_SQFT_LOW,
  BANNER_SQFT_MID,
  bannerSqFt,
  estimateBannerPrice,
  getBannerPreset,
  type BannerSizeId,
} from '../data/banners'
import { useCart } from '../store/cart'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  sanitizeCustomMeta,
  uploadCustomArtwork,
  validateCustomArtworkFile,
} from '../lib/uploadCustomArtwork'
import GraphicsLogo from '../components/GraphicsLogo'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg'

export default function CustomBanners() {
  useDocumentTitle('Custom banners')
  const addItem = useCart((s) => s.addItem)
  const fileRef = useRef<HTMLInputElement>(null)

  const [sizeId, setSizeId] = useState<BannerSizeId>('2x4')
  const [widthFt, setWidthFt] = useState(2)
  const [heightFt, setHeightFt] = useState(4)
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

  const preset = getBannerPreset(sizeId)
  const activeW = sizeId === 'custom' ? widthFt : preset.widthFt
  const activeH = sizeId === 'custom' ? heightFt : preset.heightFt
  const sqft = bannerSqFt(activeW, activeH)

  const estimate = useMemo(
    () => estimateBannerPrice(sizeId, activeW, activeH, 'single'),
    [sizeId, activeW, activeH],
  )

  const pickSize = (id: BannerSizeId) => {
    const next = getBannerPreset(id)
    setSizeId(id)
    if (id !== 'custom') {
      setWidthFt(next.widthFt)
      setHeightFt(next.heightFt)
    }
  }

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
    const isSvg = file.type === 'image/svg+xml' || /\\.svg$/i.test(file.name)
    const localPreview = isSvg ? null : URL.createObjectURL(file)
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
      const safePreview = uploaded.previewDataUrl || dataUrl
      if (uploaded.previewDataUrl) {
        if (localPreview) URL.revokeObjectURL(localPreview)
        setPreviewUrl(uploaded.previewDataUrl)
      }
      // The server-rendered PNG is used for SVG; raster uploads retain their local preview.
      if (safePreview && safePreview.length < 400_000) setLogoPreviewData(safePreview)
    } catch (err) {
      if (localPreview) URL.revokeObjectURL(localPreview)
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

  const sizeLabel =
    sizeId === 'custom'
      ? `Custom ${activeW}×${activeH} ft`
      : preset.label

  const buildProduct = (): Product => {
    const id = `custom-banner-${Date.now().toString(36)}`
    const hasArt = Boolean(artworkUrl)
    const custom = sanitizeCustomMeta({
      type: 'banner',
      bannerSizeId: sizeId,
      bannerSizeLabel: sizeLabel,
      bannerWidthFt: activeW,
      bannerHeightFt: activeH,
      bannerSides: 'single',
      bannerNotes: notes.trim() || undefined,
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
      name: `Custom Banner — ${sizeLabel}`,
      category: 'Custom',
      price: estimate,
      tagline: `${sizeLabel} · estimate`,
      description: notes.trim()
        ? `Custom banner estimate (${sizeLabel}). Notes: ${notes.trim()}. Final art approval by email before production.`
        : `Custom banner estimate (${sizeLabel}). Final art approval by email before production.`,
      accent: '#22d3ee',
      art: 'pack',
      imageUrl: logoPreviewData ?? undefined,
      badge: 'Estimate',
      custom,
    }
  }

  const requestBanner = () => {
    if (uploading) return
    addItem(buildProduct(), 1)
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan/15 blur-3xl" />
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
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-cyan">
              <Sparkles className="h-3.5 w-3.5" /> Configurator · request a free quote
            </p>
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">
              Custom Banners
            </h1>
            <p className="mt-2 max-w-xl text-sm text-mute sm:text-base">
              Powered by Inkcredible Graphics. Pick a size, upload art, and request a quote with no payment today.
              We&apos;ll email the final price and secure checkout link.
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
                  ? 'border-cyan bg-cyan/10'
                  : 'border-line bg-ink-2 hover:border-cyan/50 active:bg-ink-3'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={onInputChange}
              />
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-3 text-cyan">
                <Upload className="h-7 w-7" />
              </span>
              <div>
                <p className="font-display text-lg text-cream">
                  Drop artwork / logo or tap to upload
                </p>
                <p className="mt-1 text-xs text-mute">PNG · JPG · WebP · GIF · SVG · max 12MB</p>
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
                  className="relative flex h-36 w-full max-w-xs items-center justify-center overflow-hidden rounded-2xl border-2 border-cyan/50 bg-ink shadow-[0_0_28px_rgba(34,211,238,0.18)]"
                  style={{ aspectRatio: `${activeW} / ${activeH}` }}
                >
                  <div className="absolute inset-0 checker-sm opacity-25" />
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Banner artwork preview"
                      className="relative z-[1] max-h-[85%] max-w-[85%] object-contain"
                    />
                  ) : (
                    <div className="relative z-[1] flex flex-col items-center gap-1 px-4 text-center">
                      <ImagePlus className="h-8 w-8 text-mute" />
                      <p className="text-xs font-bold text-mute">Your art here</p>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                  {fileName ? (
                    <>
                      <p className="truncate text-sm font-bold text-cream">{fileName}</p>
                      <p className="text-xs text-mute">
                        Preview only — final art approval by email.
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
                      <p className="text-sm font-bold text-cream">No artwork yet</p>
                      <p className="text-xs text-mute">
                        You can still request a banner and email the file later.
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
                Size
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {BANNER_SIZE_PRESETS.map((s) => {
                  const active = s.id === sizeId
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickSize(s.id)}
                      className={`min-h-14 rounded-2xl border px-3 py-2 text-left transition ${
                        active
                          ? 'border-cyan bg-cyan/15 text-cream shadow-[0_0_0_1px_rgba(34,211,238,0.5)]'
                          : 'border-line bg-ink text-mute hover:text-cream'
                      }`}
                    >
                      <p className="font-display text-base text-cream">{s.label}</p>
                      {s.flatEstimate != null && (
                        <p className="text-[11px] text-mute">est. ${s.flatEstimate}</p>
                      )}
                      {s.id === 'custom' && (
                        <p className="text-[11px] text-mute">W × H</p>
                      )}
                    </button>
                  )
                })}
              </div>

              {sizeId === 'custom' && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-mute">
                      Width (ft)
                    </span>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={widthFt}
                      onChange={(e) => setWidthFt(Math.max(0.5, Number(e.target.value) || 0.5))}
                      className="min-h-12 w-full rounded-xl border border-line bg-ink px-3 text-lg font-bold text-cream outline-none focus:border-cyan"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-extrabold uppercase tracking-wide text-mute">
                      Height (ft)
                    </span>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={heightFt}
                      onChange={(e) => setHeightFt(Math.max(0.5, Number(e.target.value) || 0.5))}
                      className="min-h-12 w-full rounded-xl border border-line bg-ink px-3 text-lg font-bold text-cream outline-none focus:border-cyan"
                    />
                  </label>
                </div>
              )}
            </div>


            <div className="rounded-3xl border border-line bg-ink-2 p-4 sm:p-5">
              <label className="block">
                <span className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-mute">
                  Notes <span className="font-normal">(event name, colors…)</span>
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Spring market banner — neon pink + black"
                  className="w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-cream outline-none placeholder:text-mute focus:border-cyan"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-lime/30 bg-lime/10 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-lime">
                Estimated price — no payment today
              </p>
              <p className="mt-1 font-display text-xl text-lime">~${estimate.toFixed(2)}</p>
              <p className="mt-1 text-xs text-mute">
                {sizeId === 'custom'
                  ? `Custom ~$${BANNER_SQFT_LOW}–$${BANNER_SQFT_HIGH}/sq ft (using $${BANNER_SQFT_MID}/sq ft mid) · ${sqft} sq ft`
                  : `Preset flat estimate for ${preset.label}`}
              </p>
              <ul className="mt-2 space-y-0.5 text-[11px] text-mute">
                <li>2×4 → $80 · 2×6 → $110 · 3×6 → $150 · 4×8 → $220 (estimates)</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={requestBanner}
              disabled={uploading}
              className="btn-primary min-h-12 w-full text-base disabled:opacity-60"
            >
              <ShoppingBag className="h-5 w-5" />{' '}
              {uploading
                ? 'Uploading…'
                : `Request quote — est. ~$${estimate.toFixed(2)}`}
            </button>

            <p className="text-center text-xs text-mute">
              Final art approval by email ·{' '}
              <a
                className="font-bold text-cyan underline-offset-2 hover:underline"
                href="mailto:inkcredible.pens@gmail.com?subject=Custom%20banner"
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
