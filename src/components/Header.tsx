import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Heart, Menu, Search, ShoppingBag, X } from 'lucide-react'
import { useCart } from '../store/cart'
import { useFavorites } from '../store/favorites'
import LogoMark from './LogoMark'

const navLinks = [
  { label: 'Pens', to: '/pens' },
  { label: 'Stickers', to: '/stickers' },
  { label: 'Freshies', to: '/freshies' },
  { label: 'Custom', to: '/custom' },
] as const

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-bold transition ${
    isActive
      ? 'bg-ink-3 text-cream'
      : 'text-mute hover:bg-ink-3 hover:text-cream'
  }`

export default function Header() {
  const { openCart, totalCount } = useCart()
  const count = totalCount()
  const favCount = useFavorites((s) => s.ids.length)
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [badgePulse, setBadgePulse] = useState(false)
  const prevCount = useRef(count)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (count > prevCount.current) {
      setBadgePulse(true)
      const t = window.setTimeout(() => setBadgePulse(false), 650)
      prevCount.current = count
      return () => window.clearTimeout(t)
    }
    prevCount.current = count
  }, [count])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-ink/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-[4.5rem] sm:px-6">
        <Link to="/" className="min-w-0 shrink-0" onClick={() => setMenuOpen(false)}>
          <LogoMark size="md" className="max-w-[11rem] sm:max-w-[14rem]" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {navLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
          <Link
            to="/checkout"
            className="rounded-full px-3 py-1.5 text-sm font-bold text-mute transition hover:bg-ink-3 hover:text-cream"
          >
            Checkout
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/favorites"
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-ink-2 text-cream transition hover:border-pink/50 hover:text-pink active:bg-ink-3"
            aria-label={favCount ? `Favorites, ${favCount} saved` : 'Favorites'}
            title="Favorites"
            onClick={() => setMenuOpen(false)}
          >
            <Heart className={`h-4 w-4 ${favCount ? 'text-pink' : ''}`} fill={favCount ? 'currentColor' : 'none'} />
            {favCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink px-1 text-[11px] font-extrabold text-white">
                {favCount}
              </span>
            )}
          </Link>
          <Link
            to="/search"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-ink-2 text-cream transition hover:border-cyan/50 hover:text-cyan active:bg-ink-3"
            aria-label="Search products"
            title="Search"
            onClick={() => setMenuOpen(false)}
          >
            <Search className="h-4 w-4" />
          </Link>
          <Link
            to="/pens"
            className="btn-outline-light !hidden !py-1.5 !px-3 text-xs sm:!inline-flex sm:text-sm"
          >
            Shop Now
          </Link>
          <button
            type="button"
            onClick={openCart}
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-line bg-ink-2 px-3 py-2 text-sm font-bold transition hover:border-cyan/50 active:bg-ink-3"
            aria-label="Open cart"
          >
            <ShoppingBag className="h-4 w-4 text-cyan" />
            <span className="hidden sm:inline">Cart</span>
            {count > 0 && (
              <span
                className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink px-1 text-[11px] font-extrabold text-white ${
                  badgePulse ? 'cart-badge-pulse' : ''
                }`}
              >
                {count}
              </span>
            )}
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-ink-2 text-cream transition hover:border-cyan/50 active:bg-ink-3 md:hidden"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        className={`md:hidden overflow-hidden border-t border-line bg-ink-2 transition-[max-height,opacity] duration-300 ease-out ${
          menuOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0 border-t-0'
        }`}
      >
        <nav
          className="flex flex-col gap-1 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          aria-label="Mobile"
        >
          <Link
            to="/search"
            onClick={() => setMenuOpen(false)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-3 text-left text-base font-bold text-cyan transition active:bg-ink-3"
          >
            <Search className="h-4 w-4" /> Search
          </Link>
          <Link
            to="/favorites"
            onClick={() => setMenuOpen(false)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-3 text-left text-base font-bold text-pink transition active:bg-ink-3"
          >
            <Heart className="h-4 w-4" fill={favCount ? 'currentColor' : 'none'} /> Favorites
            {favCount > 0 ? ` (${favCount})` : ''}
          </Link>
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className="min-h-11 rounded-xl px-4 py-3 text-left text-base font-bold text-cream transition active:bg-ink-3"
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/pens"
            onClick={() => setMenuOpen(false)}
            className="min-h-11 rounded-xl px-4 py-3 text-left text-base font-bold text-cyan transition active:bg-ink-3 sm:hidden"
          >
            Shop Now
          </Link>
          <Link
            to="/checkout"
            onClick={() => setMenuOpen(false)}
            className="min-h-11 rounded-xl px-4 py-3 text-left text-base font-bold text-cream transition active:bg-ink-3"
          >
            Checkout
          </Link>
        </nav>
      </div>

      <div className="flex h-1 w-full">
        <span className="flex-1 bg-cyan" />
        <span className="flex-1 bg-lime" />
        <span className="flex-1 bg-pink" />
        <span className="flex-1 bg-lavender" />
      </div>
    </header>
  )
}
