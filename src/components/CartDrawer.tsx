import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, Truck, X } from 'lucide-react'
import { formatCustomCartMeta } from '../lib/customCartMeta'
import { customPreviewSrc } from '../lib/uploadCustomArtwork'
import { FREE_SHIPPING_THRESHOLD, useCart } from '../store/cart'
import ProductArt from './ProductArt'
import LogoMark from './LogoMark'

export default function CartDrawer() {
  const { isOpen, closeCart, items, setQty, removeItem, subtotal, totalCount } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, closeCart])

  if (!isOpen) return null

  const total = subtotal()
  const count = totalCount()
  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - total)
  const progress = Math.min(100, (total / FREE_SHIPPING_THRESHOLD) * 100)
  const unlocked = remaining === 0 && total > 0

  const keepShopping = () => {
    closeCart()
    navigate('/shop')
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        aria-label="Close cart"
        onClick={closeCart}
      />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-ink-2 animate-drawer shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-1 w-full">
          <span className="flex-1 bg-cyan" />
          <span className="flex-1 bg-lime" />
          <span className="flex-1 bg-pink" />
          <span className="flex-1 bg-lavender" />
        </div>
        <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <LogoMark size="sm" className="mb-1" />
            <h2 className="font-display text-xl">Your cart</h2>
            <p className="text-sm text-mute">
              {count} item{count === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={closeCart}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line p-2 text-mute hover:border-cyan/40 hover:text-cream active:bg-ink-3"
            aria-label="Close cart"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Free shipping progress */}
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2 text-xs font-bold">
            <Truck className={`h-3.5 w-3.5 ${unlocked ? 'text-lime' : 'text-cyan'}`} />
            {unlocked ? (
              <span className="text-lime">Free shipping unlocked — you legend.</span>
            ) : (
              <span className="text-mute">
                <span className="text-cream">${remaining.toFixed(2)}</span> away from free shipping
              </span>
            )}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                unlocked ? 'bg-lime' : 'bg-gradient-to-r from-cyan to-pink'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-mute">
            Flat $8 shipping · free over ${FREE_SHIPPING_THRESHOLD.toFixed(0)}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="font-display text-lg">Cart&apos;s looking lonely</p>
              <p className="text-sm text-mute">Add a sarcastic pen. Or a freshie. We won&apos;t judge.</p>
              <button type="button" className="btn-primary mt-2" onClick={keepShopping}>
                Keep shopping
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map(({ product, qty }) => (
                <li
                  key={product.id}
                  className="flex gap-3 rounded-2xl border border-line bg-ink/50 p-3"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink-3">
                    {customPreviewSrc(product.custom) ? (
                      <img
                        src={customPreviewSrc(product.custom)}
                        alt=""
                        className="h-full w-full object-contain bg-ink p-1"
                      />
                    ) : (
                      <ProductArt product={product} className="h-full w-full" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="line-clamp-2 break-words font-display text-sm leading-snug text-cream">
                          {product.name}
                        </p>
                        <p className="text-xs text-mute">
                          {formatCustomCartMeta(product.custom) ??
                            `$${product.price.toFixed(2)} each`}
                        </p>
                        {product.custom?.bannerNotes && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-mute">
                            Notes: {product.custom.bannerNotes}
                          </p>
                        )}
                        {product.custom?.canvasNotes && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-mute">
                            Notes: {product.custom.canvasNotes}
                          </p>
                        )}
                        {product.custom?.cardNotes && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-mute">
                            Notes: {product.custom.cardNotes}
                          </p>
                        )}
                        {product.custom?.estimateOnly && (
                          <p className="mt-0.5 text-[11px] font-bold text-lavender">
                            Estimate — final quote by email
                          </p>
                        )}
                        {product.custom?.freshieScent && (
                          <p className="mt-0.5 text-[11px] font-bold text-cyan">
                            Scent: {product.custom.freshieScent}
                          </p>
                        )}
                        {product.custom?.freshieNote && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-mute">
                            Note: {product.custom.freshieNote}
                          </p>
                        )}
                        {product.custom?.logoComingByEmail && !product.custom.artworkUrl && (
                          <p className="mt-0.5 text-[11px] font-bold text-lavender">
                            {product.custom.type === 'banner' ||
                            product.custom.type === 'canvas' ||
                            product.custom.type === 'business-cards' ||
                            product.custom.type === 'thank-you-cards'
                              ? 'Artwork coming by email'
                              : 'Logo coming by email'}
                          </p>
                        )}
                        {(product.custom?.artworkFileName || product.custom?.fileName) &&
                          !customPreviewSrc(product.custom) && (
                          <p className="mt-0.5 truncate text-[11px] text-mute">
                            File: {product.custom.artworkFileName || product.custom.fileName}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(product.id)}
                        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-mute hover:text-pink active:text-pink"
                        aria-label={`Remove ${product.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-full border border-line">
                        <button
                          type="button"
                          className="min-h-11 min-w-11 inline-flex items-center justify-center p-1.5 text-mute hover:text-cream active:text-cream"
                          onClick={() => setQty(product.id, qty - 1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-6 text-center text-sm font-bold">{qty}</span>
                        <button
                          type="button"
                          className="min-h-11 min-w-11 inline-flex items-center justify-center p-1.5 text-mute hover:text-cream active:text-cream"
                          onClick={() => setQty(product.id, qty + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="font-display text-sm text-lime">
                        ${(product.price * qty).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="space-y-3 border-t border-line p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-mute">Subtotal</span>
              <span className="font-display text-xl text-lime">${total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-mute">Demo checkout — no real payments charged.</p>
            <Link to="/checkout" onClick={closeCart} className="btn-primary min-h-11 w-full">
              Checkout
            </Link>
            <button
              type="button"
              onClick={keepShopping}
              className="btn-ghost min-h-11 w-full !py-2.5 text-sm"
            >
              Keep shopping
            </button>
          </div>
        )}
      </aside>
    </div>
  )
}
