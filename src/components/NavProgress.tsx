import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** Subtle top progress bar on route pathname changes. */
export default function NavProgress() {
  const { pathname } = useLocation()
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle')

  useEffect(() => {
    setPhase('run')
    const mid = window.setTimeout(() => setPhase('done'), 320)
    const end = window.setTimeout(() => setPhase('idle'), 520)
    return () => {
      window.clearTimeout(mid)
      window.clearTimeout(end)
    }
  }, [pathname])

  if (phase === 'idle') return null

  const width = phase === 'run' ? '70%' : '100%'
  const opacity = phase === 'done' ? 0 : 1

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden"
      aria-hidden
    >
      <div
        className="h-full bg-gradient-to-r from-cyan via-lime to-pink"
        style={{
          width,
          opacity,
          transition:
            phase === 'run'
              ? 'width 0.32s ease-out'
              : 'width 0.18s ease-in, opacity 0.2s ease-in',
        }}
      />
    </div>
  )
}
