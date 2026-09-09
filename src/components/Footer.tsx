import { Link } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import LogoMark from './LogoMark'
import GraphicsLogo from './GraphicsLogo'

export default function Footer() {
  return (
    <footer id="about" className="border-t border-line bg-ink">
      <div className="h-3 checker-band opacity-40" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            <Link to="/" className="inline-flex min-w-0" aria-label="Inkcredible Pens home">
              <LogoMark size="md" />
            </Link>
            <Link
              to="/custom/banners"
              className="inline-flex min-w-0"
              aria-label="Inkcredible Graphics — custom banners"
              title="Inkcredible Graphics"
            >
              <GraphicsLogo size="md" />
            </Link>
          </div>
          <p className="text-sm leading-relaxed text-mute">
            Humor. Hustle. Heart. Cheeky handmade pens, stickers &amp; freshies —
            youth-oriented, irreverent, and actually fun.
          </p>
          <p className="text-sm font-extrabold text-lime">Shop small. Make it Inkcredible.</p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-display text-cream">Shop</p>
          <Link to="/pens" className="block text-mute transition hover:text-cyan">Pens</Link>
          <Link to="/stickers" className="block text-mute transition hover:text-cyan">Stickers</Link>
          <Link to="/freshies" className="block text-mute transition hover:text-cyan">Freshies</Link>
          <Link to="/custom" className="block text-mute transition hover:text-cyan">Custom studio</Link>
          <Link to="/shop" className="block text-mute transition hover:text-cyan">All categories</Link>
          <Link to="/search" className="block text-mute transition hover:text-cyan">Search</Link>
          <a
            href="https://www.inkcrediblepens.org"
            target="_blank"
            rel="noreferrer"
            className="block text-mute transition hover:text-cyan"
          >
            Live Square site
          </a>
        </div>

        <div className="space-y-3 text-sm">
          <p className="font-display text-cream">Contact</p>
          <Link
            to="/contact"
            className="block font-bold text-cyan transition hover:text-aqua"
          >
            Contact &amp; customs tips
          </Link>
          <a
            href="mailto:inkcredible.pens@gmail.com"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-ink-2 px-4 py-2.5 font-semibold text-cream transition hover:border-pink/50"
          >
            <Mail className="h-4 w-4 text-pink" />
            inkcredible.pens@gmail.com
          </a>
          <p className="text-mute">Created with Humor. Backed by Heart. Fueled by Real Life.</p>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-mute/80 transition hover:text-cyan"
            title="Manage store"
          >
            <Lock className="h-3.5 w-3.5" />
            Manage store
          </Link>
        </div>
      </div>
      <div className="flex h-1 w-full">
        <span className="flex-1 bg-cyan" />
        <span className="flex-1 bg-lime" />
        <span className="flex-1 bg-pink" />
        <span className="flex-1 bg-lavender" />
      </div>
      <div className="border-t border-line py-4 text-center text-xs text-mute">
        © {new Date().getFullYear()} Inkcredible Pens · Shop small. Make it Inkcredible.
      </div>
    </footer>
  )
}
