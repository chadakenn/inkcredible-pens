import { Link } from 'react-router-dom'
import { Compass, Home, Search } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24">
      <div className="paint-ring rounded-3xl p-[2px]">
        <div className="flex h-20 w-20 items-center justify-center rounded-[1.35rem] bg-ink-2">
          <Compass className="h-9 w-9 text-cyan" />
        </div>
      </div>
      <p className="mt-6 text-xs font-extrabold uppercase tracking-wider text-pink">404</p>
      <h1 className="mt-2 font-display text-3xl sm:text-4xl">
        This page ghosted us
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-mute sm:text-base">
        No pens, stickers, freshies, or canvas live at this URL. Either it never existed, or it wandered
        off mid-sarcasm. Let’s get you back to the good stuff.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Link to="/" className="btn-primary min-h-11">
          <Home className="h-4 w-4" /> Home
        </Link>
        <Link to="/shop" className="btn-outline-light min-h-11">
          Shop categories
        </Link>
        <Link to="/search" className="btn-ghost min-h-11">
          <Search className="h-4 w-4 text-cyan" /> Search
        </Link>
      </div>
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
            className="rounded-full border border-line bg-ink-2 px-3 py-1.5 text-xs font-extrabold text-cream transition hover:border-cyan/50 hover:text-cyan"
          >
            {label}
          </Link>
        ))}
      </div>
    </section>
  )
}
