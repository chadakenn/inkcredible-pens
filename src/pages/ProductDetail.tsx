import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Link2, Minus, Plus, Share2, ZoomIn } from 'lucide-react'
import { useCatalog } from '../store/catalog'
import { useCart } from '../store/cart'
import { useScents } from '../store/scents'
import { useRecentlyViewed } from '../store/recentlyViewed'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import ProductArt from '../components/ProductArt'
import ProductCard from '../components/ProductCard'
import FavoriteButton from '../components/FavoriteButton'
import ImageLightbox from '../components/ImageLightbox'
import { pathForCustomProduct } from '../store/shop'

const CATEGORY_PATH: Record<string, string> = {
  Pens: '/pens',
  Stickers: '/stickers',
  'Car Freshies': '/freshies',
  Canvas: '/canvas',
  Custom: '/custom',
}

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const products = useCatalog((s) => s.products)
  const addItem = useCart((s) => s.addItem)
  const showToast = useCart((s) => s.showToast)
  const track = useRecentlyViewed((s) => s.track)
  const scents = useScents((s) => s.scents)
  const [qty, setQty] = useState(1)
  const [scent, setScent] = useState('')
  const [note, setNote] = useState('')
  const [scentNudge, setScentNudge] = useState(false)
  const [zoomOpen, setZoomOpen] = useState(false)
  const [shareFlash, setShareFlash] = useState(false)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [optionNudge, setOptionNudge] = useState(false)

  const product = useMemo(
    () => products.find((p) => p.id === id) ?? null,
    [products, id],
  )

  const configuratorPath = pathForCustomProduct(id)

  const related = useMemo(() => {
    if (!product) return []
    return products
      .filter((p) => p.category === product.category && p.id !== product.id)
      .slice(0, 4)
  }, [products, product])

  const isFreshie = product?.category === 'Car Freshies'
  const soldOut = product?.inventoryQuantity === 0

  useDocumentTitle(product?.name ?? (id ? 'Product' : 'Not found'))

  useEffect(() => {
    if (configuratorPath) return
    if (product?.id) track(product.id)
  }, [product?.id, track, configuratorPath])

  useEffect(() => {
    if (configuratorPath || !isFreshie) return
    if (scents.length === 0) {
      setScent('')
      return
    }
    setScent((prev) => (prev && scents.includes(prev) ? prev : scents[0]))
  }, [isFreshie, scents, configuratorPath])

  if (configuratorPath) {
    return <Navigate to={configuratorPath} replace />
  }

  if (!product) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="font-display text-2xl text-cream">Product not found</p>
        <p className="mt-2 text-mute">That item may have been removed.</p>
        <Link to="/shop" className="btn-primary mt-6 inline-flex min-h-11">
          Back to shop
        </Link>
      </section>
    )
  }

  const catPath = CATEGORY_PATH[product.category] ?? '/shop'
  const missingRequiredOption = (product.optionGroups || []).some(
    (group) => group.required && !selectedOptions[group.name],
  )
  const selectedPrice = (product.optionGroups || []).reduce((sum, group) => {
    const value = group.values.find((item) => item.label === selectedOptions[group.name])
    return sum + (value?.priceAdjustment || 0)
  }, product.price)
  const addDisabled = soldOut || (isFreshie && scents.length === 0)

  const onAdd = () => {
    if (missingRequiredOption) {
      setOptionNudge(true)
      return
    }
    if (isFreshie) {
      if (!scent.trim()) {
        setScentNudge(true)
        return
      }
      addItem(product, qty, {
        freshieScent: scent.trim(),
        freshieNote: note.trim() || undefined,
      })
      return
    }
    addItem(product, qty, { selectedOptions })
  }

  const onShare = async () => {
    const url = window.location.href
    const payload = {
      title: product.name,
      text: product.tagline || product.name,
      url,
    }
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(payload)
        return
      } catch (err) {
        // User cancelled or share failed — fall through to copy
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied')
      setShareFlash(true)
      window.setTimeout(() => setShareFlash(false), 1600)
    } catch {
      showToast('Could not copy link')
    }
  }

  const qtyControl = (
    <div className="inline-flex items-center rounded-full border border-line bg-ink-2">
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center p-2.5 text-mute hover:text-cream"
        onClick={() => setQty((q) => Math.max(1, q - 1))}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-8 text-center font-bold">{qty}</span>
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center p-2.5 text-mute hover:text-cream"
        onClick={() => setQty((q) => product.inventoryQuantity == null ? q + 1 : Math.min(q + 1, product.inventoryQuantity))}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )

  const addLabel = `Add to cart${isFreshie && scent ? ` · ${scent}` : ''}`

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-10 sm:pb-12">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          to={catPath}
          className="inline-flex items-center gap-2 text-sm font-bold text-mute transition hover:text-cyan"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {product.category}
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onShare}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-ink-2 px-3.5 text-sm font-bold text-cream transition hover:border-cyan/50 hover:text-cyan active:bg-ink-3"
            aria-label="Share product"
          >
            {shareFlash ? (
              <>
                <Check className="h-4 w-4 text-lime" /> Copied
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" /> Share
              </>
            )}
          </button>
          <FavoriteButton productId={product.id} size="md" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10 lg:items-start">
        <button
          type="button"
          onClick={() => setZoomOpen(true)}
          className="group relative block w-full overflow-hidden rounded-3xl border border-line bg-ink-3 text-left transition hover:border-cyan/40 lg:sticky lg:top-24"
          aria-label={`Zoom image of ${product.name}`}
        >
          <ProductArt product={product} className="aspect-square w-full sm:aspect-[4/3]" />
          <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-ink/80 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-cyan opacity-90 backdrop-blur-sm transition group-hover:opacity-100">
            <ZoomIn className="h-3.5 w-3.5" /> Zoom
          </span>
        </button>

        <ImageLightbox
          open={zoomOpen}
          onClose={() => setZoomOpen(false)}
          label={product.name}
        >
          <ProductArt product={product} className="aspect-square w-full sm:aspect-[4/3]" />
        </ImageLightbox>

        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-mute">
                {product.category}
              </p>
              {product.badge && (
                <span
                  className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase text-ink"
                  style={{ background: product.accent }}
                >
                  {product.badge}
                </span>
              )}
            </div>
            <h1 className="mt-2 font-display text-3xl break-words leading-tight text-cream sm:text-4xl">
              {product.name}
            </h1>
            <p className="mt-2 text-mute">{product.tagline}</p>
            <p className="mt-4 font-display text-3xl text-lime">
              ${selectedPrice.toFixed(2)}
            </p>
          </div>

          <p className="text-sm leading-relaxed text-mute sm:text-base">
            {product.description}
          </p>

          {(product.optionGroups || []).map((group) => (
            <div key={group.name} className={`rounded-3xl border p-4 sm:p-5 ${optionNudge && group.required && !selectedOptions[group.name] ? 'border-pink/50 bg-pink/5' : 'border-line bg-ink-2'}`}>
              <h2 className="font-display text-xl text-cream">Choose {group.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.values.map((value) => {
                  const selected = selectedOptions[group.name] === value.label
                  return (
                    <button key={value.label} type="button" onClick={() => { setSelectedOptions((current) => ({ ...current, [group.name]: value.label })); setOptionNudge(false) }} className={`min-h-12 rounded-full px-4 text-sm font-extrabold ${selected ? 'bg-lime text-ink' : 'border border-line bg-ink text-cream hover:border-cyan/50'}`}>
                      {value.label}{value.priceAdjustment ? ` (${value.priceAdjustment > 0 ? '+' : '-'}$${Math.abs(value.priceAdjustment).toFixed(2)})` : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {optionNudge && missingRequiredOption ? <p className="text-sm font-bold text-pink">Choose the required options before adding to cart.</p> : null}
          {product.inventoryQuantity != null ? <p className={`text-sm font-extrabold ${soldOut ? 'text-pink' : 'text-cyan'}`}>{soldOut ? 'Sold out' : `${product.inventoryQuantity} available`}</p> : null}

          {isFreshie && (
            <div
              className={`rounded-3xl border p-4 sm:p-5 ${
                scentNudge && !scent
                  ? 'border-pink/50 bg-pink/5'
                  : 'border-line bg-ink-2'
              }`}
            >
              <h2 className="font-display text-xl text-cream">Pick your scent</h2>
              <p className="mt-1 text-sm text-mute">
                Required — every freshie needs a fragrance.
              </p>
              {scents.length === 0 ? (
                <p className="mt-4 text-sm font-bold text-pink">
                  No scents available right now. Check back soon.
                </p>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  {scents.map((s) => {
                    const on = scent === s
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setScent(s)
                          setScentNudge(false)
                        }}
                        className={`min-h-12 rounded-full px-4 text-sm font-extrabold transition active:scale-[0.98] sm:min-h-14 sm:px-5 sm:text-base ${
                          on
                            ? 'bg-lime text-ink shadow-[0_0_24px_rgba(200,245,66,0.25)]'
                            : 'border border-line bg-ink text-cream hover:border-cyan/50 hover:text-cyan'
                        }`}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              )}
              {scentNudge && !scent && (
                <p className="mt-3 text-sm font-bold text-pink">
                  Pick a scent before adding to cart.
                </p>
              )}

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-extrabold uppercase tracking-wide text-mute">
                  Color / note <span className="font-normal">(optional)</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="e.g. pink & white, no glitter, soft pastel…"
                  className="w-full rounded-2xl border border-line bg-ink px-4 py-3 text-sm text-cream outline-none placeholder:text-mute focus:border-cyan"
                />
              </label>
            </div>
          )}

          {/* Desktop / tablet add row */}
          <div className="mt-auto hidden flex-wrap items-center gap-3 pt-2 sm:flex">
            {qtyControl}
            <button
              type="button"
              className="btn-primary min-h-11 flex-1 sm:flex-none sm:px-8"
              onClick={onAdd}
              disabled={addDisabled}
            >
              {addLabel}
            </button>
            <button
              type="button"
              onClick={onShare}
              className="btn-ghost min-h-11 !px-4 text-sm"
              aria-label="Share or copy link"
            >
              <Link2 className="h-4 w-4 text-cyan" />
              Link
            </button>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-12 border-t border-line pt-10 sm:mt-16">
          <h2 className="font-display text-2xl text-cream sm:text-3xl">
            You might also like
          </h2>
          <p className="mt-1 text-sm text-mute">
            More from {product.category}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}

      {/* Sticky mobile add bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 px-4 py-3 backdrop-blur-xl sm:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <p className="mr-auto min-w-0 truncate font-display text-lg text-lime">
            ${selectedPrice.toFixed(2)}
          </p>
          {qtyControl}
          <button
            type="button"
            className="btn-primary min-h-11 shrink-0 !px-4"
            onClick={onAdd}
            disabled={addDisabled}
          >
            {soldOut ? 'Sold out' : `Add${isFreshie && scent ? ` · ${scent}` : ''}`}
          </button>
        </div>
      </div>
    </section>
  )
}
