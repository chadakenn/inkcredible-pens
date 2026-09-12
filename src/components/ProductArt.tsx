import { useState } from 'react'
import type { Product } from '../data/products'

function FallbackArt({
  product,
  className = '',
}: {
  product: Product
  className?: string
}) {
  const a = product.accent
  const beads = [a, '#22d3ee', '#c8f542', '#ff2d95', '#c084fc']

  const chkId = `chk-${product.id}`
  if (product.art === 'pen') {
    return (
      <svg viewBox="0 0 200 200" className={className} aria-hidden>
        <rect width="200" height="200" fill="#121212" />
        <rect x="0" y="0" width="200" height="200" className="opacity-20" fill={`url(#${chkId})`} />
        <rect x="86" y="48" width="28" height="110" rx="10" fill="#1a1a1a" stroke="#333" />
        {beads.map((c, i) => (
          <ellipse
            key={i}
            cx="100"
            cy={58 + i * 18}
            rx="16"
            ry="9"
            fill={c}
            opacity={0.95}
          />
        ))}
        <rect x="62" y="28" width="76" height="28" rx="6" fill="#0a0a0a" stroke={a} strokeWidth="2" />
        <text x="100" y="46" textAnchor="middle" fill={a} fontSize="7" fontFamily="Fredoka,sans-serif" fontWeight="700">
          INK
        </text>
        <polygon points="100,168 90,148 110,148" fill="#e5e5e5" />
        <defs>
          <pattern id={chkId} width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#fff" opacity="0.15" />
            <rect x="8" y="8" width="8" height="8" fill="#fff" opacity="0.15" />
          </pattern>
        </defs>
      </svg>
    )
  }

  if (product.art === 'sticker') {
    return (
      <svg viewBox="0 0 200 200" className={className} aria-hidden>
        <rect width="200" height="200" fill="#121212" />
        <ellipse cx="100" cy="100" rx="62" ry="50" fill={a} />
        <ellipse cx="100" cy="100" rx="52" ry="40" fill="#0a0a0a" />
        <text x="100" y="96" textAnchor="middle" fill="#fff" fontSize="12" fontFamily="Fredoka,sans-serif" fontWeight="700">
          SASS
        </text>
        <text x="100" y="114" textAnchor="middle" fill="#c8f542" fontSize="9" fontFamily="Fredoka,sans-serif" fontWeight="600">
          vinyl
        </text>
      </svg>
    )
  }

  if (product.art === 'freshie') {
    return (
      <svg viewBox="0 0 200 200" className={className} aria-hidden>
        <rect width="200" height="200" fill="#121212" />
        <path d="M100 46 C100 46 68 78 68 112 C68 136 82 154 100 154 C118 154 132 136 132 112 C132 78 100 46 100 46Z" fill={a} />
        <rect x="94" y="34" width="12" height="18" rx="3" fill="#22d3ee" />
        <circle cx="100" cy="30" r="7" fill="none" stroke="#c8f542" strokeWidth="3" />
        <circle cx="86" cy="110" r="5" fill="#0a0a0a" opacity="0.2" />
        <circle cx="114" cy="122" r="4" fill="#0a0a0a" opacity="0.2" />
      </svg>
    )
  }

  if (product.art === 'pack') {
    return (
      <svg viewBox="0 0 200 200" className={className} aria-hidden>
        <rect width="200" height="200" fill="#121212" />
        <rect x="55" y="50" width="70" height="95" rx="10" fill="#22d3ee" transform="rotate(-8 90 97)" />
        <rect x="75" y="45" width="70" height="95" rx="10" fill="#ff2d95" transform="rotate(7 110 92)" />
        <rect x="68" y="52" width="68" height="90" rx="10" fill="#1a1a1a" />
        <text x="102" y="100" textAnchor="middle" fill="#c8f542" fontSize="18" fontFamily="Fredoka,sans-serif" fontWeight="700">
          ???
        </text>
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden>
      <rect width="200" height="200" fill="#121212" />
      <circle cx="100" cy="100" r="54" fill={a} opacity="0.9" />
      <circle cx="100" cy="100" r="36" fill="#0a0a0a" />
      <text x="100" y="106" textAnchor="middle" fill="#fff" fontSize="14" fontFamily="Fredoka,sans-serif" fontWeight="700">
        ink
      </text>
    </svg>
  )
}

/** Prefer live product photos; fall back to colorful SVG stand-ins */
export default function ProductArt({
  product,
  className = '',
}: {
  product: Product
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  if (!product.imageUrl || failed) {
    return <FallbackArt product={product} className={className} />
  }

  return (
    <div className={`relative overflow-hidden bg-ink-3 ${className}`}>
      {!loaded && (
        <div
          className="absolute inset-0 flex animate-pulse items-center justify-center bg-gradient-to-br from-ink-3 via-ink-2 to-ink"
          aria-hidden
        >
          <span className="rounded-full border border-line bg-ink/70 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-mute">Loading artwork…</span>
        </div>
      )}
      <img
        src={product.imageUrl}
        alt={product.name}
        className={`h-full w-full object-center transition-opacity duration-300 ${
          product.category === 'Canvas' ? 'object-contain' : 'object-cover'
        } ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
