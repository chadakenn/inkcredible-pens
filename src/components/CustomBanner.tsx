import { Link } from 'react-router-dom'
import { ArrowRight, CreditCard, Frame, Heart, Sparkles, StickyNote, Sticker } from 'lucide-react'

const doors = [
  {
    to: '/custom/logo-stickers',
    title: 'Logo stickers',
    blurb: 'Vinyl, holo, or glow — live pack pricing & die-cut shapes.',
    accent: 'from-lavender via-pink to-cyan',
    chip: 'text-lavender',
    btn: 'bg-lavender text-ink',
    border: 'border-lavender/35 hover:border-lavender/70',
    glow: 'hover:shadow-[0_0_36px_rgba(192,132,252,0.14)]',
    Icon: Sticker,
    cta: 'Design stickers',
  },
  {
    to: '/custom/banners',
    title: 'Banners',
    blurb: 'Size presets from $80 — add a transparent estimate to cart.',
    accent: 'from-cyan to-lime',
    chip: 'text-cyan',
    btn: 'bg-cyan text-ink',
    border: 'border-cyan/35 hover:border-cyan/70',
    glow: 'hover:shadow-[0_0_36px_rgba(34,211,238,0.12)]',
    Icon: StickyNote,
    cta: 'Configure banner',
  },
  {
    to: '/custom/canvas',
    title: 'Canvas',
    blurb: 'Upload art, pick size & finish — estimate pricing before you order.',
    accent: 'from-pink to-lavender',
    chip: 'text-pink',
    btn: 'bg-pink text-white',
    border: 'border-pink/35 hover:border-pink/70',
    glow: 'hover:shadow-[0_0_36px_rgba(255,45,149,0.12)]',
    Icon: Frame,
    cta: 'Start canvas',
  },
  {
    to: '/custom/business-cards',
    title: 'Business cards',
    blurb: '50 from $30 · 100 for $50 — double-sided packs with live pricing.',
    accent: 'from-lime to-lavender',
    chip: 'text-lime',
    btn: 'bg-lime text-ink',
    border: 'border-lime/35 hover:border-lime/70',
    glow: 'hover:shadow-[0_0_36px_rgba(200,245,66,0.12)]',
    Icon: CreditCard,
    cta: 'Configure cards',
  },
  {
    to: '/custom/thank-you-cards',
    title: 'Thank you cards',
    blurb: '25 from $40 · 50 for $50 — 5.5" × 4.25" double-sided packs.',
    accent: 'from-pink to-lime',
    chip: 'text-pink',
    btn: 'bg-pink text-white',
    border: 'border-pink/35 hover:border-pink/70',
    glow: 'hover:shadow-[0_0_36px_rgba(255,45,149,0.12)]',
    Icon: Heart,
    cta: 'Configure cards',
  },
] as const

/** Three clear doors into the custom studio */
export default function CustomBanner() {
  return (
    <section id="custom" className="border-y border-line bg-ink-2">
      <div className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-11">
        <div className="mb-6 max-w-2xl">
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-lavender">
            <Sparkles className="h-3.5 w-3.5" /> Custom studio
          </p>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl">
            Five ways to make it yours
          </h2>
          <p className="mt-2 text-sm text-mute sm:text-base">
            Configure live, drop your art, request a quote. Final art approval by email
            before production.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {doors.map((d) => {
            const Icon = d.Icon
            return (
              <Link
                key={d.to}
                to={d.to}
                className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-ink p-5 transition hover:-translate-y-0.5 ${d.border} ${d.glow}`}
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${d.accent}`} />
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-ink-2 ${d.chip}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
                </span>
                <h3 className="mt-4 font-display text-xl text-cream">{d.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-mute">{d.blurb}</p>
                <span
                  className={`mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 font-display text-sm font-semibold transition group-hover:brightness-110 ${d.btn}`}
                >
                  {d.cta} <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
