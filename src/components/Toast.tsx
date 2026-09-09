import { useEffect } from 'react'
import { Check } from 'lucide-react'
import { useCart } from '../store/cart'

export default function Toast() {
  const toast = useCart((s) => s.toast)
  const clearToast = useCart((s) => s.clearToast)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(clearToast, 1800)
    return () => window.clearTimeout(t)
  }, [toast, clearToast])

  if (!toast) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-[60] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-lime/40 bg-ink-2/95 px-4 py-2.5 text-sm font-bold text-cream shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-lime text-ink">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        {toast}
      </div>
    </div>
  )
}
