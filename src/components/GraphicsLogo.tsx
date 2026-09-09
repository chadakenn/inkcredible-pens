/** Inkcredible Graphics wordmark — banners & canvas only (transparent PNG). */
export default function GraphicsLogo({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const img =
    size === 'sm'
      ? 'h-14 w-auto'
      : size === 'md'
        ? 'h-16 w-auto sm:h-20'
        : size === 'lg'
          ? 'h-28 w-auto sm:h-32'
          : 'h-36 w-auto sm:h-44'

  return (
    <img
      src="/incredible-graphics-logo.png?v=3"
      alt="Inkcredible Graphics"
      className={`${img} max-w-[min(100%,22rem)] object-contain ${className}`.trim()}
      draggable={false}
    />
  )
}
