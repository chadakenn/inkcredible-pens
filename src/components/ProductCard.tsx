import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Plus } from 'lucide-react'
import type { Product } from '../data/products'
import { useCart } from '../store/cart'
import ProductArt from './ProductArt'
import FavoriteButton from './FavoriteButton'
import { pathForCustomProduct } from '../store/shop'

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCart((s) => s.addItem)
  const navigate = useNavigate()
  const configuratorPath = pathForCustomProduct(product.id)
  const to = configuratorPath ?? `/product/${product.id}`
  const needsScent = product.category === 'Car Freshies'
  const needsConfigure = Boolean(configuratorPath)
  const hasOptions = Boolean(product.optionGroups?.length)
  const soldOut = product.inventoryQuantity === 0
  const [addedFlash, setAddedFlash] = useState(false)

  const onAdd = () => {
    if (needsScent || needsConfigure || hasOptions) {
      navigate(to)
      return
    }
    addItem(product)
    setAddedFlash(true)
    window.setTimeout(() => setAddedFlash(false), 700)
  }

  return (
    <article className="card-shine group flex flex-col rounded-2xl border border-line bg-ink-2 transition hover:-translate-y-1 hover:border-cyan/40 hover:shadow-[0_12px_36px_rgba(34,211,238,0.1)]">
      <Link to={to} className="relative block w-full overflow-hidden rounded-t-2xl text-left">
        <div className="aspect-[4/3] bg-ink-3">
          <ProductArt product={product} className="h-full w-full" />
        </div>
        {product.badge && (
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-ink"
            style={{ background: product.accent }}
          >
            {product.badge}
          </span>
        )}
        <FavoriteButton
          productId={product.id}
          className="absolute right-3 top-3 z-10"
        />
        {/* Hover quick-view hint */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-ink/80 py-2 text-center text-[11px] font-extrabold uppercase tracking-wide text-cyan opacity-0 backdrop-blur-sm transition group-hover:translate-y-0 group-hover:opacity-100">
          Quick view
        </span>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-mute">
              {product.category}
            </p>
            <h3 className="font-display text-base leading-snug text-cream sm:text-lg">
              <Link
                to={to}
                className="line-clamp-2 break-words text-left transition hover:text-lime active:text-lime"
              >
                {product.name}
              </Link>
            </h3>
          </div>
          <p className="shrink-0 pt-0.5 font-display text-lg text-lime">
            {hasOptions ? 'From ' : ''}${product.price.toFixed(2)}
          </p>
        </div>
        <p className="text-sm text-mute line-clamp-2">{product.tagline}</p>
        {needsScent && (
          <p className="text-[11px] font-bold text-cyan">Pick scent on details →</p>
        )}
        {needsConfigure && (
          <p className="text-[11px] font-bold text-lavender">Configure pack →</p>
        )}
        {hasOptions && !needsConfigure && (
          <p className="text-[11px] font-bold text-lavender">Choose options on details →</p>
        )}
        {soldOut && <p className="text-[11px] font-extrabold text-pink">Sold out</p>}
        <div className="mt-auto flex gap-2 pt-1">
          <Link to={to} className="btn-ghost min-h-11 flex-1 !px-3 !py-2.5 text-sm text-center">
            Details
          </Link>
          <button
            type="button"
            onClick={onAdd}
            disabled={soldOut}
            className={`btn-primary min-h-11 !px-3 !py-2.5 text-sm transition ${
              addedFlash ? 'add-success-flash' : ''
            }`}
            aria-label={
              needsScent
                ? `Choose scent for ${product.name}`
                : needsConfigure
                  ? `Configure ${product.name}`
                  : `Add ${product.name} to cart`
            }
          >
            {addedFlash ? (
              <>
                <Check className="h-4 w-4" strokeWidth={3} />
                Added
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {soldOut ? 'Sold out' : needsScent ? 'Scent' : needsConfigure || hasOptions ? 'Configure' : 'Add'}
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}
