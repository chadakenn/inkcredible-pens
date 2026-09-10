import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PackageOpen, Search } from 'lucide-react'
import { useCatalog } from '../store/catalog'
import ProductCard from '../components/ProductCard'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const PAGE_SIZE = 24

export default function SearchPage() {
  useDocumentTitle('Search')
  const products = useCatalog((s) => s.products)
  const [params, setParams] = useSearchParams()
  const urlQ = params.get('q') ?? ''
  const [input, setInput] = useState(urlQ)
  const [debounced, setDebounced] = useState(urlQ)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipUrlSync = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // External navigation (e.g. header → /search?q=foo) updates local state
  useEffect(() => {
    if (skipUrlSync.current) {
      skipUrlSync.current = false
      return
    }
    setInput(urlQ)
    setDebounced(urlQ)
  }, [urlQ])

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(input), 220)
    return () => window.clearTimeout(t)
  }, [input])

  // Push debounced query into the URL
  useEffect(() => {
    const next = debounced.trim()
    if (next === urlQ) return
    skipUrlSync.current = true
    const sp = new URLSearchParams()
    if (next) sp.set('q', next)
    setParams(sp, { replace: true })
  }, [debounced, urlQ, setParams])

  const q = debounced.trim().toLowerCase()

  const results = useMemo(() => {
    if (!q) return []
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    )
  }, [products, q])

  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [q])

  const shown = results.slice(0, visible)
  const hasMore = visible < results.length

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <p className="text-xs font-extrabold uppercase tracking-wider text-cyan">Search</p>
        <h1 className="font-display text-3xl sm:text-4xl">Find the goods</h1>
        <p className="mt-1 max-w-lg text-sm text-mute">
          Hunt across pens, stickers, freshies &amp; custom — by name or vibe.
        </p>
      </div>

      <div className="sticky top-[3.6rem] z-20 -mx-4 mb-6 border-y border-line/80 bg-ink/90 px-4 py-3 backdrop-blur-xl sm:top-[4.1rem] sm:mx-0 sm:rounded-2xl sm:border sm:px-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
          <input
            ref={inputRef}
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search all products…"
            className="min-h-11 w-full rounded-full border border-line bg-ink-2 py-2.5 pl-10 pr-4 text-sm text-cream placeholder:text-mute outline-none transition focus:border-cyan/60 focus:ring-2 focus:ring-cyan/20"
            aria-label="Search all products"
          />
        </div>
        <p className="mt-2 text-xs font-bold text-mute">
          {!q
            ? `${products.length} products ready — start typing`
            : `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${debounced.trim()}”`}
        </p>
      </div>

      {!q ? (
        <div className="rounded-3xl border border-dashed border-line bg-ink-2/80 px-6 py-14 text-center">
          <Search className="mx-auto h-8 w-8 text-mute" />
          <p className="mt-4 font-display text-xl text-cream">What are we hunting?</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-mute">
            Try “pen”, “sticker”, a design name, or hop a category instead.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {(
              [
                ['Pens', '/pens'],
                ['Stickers', '/stickers'],
                ['Freshies', '/freshies'],
                ['Canvas', '/canvas'],
                ['Custom', '/custom'],
              ] as const
            ).map(([label, to]) => (
              <Link
                key={to}
                to={to}
                className="rounded-full border border-line bg-ink px-3 py-1.5 text-xs font-extrabold text-cream transition hover:border-cyan/50 hover:text-cyan"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-ink-2/80 px-6 py-14 text-center">
          <PackageOpen className="mx-auto h-8 w-8 text-mute" />
          <p className="mt-4 font-display text-xl text-cream">No matches</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-mute">
            Nothing matched “{debounced.trim()}”. Try a shorter word or browse categories.
          </p>
          <button
            type="button"
            className="btn-primary mt-6 min-h-11"
            onClick={() => setInput('')}
          >
            Clear search
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((p, i) => (
              <div
                key={p.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
              >
                <ProductCard product={p} />
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="btn-outline-light min-h-11"
              >
                Load more ({results.length - visible} left)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
