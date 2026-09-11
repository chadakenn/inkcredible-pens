import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  ChevronDown,
  ArrowRight,
  Sticker,
  StickyNote,
  Frame,
  PackageOpen,
  CreditCard,
  Heart,
  Camera,
} from 'lucide-react'
import type { Category, Product } from '../data/products'
import { useCatalog } from '../store/catalog'
import ProductCard from '../components/ProductCard'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const PAGE_SIZE = 24
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'name-asc'

const CATEGORY_META: Record<
  Category,
  { title: string; blurb: string; accent: string }
> = {
  Pens: {
    title: 'Pens',
    blurb: 'Sarcastic beaded pens — handmade with hustle.',
    accent: 'text-cyan',
  },
  Stickers: {
    title: 'Stickers',
    blurb: 'Faith, man, mystery & sass — hundreds of designs.',
    accent: 'text-pink',
  },
  'Car Freshies': {
    title: 'Car Freshies',
    blurb: 'Hang it. Drive louder.',
    accent: 'text-lime',
  },
  Canvas: {
    title: 'Canvas',
    blurb: 'Bold wall art printed with attitude and ready to hang.',
    accent: 'text-cream',
  },
  Custom: {
    title: 'Custom Orders',
    blurb: 'Studio tools above — plus ready-made custom catalog below.',
    accent: 'text-lavender',
  },
}

function sortProducts(list: Product[], sort: SortKey): Product[] {
  if (sort === 'featured') return list
  const next = [...list]
  if (sort === 'price-asc') next.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
  else if (sort === 'price-desc') next.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
  else if (sort === 'name-asc') next.sort((a, b) => a.name.localeCompare(b.name))
  return next
}

function nameStartsWithLetter(name: string, letter: string): boolean {
  const ch = name.trim().charAt(0).toUpperCase()
  if (letter === '#') return ch < 'A' || ch > 'Z'
  return ch === letter
}

const studioCards = [
  {
    to: '/custom/photo-freshie',
    title: 'Photo freshie',
    blurb: 'A 3-inch round scented freshie with your photo in the center — $10.',
    label: 'Configurator',
    labelClass: 'text-lime',
    border: 'border-lime/40 hover:border-lime/70',
    glow: 'shadow-[0_0_40px_rgba(200,245,66,0.12)]',
    bar: 'from-lime to-cyan',
    bg: 'to-lime/10',
    btn: 'bg-lime text-ink',
    Icon: Camera,
  },
  {
    to: '/custom/logo-stickers',
    title: 'Logo stickers',
    blurb: 'Vinyl, holo, or glow — live pack pricing.',
    label: 'Configurator',
    labelClass: 'text-lavender',
    border: 'border-lavender/40 hover:border-lavender/70',
    glow: 'shadow-[0_0_40px_rgba(192,132,252,0.12)]',
    bar: 'from-cyan via-lavender to-pink',
    bg: 'to-lavender/10',
    btn: 'bg-lavender text-ink',
    Icon: Sticker,
  },
  {
    to: '/custom/banners',
    title: 'Banners',
    blurb: 'Size presets from $80 — request a free quote.',
    label: 'Configurator',
    labelClass: 'text-cyan',
    border: 'border-cyan/40 hover:border-cyan/70',
    glow: 'shadow-[0_0_40px_rgba(34,211,238,0.1)]',
    bar: 'from-cyan to-lime',
    bg: 'to-cyan/10',
    btn: 'bg-cyan text-ink',
    Icon: StickyNote,
  },
  {
    to: '/custom/canvas',
    title: 'Canvas',
    blurb: 'Upload art, pick size & finish — estimate pricing.',
    label: 'Estimate',
    labelClass: 'text-pink',
    border: 'border-pink/40 hover:border-pink/70',
    glow: 'shadow-[0_0_40px_rgba(255,45,149,0.1)]',
    bar: 'from-pink to-lavender',
    bg: 'to-pink/10',
    btn: 'bg-pink text-white',
    Icon: Frame,
  },
  {
    to: '/custom/business-cards',
    title: 'Business cards',
    blurb: '50 from $30 · 100 for $50 — double-sided packs.',
    label: 'Configurator',
    labelClass: 'text-lime',
    border: 'border-lime/40 hover:border-lime/70',
    glow: 'shadow-[0_0_40px_rgba(200,245,66,0.1)]',
    bar: 'from-lime via-lavender to-pink',
    bg: 'to-lime/10',
    btn: 'bg-lime text-ink',
    Icon: CreditCard,
  },
  {
    to: '/custom/thank-you-cards',
    title: 'Thank you cards',
    blurb: '25 from $40 · 50 for $50 — 5.5" × 4.25" double-sided.',
    label: 'Configurator',
    labelClass: 'text-pink',
    border: 'border-pink/40 hover:border-pink/70',
    glow: 'shadow-[0_0_40px_rgba(255,45,149,0.1)]',
    bar: 'from-pink via-lime to-lavender',
    bg: 'to-pink/10',
    btn: 'bg-pink text-white',
    Icon: Heart,
  },
] as const

