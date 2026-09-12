import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export default function AnalyticsTracker() {
  const location = useLocation()

  useEffect(() => {
    // Keep private manager and proof-approval screens out of store traffic reports.
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/proof/')) return
    if (import.meta.env.DEV) return

    // Never include checkout session IDs, search text, or other query values.
    window.gtag?.('event', 'page_view', {
      page_title: document.title,
      page_location: `${window.location.origin}${location.pathname}`,
      page_path: location.pathname,
    })
  }, [location.pathname, location.search])

  return null
}
