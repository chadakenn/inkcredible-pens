import { useCallback, useMemo, useRef, useState, type CSSProperties, type ChangeEvent, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ImagePlus,
  Mail,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import type { Product } from '../data/products'
import {
  LOGO_STICKER_CUTS,
  LOGO_STICKER_SIZES,
  LOGO_STICKER_STYLES,
  computeLogoStickerTotal,
  formatLogoStickerLine,
  getLogoCut,
  getLogoSize,
  getLogoStyle,
  packPriceForSize,
  unitPriceForSize,
  type LogoStickerCut,
  type LogoStickerSizeId,
  type LogoStickerStyleId,
} from '../data/logoStickers'
import { useCart } from '../store/cart'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  sanitizeCustomMeta,
  uploadCustomArtwork,
  validateCustomArtworkFile,
} from '../lib/uploadCustomArtwork'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg'

export default function CustomLogoStickers() {
  useDocumentTitle('Custom logo stickers')
  const addItem = useCart((s) => s.addItem)
  const fileRef = useRef<HTMLInputElement>(null)

  const [styleId, setStyleId] = useState<LogoStickerStyleId>('vinyl')
  const style = getLogoStyle(styleId)
  const [sizeId, setSizeId] = useState<LogoStickerSizeId>('3')
  const size = getLogoSize(sizeId)
  const unitPrice = unitPriceForSize(style, sizeId)
  const [qty, setQty] = useState(style.packQty)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null)
  const [artworkId, setArtworkId] = useState<string | null>(null)
  const [artworkFileName, setArtworkFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [nudgeUpload, setNudgeUpload] = useState(false)
  const [mockShape, setMockShape] = useState<LogoStickerCut>('circle')
  const cut = getLogoCut(mockShape)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(
    () => computeLogoStickerTotal(unitPrice, qty),
    [unitPrice, qty],
  )
  const priceLine = formatLogoStickerLine(total, qty, style)

  const pickStyle = (id: LogoStickerStyleId) => {
    const next = getLogoStyle(id)
    setStyleId(id)
    setQty(next.packQty)
    setNudgeUpload(false)
  }

  const clampQty = (n: number) => Math.max(1, Math.min(10_000, Math.floor(n) || 1))

  const readFile = async (file: File) => {
    const validation = validateCustomArtworkFile(file)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    setUploading(true)
    setFileName(file.name)
    setNudgeUpload(false)
    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setArtworkUrl(null)
    setArtworkId(null)
    setArtworkFileName(null)
    try {
      const uploaded = await uploadCustomArtwork(file)
      setArtworkUrl(uploaded.url)
      setArtworkId(uploaded.id)
      setArtworkFileName(uploaded.fileName)
      setPreviewUrl(uploaded.url)
      URL.revokeObjectURL(localPreview)
      setFileName(uploaded.fileName)
    } catch (err) {
      URL.revokeObjectURL(localPreview)
      setPreviewUrl(null)
      setFileName(null)
      setArtworkUrl(null)
      setArtworkId(null)
      setArtworkFileName(null)
      setError(
        err instanceof Error
          ? err.message
          : 'Upload failed — you can email the file later.',
      )
    } finally {
      setUploading(false)
    }
  }

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
  }, [])

  const clearLogo = () => {
    setPreviewUrl(null)
    setFileName(null)
    setArtworkUrl(null)
    setArtworkId(null)
    setArtworkFileName(null)
    setError(null)
    setUploading(false)
  }

  const buildProduct = (logoByEmail: boolean): Product => {
    const id = `custom-logo-sticker-${Date.now().toString(36)}`
    const hasArt = Boolean(artworkUrl)
    const custom = sanitizeCustomMeta({
      type: 'logo',
      style: style.id,
      styleLabel: style.label,
      cut: mockShape,
      cutLabel: cut.label,
      stickerQty: qty,
      stickerSize: size.label,
      stickerSizeId: size.id,
      fileName: fileName ?? undefined,
      artworkUrl: artworkUrl ?? undefined,
      artworkId: artworkId ?? undefined,
      artworkFileName: artworkFileName ?? undefined,
      logoComingByEmail: logoByEmail || !hasArt,
    })
    return {
      id,
      name: `Custom Logo Stickers — ${style.shortLabel} ${size.label} (${qty})`,
      category: 'Custom',
      price: total,
      tagline: `${style.label} · ${cut.label} · ${size.label} · ${qty} stickers`,
      description: logoByEmail || !hasArt
        ? `Custom ${style.label} stickers (${size.label}, ${cut.label}). Logo coming by email. Final art approval by email before production.`
        : `Custom ${style.label} stickers (${size.label}, ${cut.label}). File: ${artworkFileName ?? fileName ?? 'logo'}. Final art approval by email before production.`,
      accent: style.accent,
      art: 'sticker',
      imageUrl: artworkUrl ?? undefined,
      badge: 'Custom',
      custom,
    }
  }

  const addToCart = (logoByEmail: boolean) => {
    if (uploading) return
    addItem(buildProduct(logoByEmail), 1)
    setNudgeUpload(false)
  }

  const onAddClick = () => {
    if (uploading) return
    if (!artworkUrl) {
      setNudgeUpload(true)
      return
    }
    addToCart(false)
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-cyan/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-40 h-56 w-56 rounded-full bg-pink/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 left-1/3 h-48 w-48 rounded-full bg-lavender/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          to="/custom"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-mute transition hover:text-cyan"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Custom
        </Link>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-lavender">
              <Sparkles className="h-3.5 w-3.5" /> Custom configurator
            </p>
            <h1 className="font-display text-3xl leading-tight sm:text-4xl">
              Custom Logo Stickers
            </h1>
            <p className="mt-2 max-w-xl text-sm text-mute sm:text-base">
              Pick a style, set your count, drop your logo. Price updates live.
              Dead simple.
            </p>
          </div>
          <p className="font-display text-2xl text-lime sm:text-3xl">{priceLine}</p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          {/* Left: upload + mock */}
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
                  Drop your logo here or tap to upload
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-extrabold uppercase tracking-wider text-mute">
                  Cut / shape
                </p>
                <div className="inline-flex flex-wrap justify-end gap-0.5 rounded-full border border-line p-0.5">
                  {LOGO_STICKER_CUTS.map((shape) => (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={() => setMockShape(shape.id)}
                      className={`min-h-9 rounded-full px-3 text-xs font-bold transition ${
                        mockShape === shape.id
                          ? 'bg-cream text-ink'
                          : 'text-mute hover:text-cream'
                      }`}
                    >
                      {shape.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mb-3 text-xs text-mute">{cut.helper}</p>

              <div className="mb-4">
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-mute">
                  Size
                </p>
                <div className="inline-flex flex-wrap gap-0.5 rounded-full border border-line p-0.5">
                  {LOGO_STICKER_SIZES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSizeId(s.id)
                        setNudgeUpload(false)
                      }}
                      className={`min-h-9 rounded-full px-3 text-xs font-bold transition ${
                        sizeId === s.id
                          ? 'bg-cream text-ink'
                          : 'text-mute hover:text-cream'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                <div
                  className={`relative flex h-44 w-44 shrink-0 items-center justify-center overflow-hidden border-4 shadow-[0_0_32px_rgba(34,211,238,0.2)] ${
                    mockShape === 'circle'
                      ? 'rounded-full'
                      : mockShape === 'rounded'
                        ? 'rounded-[2rem]'
                        : 'rounded-none'
                  }`}
                  style={{
                    borderColor: style.accent,
                    background: '#0a0a0a',
                    ...(mockShape === 'diecut'
                      ? {
                          clipPath:
                            'polygon(12% 18%, 32% 4%, 58% 0%, 82% 10%, 98% 32%, 100% 58%, 90% 82%, 68% 98%, 40% 100%, 14% 88%, 0% 62%, 2% 36%)',
                        }
                      : {}),
                  }}
                >
                  <div className="absolute inset-0 checker-sm opacity-30" />
                  {mockShape === 'diecut' && (
                    <span className="absolute left-1/2 top-2 z-[2] -translate-x-1/2 rounded-full bg-pink px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-white shadow">
                      DIE-CUT
                    </span>
                  )}
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Logo preview"
                      className="relative z-[1] max-h-[78%] max-w-[78%] object-contain"
                    />
                  ) : (
                    <div className="relative z-[1] flex flex-col items-center gap-1 px-4 text-center">
                      <ImagePlus className="h-8 w-8 text-mute" />
                      <p className="text-xs font-bold text-mute">Your logo here</p>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                  {fileName ? (
                    <>
                      <p className="truncate text-sm font-bold text-cream">{fileName}</p>
                      <p className="text-xs text-mute">
                        Client-side preview only — we&apos;ll confirm final art by email.
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
                      <p className="text-sm font-bold text-cream">No logo yet</p>
                      <p className="text-xs text-mute">
                        You can still configure price & qty — send the logo by email later if you
                        want.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Right: style + qty + cart */}
          <section className="space-y-4">
            <div className="rounded-3xl border border-line bg-ink-2 p-4 sm:p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-mute">
                Style pack
              </p>
              <div className="mt-3 grid gap-2">
                {LOGO_STICKER_STYLES.map((s) => {
                  const active = s.id === styleId
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickStyle(s.id)}
                      className={`min-h-14 rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-transparent bg-ink shadow-[0_0_0_2px_var(--ring)]'
                          : 'border-line bg-ink/40 hover:border-cream/30'
                      }`}
                      style={
                        active
                          ? ({ ['--ring' as string]: s.accent } as CSSProperties)
                          : undefined
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-base text-cream">{s.label}</p>
                          <p className="text-xs text-mute">
                            {size.label} · {s.blurb}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-display text-sm" style={{ color: s.accent }}>
                            ${packPriceForSize(s, sizeId)}
                          </p>
                          <p className="text-[11px] text-mute">
                            {s.packQty} · ${unitPriceForSize(s, sizeId).toFixed(2)}/ea
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-ink-2 p-4 sm:p-5">
              <p className="text-xs font-extrabold uppercase tracking-wider text-mute">
                Quantity
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setQty(style.packQty)}
                  className={`min-h-12 min-w-[5.5rem] rounded-2xl border px-4 py-2 font-display text-lg transition ${
                    qty === style.packQty
                      ? 'border-lime bg-lime text-ink'
                      : 'border-line bg-ink text-cream hover:border-lime/50'
                  }`}
                >
                  {style.packQty}
                </button>
                {[style.packQty * 2, style.packQty * 4]
                  .filter((n) => n !== style.packQty)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQty(n)}
                      className={`min-h-12 min-w-[5.5rem] rounded-2xl border px-4 py-2 font-display text-lg transition ${
                        qty === n
                          ? 'border-lime bg-lime text-ink'
                          : 'border-line bg-ink text-cream hover:border-lime/50'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <div className="inline-flex items-center rounded-full border border-line bg-ink">
                  <button
                    type="button"
                    className="inline-flex min-h-12 min-w-12 items-center justify-center text-mute hover:text-cream"
                    onClick={() => setQty((q) => clampQty(q - 1))}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={qty}
                    onChange={(e) => setQty(clampQty(Number(e.target.value)))}
                    className="w-20 border-x border-line bg-transparent py-2 text-center font-display text-lg text-cream outline-none"
                    aria-label="Sticker quantity"
                  />
                  <button
                    type="button"
                    className="inline-flex min-h-12 min-w-12 items-center justify-center text-mute hover:text-cream"
                    onClick={() => setQty((q) => clampQty(q + 1))}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-mute">
                  Unit <span className="font-bold text-cream">${unitPrice.toFixed(2)}</span>
                  <span className="text-mute"> · {size.label}</span>
                </p>
              </div>

              <div className="mt-5 rounded-2xl border border-lime/30 bg-lime/10 px-4 py-3">
                <p className="font-display text-xl text-lime">{priceLine}</p>
                <p className="mt-1 text-xs text-mute">
                  Live total = unit × qty (rounded to 2 decimals)
                </p>
              </div>
            </div>

            {nudgeUpload && (
              <div className="space-y-3 rounded-2xl border border-cyan/40 bg-cyan/10 p-4">
                <p className="text-sm font-bold text-cream">
                  No logo yet — upload one for a preview, or add the pack and email it later.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="btn-cyan min-h-11 flex-1"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> Upload logo
                  </button>
                  <button
                    type="button"
                    className="btn-ghost min-h-11 flex-1"
                    onClick={() => addToCart(true)}
                  >
                    Logo coming by email
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onAddClick}
              disabled={uploading}
              className="btn-primary min-h-12 w-full text-base disabled:opacity-60"
            >
              <ShoppingBag className="h-5 w-5" />{' '}
              {uploading ? 'Uploading…' : `Add to cart — $${total.toFixed(2)}`}
            </button>

            <p className="text-center text-xs text-mute">
              Final art approval by email before production ·{' '}
              <a
                className="font-bold text-cyan underline-offset-2 hover:underline"
                href="mailto:inkcredible.pens@gmail.com?subject=Custom%20logo%20stickers"
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
