import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, MessageSquare, Package, Palette } from 'lucide-react'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import FacebookIcon from '../components/FacebookIcon'
import { GRAPHICS_FACEBOOK_URL, PENS_FACEBOOK_URL } from '../lib/socialLinks'

const EMAIL = 'inkcredible.pens@gmail.com'

const customTips = [
  {
    icon: Palette,
    title: 'Custom logo stickers',
    body: 'Your logo file (PNG/SVG preferred), cut style, quantity, and any color notes.',
  },
  {
    icon: Package,
    title: 'Banners & canvas',
    body: 'Size, wording/artwork idea, deadline, and whether you’ll email art separately.',
  },
  {
    icon: MessageSquare,
    title: 'Freshies & one-offs',
    body: 'Shape preference, scent ideas, color vibes, and how many you need.',
  },
]

export default function Contact() {
  useDocumentTitle('Contact')

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-bold text-mute transition hover:text-cyan"
      >
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>

      <p className="mt-6 text-xs font-extrabold uppercase tracking-wider text-pink">
        Say hey
      </p>
      <h1 className="mt-1 font-display text-3xl text-cream sm:text-4xl">Contact</h1>
      <p className="mt-3 text-sm leading-relaxed text-mute sm:text-base">
        Custom orders, wholesale vibes, or “can you make this weirder?” — email works best.
        We read every note (usually with coffee and sarcasm).
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <a
          href={`mailto:${EMAIL}?subject=${encodeURIComponent('Inkcredible Pens — hello')}`}
          className="btn-primary inline-flex min-h-12 justify-center"
        >
          <Mail className="h-4 w-4" />
          {EMAIL}
        </a>
        <a
          href={PENS_FACEBOOK_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-cyan/50 bg-cyan/10 px-5 font-extrabold text-cyan transition hover:border-cyan hover:bg-cyan/15"
        >
          <FacebookIcon className="h-5 w-5" />
          Message Inkcredible Pens on Facebook
        </a>
        <a
          href={GRAPHICS_FACEBOOK_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-cyan/50 bg-cyan/10 px-5 font-extrabold text-cyan transition hover:border-cyan hover:bg-cyan/15"
        >
          <FacebookIcon className="h-5 w-5" />
          Message Inkcredible Graphics on Facebook
        </a>
      </div>

      <div className="mt-10 rounded-3xl border border-line bg-ink-2 p-5 sm:p-6">
        <h2 className="font-display text-xl text-cream">What to include for customs</h2>
        <p className="mt-1 text-sm text-mute">
          The more detail you send, the faster we can quote or build.
        </p>
        <ul className="mt-5 space-y-4">
          {customTips.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-ink text-cyan">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-bold text-cream">{title}</p>
                <p className="mt-0.5 text-sm text-mute">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-mute">
          Or jump into the{' '}
          <Link to="/custom" className="font-bold text-cyan hover:underline">
            custom studio
          </Link>{' '}
          to configure logo stickers, banners, canvas, and business cards online.
        </p>
      </div>
    </section>
  )
}
