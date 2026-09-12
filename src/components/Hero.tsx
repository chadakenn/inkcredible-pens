import { Link } from 'react-router-dom'
import { ArrowRight, Car, Frame, Mail, MapPin, PenLine, Sparkles, Sticker, Truck, Wand2 } from 'lucide-react'
import { useMemo } from 'react'
import { useCatalog } from '../store/catalog'
import ProductArt from './ProductArt'
import type { Category } from '../data/products'
import { pathForCustomProduct } from '../store/shop'

const HERO_PICK_SEED = crypto.getRandomValues(new Uint32Array(1))[0]

const shopPaths: {
  id: string
  title: string
  blurb: string
  accent: string
  chip: string
  to: string
  category: Category
  Icon: typeof PenLine
}[] = [
  {
    id: 'pens',
    title: 'Pens',
    blurb: 'Sarcastic beaded pens from $6',
    accent: 'from-cyan to-lavender',
    chip: 'bg-cyan text-ink',
    to: '/pens',
    category: 'Pens',
    Icon: PenLine,
  },
  {
    id: 'stickers',
    title: 'Stickers',
    blurb: 'Faith, man, mystery & sass',
    accent: 'from-pink to-purple',
    chip: 'bg-pink text-white',
    to: '/stickers',
    category: 'Stickers',
    Icon: Sticker,
  },
  {
    id: 'freshies',
    title: 'Car Freshies',
    blurb: 'Hang it. Drive louder.',
    accent: 'from-lime to-cyan',
    chip: 'bg-lime text-ink',
    to: '/freshies',
    category: 'Car Freshies',
    Icon: Car,
  },
  {
    id: 'canvas',
    title: 'Canvas',
    blurb: 'Bold wall art, ready to hang',
    accent: 'from-cream to-lavender',
    chip: 'bg-cream text-ink',
    to: '/canvas',
    category: 'Canvas',
    Icon: Frame,
  },
  {
    id: 'custom',
    title: 'Custom studio',
    blurb: 'Logo stickers, banners & canvas',
    accent: 'from-lavender to-pink',
    chip: 'bg-lavender text-ink',
    to: '/custom',
    category: 'Custom',
    Icon: Wand2,
  },
]

export default function Hero() {
  const products = useCatalog((s) => s.products)
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of products) {
      map[p.category] = (map[p.category] ?? 0) + 1
    }
    return map
  }, [products])
  const featuredProduct = useMemo(() => {
    const choices = products.filter((product) => !product.hidden && product.inventoryQuantity !== 0 && product.imageUrl)
    return choices.length ? choices[HERO_PICK_SEED % choices.length] : null
  }, [products])
  const featuredPath = featuredProduct ? pathForCustomProduct(featuredProduct.id) ?? `/product/${featuredProduct.id}` : '/shop'

  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="absolute inset-x-0 top-0 h-24 checker-band opacity-[0.1]" />
      <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-cyan/20 blur-3xl animate-glow" />
      <div className="absolute -right-20 top-8 h-56 w-56 rounded-full bg-pink/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-lavender/15 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 pt-8 pb-7 sm:px-6 sm:pt-10 sm:pb-9">
        <div className="grid gap-7 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div className="animate-fade-up space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan/40 bg-ink-2 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-cyan">
              <Sparkles className="h-3.5 w-3.5" />
              Humor · Hustle · Heart
            </p>
            <h1 className="font-display text-[1.85rem] leading-[1.05] tracking-tight min-[380px]:text-4xl sm:text-5xl lg:text-[3.25rem]">
              Sarcastic pens.
              <br />
              <span className="text-gradient">Stickers that slap.</span>
              <br />
              Freshies &amp; canvas with attitude.
            </h1>
            <p className="max-w-xl text-[0.95rem] leading-relaxed text-mute sm:text-base">
              Handmade with Humor. Backed by Heart. Fueled by Real Life. Shop the catalog —
              or design custom logo stickers, banners &amp; canvas in the studio.
            </p>
            <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <Link to="/pens" className="btn-primary min-h-11 w-full sm:w-auto">
                Shop pens <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/custom" className="btn-ghost min-h-11 w-full sm:w-auto">
                <Mail className="h-4 w-4 text-cyan" /> Custom studio
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-xs font-bold text-mute"><span className="inline-flex items-center gap-1.5"><Truck className="h-4 w-4 text-lime" /> Free shipping over $60</span><span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-pink" /> Made to order in Ohio</span></div>
          </div>

          <div
            className="animate-fade-up relative mx-auto w-full max-w-sm"
            style={{ animationDelay: '60ms' }}
          >
            <div className="relative overflow-hidden rounded-[1.75rem] border-4 border-cyan checker-md p-1 shadow-[0_0_40px_rgba(34,211,238,0.22)]">
              <Link to={featuredPath} className="group block overflow-hidden rounded-[1.4rem] bg-ink/95 backdrop-blur-sm">
                {featuredProduct ? <><div className="aspect-[4/3] overflow-hidden bg-ink-3"><ProductArt product={featuredProduct} className="h-full w-full transition duration-500 group-hover:scale-[1.03]" /></div><div className="p-5"><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-pink px-2.5 py-1 text-[10px] font-extrabold uppercase text-white">Random pick</span><span className="font-display text-xl text-lime">{featuredProduct.optionGroups?.length ? 'From ' : ''}${featuredProduct.price.toFixed(2)}</span></div><p className="mt-3 text-xs font-extrabold uppercase tracking-wider text-cyan">{featuredProduct.category}</p><h2 className="mt-1 line-clamp-2 font-display text-2xl leading-tight text-cream">{featuredProduct.name}</h2><span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-lime">See this product <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></div></> : <div className="flex aspect-square items-center justify-center p-8 text-center"><p className="font-display text-2xl text-cream">Shop small.<br />Make it Inkcredible.</p></div>}
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {shopPaths.map((c, i) => {
            const count = counts[c.category] ?? 0
            const Icon = c.Icon
            return (
              <Link
                key={c.id}
                to={c.to}
                className="group relative overflow-hidden rounded-2xl border border-line bg-ink-2 p-4 text-left transition active:bg-ink-3 hover:-translate-y-0.5 hover:border-cream/30 hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] animate-fade-up"
                style={{ animationDelay: `${80 + i * 40}ms` }}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${c.accent}`} />
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${c.chip}`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.5} />
                  </span>
                  <span className="rounded-full border border-line bg-ink px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-mute">
                    {count > 0 ? `${count} items` : 'Shop'}
                  </span>
                </div>
                <h2 className="mt-3 font-display text-xl text-cream transition group-hover:text-lime group-active:text-lime">
                  {c.title}
                </h2>
                <p className="mt-1 text-sm text-mute">{c.blurb}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-cyan">
                  Browse <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="relative border-t border-line bg-ink-2 overflow-hidden py-2.5">
        <div className="animate-marquee flex w-max gap-8 whitespace-nowrap px-4 font-display text-sm italic text-mute">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-8">
              {[
                'Pens',
                'Stickers',
                'Car Freshies',
                'Canvas',
                'Custom studio',
                'Mystery Packs',
                'Faith Stickers',
                'Man Stickers',
                'Shop small. Make it Inkcredible.',
              ].map((label) => (
                <span key={`${i}-${label}`} className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-pink" />
                  {label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
