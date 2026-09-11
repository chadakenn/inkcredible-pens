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
  BUSINESS_CARD_PACKS,
  BUSINESS_CARDS_IMAGE,
  businessCardPackPrice,
  formatBusinessCardsCartMeta,
  getBusinessCardPack,
  type BusinessCardPackQty,
} from '../data/businessCards'
import { useCart } from '../store/cart'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  sanitizeCustomMeta,
  uploadCustomArtwork,
  validateCustomArtworkFile,
} from '../lib/uploadCustomArtwork'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif'

export default function CustomBusinessCards() {
  useDocumentTitle('Custom business cards')
  const addItem = useCart((s) => s.addItem)
  const fileRef = useRef<HTMLInputElement>(null)

  const [packQty, setPackQty] = useState<BusinessCardPackQty>(50)
  const pack = getBusinessCardPack(packQty)
  const [notes, setNotes] = useState('')
  const [emailLater, setEmailLater] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null)
  const [logoPreviewData, setLogoPreviewData] = useState<string | null>(null)
  const [artworkId, setArtworkId] = useState<string | null>(null)
  const [artworkFileName, setArtworkFileName] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [nudgeUpload, setNudgeUpload] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = useMemo(() => businessCardPackPrice(packQty), [packQty])
  const metaLine = formatBusinessCardsCartMeta(packQty)

  const readFile = useCallback(async (file: File) => {
    const validation = validateCustomArtworkFile(file)
    if (validation) {
      setError(validation)
      return
    }
    setError(null)
    setUploading(true)
    setEmailLater(false)
    setNudgeUpload(false)
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

  const clearArt = () => {
    setPreviewUrl(null)
    setFileName(null)
    setArtworkUrl(null)
    setArtworkId(null)
    setArtworkFileName(null)
    setError(null)
    setUploading(false)
  }

  const buildProduct = (logoByEmail: boolean): Product => {
    const id = `custom-business-cards-${Date.now().toString(36)}`
    const hasArt = Boolean(artworkUrl)
    const comingByEmail = logoByEmail || !hasArt
    const custom = sanitizeCustomMeta({
      type: 'business-cards',
      cardPackQty: packQty,
      cardNotes: notes.trim() || undefined,
      fileName: fileName ?? undefined,
      logoDataUrl: logoPreviewData ?? undefined,
      artworkUrl: artworkUrl ?? undefined,
      artworkId: artworkId ?? undefined,
      artworkFileName: artworkFileName ?? undefined,
      logoComingByEmail: comingByEmail,
    })
    return {
      id,
      name: `Custom Business Cards — ${pack.label}`,
      category: 'Custom',
      price: total,
      tagline: metaLine,
      description: notes.trim()
        ? `Custom double-sided business cards (${packQty}). Notes: ${notes.trim()}. Final art approval by email before production.`
        : comingByEmail
          ? `Custom double-sided business cards (${packQty}). Artwork coming by email. Final art approval by email before production.`
          : `Custom double-sided business cards (${packQty}). File: ${artworkFileName ?? fileName ?? 'artwork'}. Final art approval by email before production.`,
      accent: '#c084fc',
      art: 'sticker',
      imageUrl: logoPreviewData ?? BUSINESS_CARDS_IMAGE,
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
    if (!artworkUrl && !emailLater) {
      setNudgeUpload(true)
      return
    }
    addToCart(emailLater || !artworkUrl)
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-lavender/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-40 h-56 w-56 rounded-full bg-pink/15 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          to="/custom"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-mute transition hover:text-lavender"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Custom
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-28 w-40 shrink-0 overflow-hidden rounded-2xl border border-line bg-ink-2 sm:h-32 sm:w-44">
              <img
                src={BUSINESS_CARDS_IMAGE}
                alt="Custom business cards"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-lavender">
                <Sparkles className="h-3.5 w-3.5" /> Custom configurator
              </p>
              <h1 className="font-display text-3xl leading-tight sm:text-4xl">
                Custom Business Cards
              </h1>
              <p className="mt-2 max-w-xl text-sm text-mute sm:text-base">
                All packs are <span className="font-bold text-cream">double-sided</span>. Pick a
                pack, drop your art (or email it later), and add notes for colors &amp; contact
                info.
              </p>
            </div>
          </div>
          <p className="font-display text-2xl text-lime sm:text-3xl">${total.toFixed(2)}</p>
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
                  Drop artwork here or tap to upload
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
                <div className="relative flex h-36 w-56 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-lavender/50 bg-ink shadow-[0_0_28px_rgba(192,132,252,0.18)]">
                  <div className="absolute inset-0 checker-sm opacity-25" />
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Business card artwork preview"
                      className="relative z-[1] max-h-[85%] max-w-[85%] object-contain"
                    />
                  ) : (
                    <div className="relative z-[1] flex flex-col items-center gap-1 px-4 text-center">
                      <ImagePlus className="h-8 w-8 text-mute" />
                      <p className="text-xs font-bold text-mute">Your design here</p>
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
                        onClick={clearArt}
                        className="btn-ghost !min-h-11 !px-4 !py-2 text-sm"
                      >
                        <Trash2 className="h-4 w-4 text-pink" /> Clear / replace
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-cream">No artwork yet</p>
                      <p className="text-xs text-mute">
                        Upload now or toggle &ldquo;I&apos;ll email artwork later&rdquo; below.
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
                Pack size
              </p>
              <p className="mt-1 text-xs text-mute">All packs are double-sided</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {BUSINESS_CARD_PACKS.map((p) => {
                  const active = p.qty === packQty
                  return (
                    <button
                      key={p.qty}
                      type="button"
                      onClick={() => {
                        setPackQty(p.qty)
                        setNudgeUpload(false)
                      }}
                      className={`min-h-16 rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-lavender bg-lavender/15 text-cream shadow-[0_0_0_1px_rgba(192,132,252,0.5)]'
                          : 'border-line bg-ink text-mute hover:text-cream'
                      }`}
                    >
                      <p className="font-display text-lg text-cream">{p.qty}</p>
                      <p className="text-sm font-bold text-lime">${p.price}</p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-line bg-ink-2 p-4 sm:p-5">
              <label className="block">
                <span className="mb-2 block text-xs font-extrabold uppercase tracking-wider text-mute">
                  Notes{' '}
                  <span className="font-normal">(branding colors, contact info, ideas…)</span>
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="e.g. Hot pink + black · name Jane Doe · IG @inkcredible"
                  className="w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-cream outline-none placeholder:text-mute focus:border-lavender"
                />
              </label>
            </div>

            <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-line bg-ink-2 px-4 py-3">
              <input
                type="checkbox"
                checked={emailLater}
                onChange={(e) => {
                  setEmailLater(e.target.checked)
                  if (e.target.checked) setNudgeUpload(false)
                }}
                className="mt-1 h-4 w-4 rounded border-line accent-lavender"
              />
              <span>
                <span className="block text-sm font-bold text-cream">
                  I&apos;ll email artwork later
                </span>
                <span className="mt-0.5 block text-xs text-mute">
                  Skip upload for now — send files to inkcredible.pens@gmail.com after checkout.
                </span>
              </span>
            </label>

            <div className="rounded-2xl border border-lime/30 bg-lime/10 px-4 py-3">
              <p className="font-display text-xl text-lime">${total.toFixed(2)}</p>
              <p className="mt-1 text-xs text-mute">{metaLine}</p>
            </div>

            {nudgeUpload && (
              <div className="space-y-3 rounded-2xl border border-lavender/40 bg-lavender/10 p-4">
                <p className="text-sm font-bold text-cream">
                  No artwork yet — upload a file, or add the pack and email it later.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    className="btn-cyan min-h-11 flex-1"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" /> Upload artwork
                  </button>
                  <button
                    type="button"
                    className="btn-ghost min-h-11 flex-1"
                    onClick={() => addToCart(true)}
                  >
                    Artwork coming by email
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
                className="font-bold text-lavender underline-offset-2 hover:underline"
                href="mailto:inkcredible.pens@gmail.com?subject=Custom%20business%20cards"
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
