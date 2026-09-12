import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'inkcredible-announce-dismissed'

export default function AnnouncementBar() {
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('Handmade to order')

  useEffect(() => {
    let active = true
    void fetch('/api/store-settings').then((response) => response.json()).then((data) => {
      if (!active || data?.settings?.announcement?.enabled === false) return
      setMessage(String(data?.settings?.announcement?.message || 'Handmade to order'))
      try { if (sessionStorage.getItem(STORAGE_KEY) === '1') return } catch { /* ignore */ }
      setVisible(true)
    }).catch(() => setVisible(true))
    return () => { active = false }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative z-50 border-b border-line/60 bg-ink-2/95 text-center text-[11px] font-bold leading-snug text-cream sm:text-xs">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-10 py-2 sm:px-12">
        <p className="min-w-0">
          <span className="text-lime">{message}</span>
          <span className="mx-1.5 text-mute">·</span>
          Questions?{' '}
          <a
            href="mailto:inkcredible.pens@gmail.com"
            className="text-cyan underline decoration-cyan/40 underline-offset-2 transition hover:text-aqua"
          >
            inkcredible.pens@gmail.com
          </a>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-mute transition hover:bg-ink-3 hover:text-cream sm:right-3"
          aria-label="Dismiss announcement"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
