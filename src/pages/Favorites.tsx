import { Link } from 'react-router-dom'
import { Heart, PackageOpen } from 'lucide-react'
import { useMemo } from 'react'
import ProductCard from '../components/ProductCard'
import { useCatalog } from '../store/catalog'
import { useFavorites } from '../store/favorites'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function Favorites() {
  useDocumentTitle('Favorites')
  const products = useCatalog((s) => s.products)
  const ids = useFavorites((s) => s.ids)
  const clear = useFavorites((s) => s.clear)

  const saved = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p]))
    return ids.map((id) => map.get(id)).filter(Boolean) as typeof products
  }, [products, ids])

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-pink">
            <Heart className="h-3.5 w-3.5" fill="currentColor" /> Wishlist
          </p>
          <h1 className="font-display text-3xl sm:text-4xl">Favorites</h1>
          <p className="mt-1 text-sm text-mute">
            {saved.length === 0
              ? 'Tap the heart on any product to save it here.'
              : `${saved.length} saved ${saved.length === 1 ? 'piece' : 'pieces'} — stored on this device.`}
          </p>
        </div>
        {saved.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="btn-ghost min-h-11 self-start text-sm"
          >
            Clear all
          </button>
        )}
      </div>

      {saved.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-pink/30 bg-gradient-to-br from-ink-2 via-ink-2 to-pink/5 px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-pink/30 bg-ink shadow-[0_0_28px_rgba(255,45,149,0.15)]">
            <Heart className="h-6 w-6 text-pink" />
          </div>
          <p className="mt-4 font-display text-xl text-cream">No favorites yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-mute">
            Heart pens, stickers, freshies, or canvas while you browse — they&apos;ll show up here.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link to="/pens" className="btn-primary min-h-11">
              Shop pens
            </Link>
            <Link to="/shop" className="btn-ghost min-h-11">
              Browse categories
            </Link>
          </div>
          <PackageOpen className="mx-auto mt-8 h-5 w-5 text-mute/40" aria-hidden />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {saved.map((p, i) => (
            <div
              key={p.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
