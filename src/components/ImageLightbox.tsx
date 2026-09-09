import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

export default function ImageLightbox({
  open,
  onClose,
  children,
  label = 'Product image',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  label?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/90 p-4 backdrop-blur-md animate-page-in"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-ink-2 text-cream transition hover:border-cyan/50 hover:text-cyan"
        aria-label="Close image"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="max-h-[90dvh] w-full max-w-3xl overflow-hidden rounded-3xl border border-line bg-ink-3 shadow-[0_0_60px_rgba(34,211,238,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}