export default function CategoryPage({ category }: { category: Category }) {
  useDocumentTitle(CATEGORY_META[category].title)
  const products = useCatalog((s) => s.products)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('featured')
  const [letter, setLetter] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const showLetterFilter = category === 'Stickers'

  const meta = CATEGORY_META[category]

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query), 220)
    return () => window.clearTimeout(t)
  }, [query])

  const letterCounts = useMemo(() => {
    if (!showLetterFilter) return {} as Record<string, number>
    const inCat = products.filter((p) => p.category === category)
    const counts: Record<string, number> = { '#': 0 }
    for (const L of LETTERS) counts[L] = 0
    for (const p of inCat) {
      const ch = p.name.trim().charAt(0).toUpperCase()
      if (ch >= 'A' && ch <= 'Z') counts[ch] += 1
      else counts['#'] += 1
    }
    return counts
  }, [products, category, showLetterFilter])

  const filtered = useMemo(() => {
    const inCat = products.filter((p) => p.category === category)
    const q = debouncedQuery.trim().toLowerCase()
    let matched = !q
      ? inCat
      : inCat.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.tagline.toLowerCase().includes(q),
        )
    if (showLetterFilter && letter) {
      matched = matched.filter((p) => nameStartsWithLetter(p.name, letter))
    }
    return sortProducts(matched, sort)
  }, [products, category, debouncedQuery, sort, letter, showLetterFilter])

  useEffect(() => {
    setVisible(PAGE_SIZE)
  }, [category, debouncedQuery, sort, letter])

  useEffect(() => {
    setQuery('')
    setDebouncedQuery('')
    setSort('featured')
    setLetter(null)
  }, [category])

  const shown = filtered.slice(0, visible)
  const hasMore = visible < filtered.length
  const totalInCat = products.filter((p) => p.category === category).length
  const searching = query !== debouncedQuery

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {category === 'Custom' && (
          <div className="mb-10">
            <div className="mb-4">
              <p className="text-xs font-extrabold uppercase tracking-wider text-lavender">
                Custom studio
              </p>
              <h2 className="font-display text-2xl text-cream sm:text-3xl">
                Design it your way
              </h2>
              <p className="mt-1 max-w-xl text-sm text-mute">
                Logo stickers, banners, canvas, and business cards — then browse ready-made
                custom pieces below.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {studioCards.map((c) => {
                const Icon = c.Icon
                return (
                  <Link
                    key={c.to}
                    to={c.to}
                    className={`group relative overflow-hidden rounded-3xl border bg-gradient-to-br from-ink-2 via-ink-2 ${c.bg} p-5 transition ${c.border} ${c.glow}`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.bar}`} />
                    <p
                      className={`inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider ${c.labelClass}`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {c.label}
                    </p>
                    <h3 className="mt-2 font-display text-xl text-cream sm:text-2xl">
                      {c.title}
                    </h3>
                    <p className="mt-2 text-sm text-mute">{c.blurb}</p>
                    <span
                      className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-semibold transition group-hover:brightness-110 ${c.btn}`}
                    >
                      Open <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-xs font-extrabold uppercase tracking-wider ${meta.accent}`}>
              {category === 'Custom' ? 'Catalog' : 'Category'}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl">{meta.title}</h1>
            <p className="mt-1 max-w-lg text-sm text-mute sm:text-base">{meta.blurb}</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm" aria-label="Other categories">
            {(
              [
                ['Pens', '/pens'],
                ['Stickers', '/stickers'],
                ['Freshies', '/freshies'],
                ['Canvas', '/canvas'],
                ['Custom', '/custom'],
              ] as const
            ).map(([label, to]) => {
              const active =
                (label === 'Pens' && category === 'Pens') ||
                (label === 'Stickers' && category === 'Stickers') ||
                (label === 'Freshies' && category === 'Car Freshies') ||
                (label === 'Canvas' && category === 'Canvas') ||
                (label === 'Custom' && category === 'Custom')
              return (
                <Link
                  key={to}
                  to={to}
                  className={`rounded-full px-3 py-1.5 font-bold transition ${
                    active
                      ? 'bg-cream text-ink'
                      : 'border border-line bg-ink-2 text-mute hover:text-cream'
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="sticky top-[3.6rem] z-20 -mx-4 mb-4 border-y border-line/80 bg-ink/90 px-4 py-3 backdrop-blur-xl sm:top-[4.1rem] sm:mx-0 sm:rounded-2xl sm:border sm:px-3 sm:py-2.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${meta.title.toLowerCase()}…`}
                className="min-h-11 w-full rounded-full border border-line bg-ink-2 py-2.5 pl-10 pr-4 text-sm text-cream placeholder:text-mute outline-none transition focus:border-cyan/60 focus:ring-2 focus:ring-cyan/20"
                aria-label={`Search ${meta.title}`}
              />
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm text-mute">
              <span className="hidden whitespace-nowrap font-bold sm:inline">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="min-h-11 w-full rounded-full border border-line bg-ink-2 px-4 text-sm font-bold text-cream outline-none transition focus:border-cyan/60 sm:w-auto sm:min-w-[11.5rem]"
                aria-label="Sort products"
              >
                <option value="featured">Featured</option>
                <option value="price-asc">Price: low → high</option>
                <option value="price-desc">Price: high → low</option>
                <option value="name-asc">Name A–Z</option>
              </select>
            </label>
          </div>
          <p className="mt-2 text-xs font-bold text-mute sm:mt-2.5">
            {searching ? (
              <span className="text-cyan">Searching…</span>
            ) : (
              <>
                {filtered.length} {filtered.length === 1 ? 'product' : 'products'}
                {debouncedQuery.trim()
                  ? ` matching “${debouncedQuery.trim()}”`
                  : ` in ${meta.title}`}
                {letter ? ` · ${letter === '#' ? '0–9 / symbols' : `letter ${letter}`}` : ''}
                {sort !== 'featured' ? ' · sorted' : ''}
              </>
            )}
          </p>
        </div>

        {showLetterFilter && (
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-extrabold uppercase tracking-wider text-pink">
                Jump by letter
              </p>
              {letter && (
                <button
                  type="button"
                  onClick={() => setLetter(null)}
                  className="text-xs font-bold text-mute transition hover:text-cyan"
                >
                  Clear letter
                </button>
              )}
            </div>
            <div
              className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-1"
              role="group"
              aria-label="Filter stickers by starting letter"
            >
              <button
                type="button"
                onClick={() => setLetter(null)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                  letter === null
                    ? 'bg-pink text-white'
                    : 'border border-line bg-ink-2 text-mute hover:text-cream'
                }`}
              >
                All
              </button>
              {LETTERS.map((L) => {
                const count = letterCounts[L] ?? 0
                const disabled = count === 0
                return (
                  <button
                    key={L}
                    type="button"
                    disabled={disabled}
                    onClick={() => setLetter((cur) => (cur === L ? null : L))}
                    className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs font-extrabold transition ${
                      letter === L
                        ? 'bg-cream text-ink'
                        : disabled
                          ? 'border border-line/50 bg-ink-2/40 text-mute/40'
                          : 'border border-line bg-ink-2 text-mute hover:border-pink/40 hover:text-pink'
                    }`}
                    aria-pressed={letter === L}
                    title={disabled ? `No stickers starting with ${L}` : `${count} starting with ${L}`}
                  >
                    {L}
                  </button>
                )
              })}
              {(letterCounts['#'] ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setLetter((cur) => (cur === '#' ? null : '#'))}
                  className={`shrink-0 rounded-full px-2.5 py-1.5 text-xs font-extrabold transition ${
                    letter === '#'
                      ? 'bg-cream text-ink'
                      : 'border border-line bg-ink-2 text-mute hover:border-pink/40 hover:text-pink'
                  }`}
                  aria-pressed={letter === '#'}
                  title={`${letterCounts['#']} starting with a number or symbol`}
                >
                  #
                </button>
              )}
            </div>
          </div>
        )}

        {shown.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-dashed border-cyan/25 bg-gradient-to-br from-ink-2 via-ink-2 to-cyan/5 px-6 py-16 text-center shadow-[0_0_48px_rgba(34,211,238,0.06)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan via-lime to-pink" />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan/30 bg-ink shadow-[0_0_28px_rgba(34,211,238,0.18)]">
              <PackageOpen className="h-7 w-7 text-cyan" />
            </div>
            <p className="mt-5 font-display text-2xl text-cream">
              {debouncedQuery.trim() || letter
                ? 'Nothing matches that vibe'
                : 'This aisle is empty'}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-mute">
              {debouncedQuery.trim() || letter
                ? `No ${meta.title.toLowerCase()} matched “${debouncedQuery.trim() || (letter === '#' ? 'symbols' : letter)}”${letter && debouncedQuery.trim() ? ' with that letter filter' : ''}. Clear filters to see all ${totalInCat} items, or try a broader search.`
                : `We're still stocking ${meta.title.toLowerCase()} — check another category or hit us at inkcredible.pens@gmail.com.`}
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              {(debouncedQuery.trim() || letter) && (
                <button
                  type="button"
                  className="btn-primary min-h-11"
                  onClick={() => {
                    setQuery('')
                    setDebouncedQuery('')
                    setLetter(null)
                  }}
                >
                  Clear filters
                </button>
              )}
              <Link to="/shop" className="btn-ghost min-h-11">
                Browse categories
              </Link>
              <Link to="/search" className="btn-ghost min-h-11">
                Search all
              </Link>
            </div>
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

            <div className="mt-8 flex flex-col items-center gap-3">
              <div className="w-full max-w-xs">
                <div className="mb-2 flex justify-between text-xs font-bold text-mute">
                  <span>
                    Showing {shown.length} of {filtered.length}
                  </span>
                  <span>{Math.min(100, Math.round((shown.length / filtered.length) * 100))}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan via-lime to-pink transition-all duration-300"
                    style={{ width: `${Math.min(100, (shown.length / filtered.length) * 100)}%` }}
                  />
                </div>
              </div>
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="btn-outline-light inline-flex min-h-11 items-center gap-2"
                >
                  Load more <ChevronDown className="h-4 w-4" />
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </>
  )
}
