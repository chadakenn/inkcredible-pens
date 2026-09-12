import { Mail, Quote } from 'lucide-react'

const quotes = [
  {
    text: 'We make pens that roast your to-do list and stickers that out-sass your laptop.',
    label: 'Brand note',
  },
  {
    text: 'Shop small energy: packed with sarcasm, shipped with care, no corporate committee required.',
    label: 'From the studio',
  },
  {
    text: 'If it isn’t funny, useful, or weirdly charming — it doesn’t leave the workbench.',
    label: 'Our filter',
  },
] as const

export default function BrandQuotes() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-11" aria-labelledby="quotes-heading">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wider text-lavender">
            Our personality
          </p>
          <h2 id="quotes-heading" className="font-display text-3xl sm:text-4xl">
            Why Inkcredible?
          </h2>
          <p className="mt-1 max-w-lg text-sm text-mute">
            Handmade products with personality, packed by real people who care.
          </p>
        </div>
        <a
          href="mailto:inkcredible.pens@gmail.com?subject=Inkcredible%20review"
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-ink-2 px-4 py-2.5 text-sm font-extrabold text-cream transition hover:border-pink/50 hover:text-pink"
        >
          <Mail className="h-4 w-4 text-pink" />
          Email us a review
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {quotes.map((q) => (
          <figure
            key={q.label}
            className="relative overflow-hidden rounded-2xl border border-line bg-ink-2 p-5"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan via-lime to-pink" />
            <Quote className="h-5 w-5 text-cyan/70" aria-hidden />
            <blockquote className="mt-3 text-sm leading-relaxed text-foam">
              “{q.text}”
            </blockquote>
            <figcaption className="mt-4 text-[11px] font-extrabold uppercase tracking-wider text-mute">
              {q.label} · Inkcredible Pens
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
