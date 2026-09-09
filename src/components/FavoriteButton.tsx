import { Heart } from 'lucide-react'
import { useFavorites } from '../store/favorites'

type Size = 'sm' | 'md'

export default function FavoriteButton({
  productId,
  className = '',
  size = 'sm',
}: {
  productId: string
  className?: string
  size?: Size
}) {
  const has = useFavorites((s) => s.ids.includes(productId))
  const toggle = useFavorites((s) => s.toggle)

  const dim =
    size === 'md'
      ? 'h-11 w-11'
      : 'h-9 w-9'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(productId)
      }}
      className={`inline-flex ${dim} items-center justify-center rounded-full border transition active:scale-95 ${
        has
          ? 'border-pink/60 bg-pink/20 text-pink shadow-[0_0_16px_rgba(255,45,149,0.25)]'
          : 'border-line bg-ink/80 text-mute backdrop-blur-sm hover:border-pink/40 hover:text-pink'
      } ${className}`}
      aria-label={has ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={has}
      title={has ? 'Saved' : 'Save'}
    >
      <Heart
        className={size === 'md' ? 'h-5 w-5' : 'h-4 w-4'}
        fill={has ? 'currentColor' : 'none'}
        strokeWidth={has ? 0 : 2}
      />
    </button>
  )
}
