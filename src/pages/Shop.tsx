import { Link } from 'react-router-dom'
import { ArrowRight, Car, PenLine, Sticker, Wand2 } from 'lucide-react'
import { useCatalog } from '../store/catalog'
import type { Category } from '../data/products'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const cats: {
  category: Category
  to: string
  title: string
  blurb: string
  accent: string
  chip: string
  Icon: typeof PenLine
}[] = [
  {
    category: 'Pens',
    to: '/pens',
    title: 'Pens',
    blurb: 'Sarcastic beaded pens from $6',
    accent: 'from-cyan to-lavender',
    chip: 'bg-cyan text-ink',
    Icon: PenLine,
  },
  {
    category: 'Stickers',
    to: '/stickers',
    title: 'Stickers',
    blurb: 'Faith, man, mystery & sass',
    accent: 'from-pink to-purple',
    chip: 'bg-pink text-white',
    Icon: Sticker,
  },
  {
    category: 'Car Freshies',
    to: '/freshies',
    title: 'Car Freshies',
    blurb: 'Hang it. Drive louder.',
    accent: 'from-lime to-cyan',
    chip: 'bg-lime text-ink',
    Icon: Car,
  },
  {
    category: 'Custom',
    to: '/custom',
    title: 'Custom studio',
    blurb: 'Logo stickers, banners, canvas & cards',
    accent: 'from-lavender to-pink',
    chip: 'bg-lavender text-ink',
    Icon: Wand2,
  },
]

export default function Shop() {
  useDocumentTitle('Shop')
  const products = useCatalog((s) => s.products)
  const counts = cats.map((c) => ({
    ...c,
    count: products.filter((p) => p.category === c.category).length,
  }))

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-8">
        <p className="text-xs font-extrabold uppercase tracking-wider text-cyan">Shop</p>
        <h1 className="font-display text-3xl sm:text-4xl">Pick a category</h1>
        <p className="mt-2 max-w-lg text-sm text-mute sm:text-base">
          Browse by type — full catalogs with search &amp; sort on every page.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map((c) => {
          const Icon = c.Icon
          return (
            <Link
              key={c.to}
              to={c.to}
              className="group relative overflow-hidden rounded-2xl border border-line bg-ink-2 p-5 transition hover:-translate-y-0.5 hover:border-cream/30 hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.accent}`} />
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${c.chip}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <span className="rounded-full border border-line bg-ink px-2 py-0.5 text-[10px] font-extrabold uppercase text-mute">
                  {c.count} items
                </span>
              </div>
              <h2 className="mt-3 font-display text-2xl text-cream transition group-hover:text-lime">
                {c.title}
              </h2>
              <p className="mt-1 text-sm text-mute">{c.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-cyan">
                Browse <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
