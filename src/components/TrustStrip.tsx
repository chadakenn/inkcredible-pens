import { MapPin, Palette, ShieldCheck, Truck } from 'lucide-react'

const values = [
  {
    Icon: MapPin,
    title: 'Made in Ohio',
    blurb: 'Made to order and packed by a real small business.',
    accent: 'text-pink',
    ring: 'border-pink/30 bg-pink/10',
  },
  {
    Icon: ShieldCheck,
    title: 'Secure checkout',
    blurb: 'Payments are handled securely through Stripe.',
    accent: 'text-lime',
    ring: 'border-lime/30 bg-lime/10',
  },
  {
    Icon: Truck,
    title: 'Free over $60',
    blurb: 'Standard shipping is free when your order tops $60.',
    accent: 'text-cyan',
    ring: 'border-cyan/30 bg-cyan/10',
  },
  { Icon: Palette, title: 'Artwork approval', blurb: 'Custom artwork is confirmed before production starts.', accent: 'text-lavender', ring: 'border-lavender/30 bg-lavender/10' },
] as const

export default function TrustStrip() {
  return (
    <section className="border-y border-line/80 bg-ink-2/60" aria-label="Why Inkcredible">
      <div className="overflow-hidden border-b border-line/60 py-2.5">
        <div className="animate-marquee flex w-max gap-8 whitespace-nowrap text-xs font-extrabold uppercase tracking-wider text-mute">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex gap-8 px-4" aria-hidden={copy === 1}>
              {[
                'Shop small',
                '·',
                'Made with sarcasm',
                '·',
                'Ships from us',
                '·',
                'Humor · Hustle · Heart',
                '·',
                'Youth-oriented & irreverent',
                '·',
                'Actually fun',
                '·',
              ].map((t, i) => (
                <span
                  key={`${copy}-${i}`}
                  className={
                    t === '·'
                      ? 'text-line'
                      : i % 6 === 0
                        ? 'text-cyan'
                        : i % 6 === 2
                          ? 'text-lime'
                          : i % 6 === 4
                            ? 'text-pink'
                            : 'text-lavender'
                  }
                >
                  {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 sm:px-6 sm:py-9">
        {values.map(({ Icon, title, blurb, accent, ring }) => (
          <div
            key={title}
            className="rounded-2xl border border-line bg-ink px-4 py-4 transition hover:border-cream/20"
          >
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${ring}`}
            >
              <Icon className={`h-4 w-4 ${accent}`} strokeWidth={2.5} />
            </span>
            <h3 className={`mt-3 font-display text-lg ${accent}`}>{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-mute">{blurb}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
