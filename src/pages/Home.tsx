import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { History } from 'lucide-react'
import Hero from '../components/Hero'
import CustomBanner from '../components/CustomBanner'
import ProductCard from '../components/ProductCard'
import TrustStrip from '../components/TrustStrip'
import BrandQuotes from '../components/BrandQuotes'
import { useCatalog } from '../store/catalog'
import { useRecentlyViewed } from '../store/recentlyViewed'
import type { Category, Product } from '../data/products'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const FEATURED_PER_CAT = 2
const FEATURED_ORDER: Category[] = ['Pens', 'Stickers', 'Car Freshies', 'Canvas', 'Custom']

const shopQuick = [
  { label: 'Shop Pens', to: '/pens' },
  { label: 'Shop Stickers', to: '/stickers' },
  { label: 'Shop Freshies', to: '/freshies' },
  { label: 'Shop Canvas', to: '/canvas' },
] as const

export default function Home() {
  useDocumentTitle('Home')
  const products = useCatalog((s) => s.products)
  const recentIds = useRecentlyViewed((s) => s.ids)

  const featured = useMemo(() => {
    const picks = []
    for (const cat of FEATURED_ORDER) {
      const inCat = products.filter((p) => p.category === cat)
      picks.push(...inCat.slice(0, FEATURED_PER_CAT))
    }
    return picks.slice(0, 8)
  }, [products])

  const recent = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p]))
    return recentIds
      .map((id) => map.get(id))
      .filter((p): p is Product => Boolean(p))
  }, [products, recentIds])

  return (
    <>
      <Hero />
      <TrustStrip />

      {recent.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-lavender">
                <History className="h-3.5 w-3.5" /> Continue browsing
              </p>
              <h2 className="font-display text-2xl sm:text-3xl">Recently viewed</h2>
            </div>
            <Link
              to="/favorites"
              className="hidden text-xs font-extrabold text-mute transition hover:text-pink sm:inline"
            >
              Favorites →
            </Link>
          </div>
          <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {recent.map((p, i) => (
              <div
                key={p.id}
                className="w-[72%] shrink-0 animate-fade-up sm:w-auto sm:shrink"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-11">
          <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-cyan">
                Featured
              </p>
              <h2 className="font-display text-3xl sm:text-4xl">Crowd favorites</h2>
              <p className="mt-1 text-sm text-mute">
                A quick taste — full catalogs live on each category page.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {shopQuick.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  className="rounded-full border border-line bg-ink-2 px-3 py-1.5 text-xs font-extrabold text-cream transition hover:border-cyan/50 hover:text-cyan"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                to="/shop"
                className="rounded-full bg-cream px-3 py-1.5 text-xs font-extrabold text-ink transition hover:bg-lime"
              >
                All categories →
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {featured.map((p, i) => (
              <div
                key={p.id}
                className="animate-fade-up"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      <BrandQuotes />
      <CustomBanner />
    </>
  )
}
