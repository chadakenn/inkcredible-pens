/** Main Inkcredible store logo (graffiti wordmark + CREATE · INSPIRE · STAND OUT). */
export default function LogoMark({
  size = 'md',
  showWord = false,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Optional text beside the image. Default false — logo already includes the wordmark. */
  showWord?: boolean
  className?: string
}) {
  // Wide landscape mark — size by height
  const img =
    size === 'sm'
      ? 'h-10 w-auto sm:h-11'
      : size === 'md'
        ? 'h-12 w-auto sm:h-14'
        : size === 'lg'
          ? 'h-20 w-auto sm:h-24'
          : 'h-28 w-auto sm:h-36 md:h-40'

  const text =
    size === 'sm'
      ? 'text-base'
      : size === 'md'
        ? 'text-lg sm:text-xl'
        : size === 'lg'
          ? 'text-2xl sm:text-3xl'
          : 'text-3xl sm:text-4xl'

  return (
    <span className={`inline-flex items-center gap-2.5 min-w-0 ${className}`.trim()}>
      <img
        src="/inkcredible-pens-logo.jpg?v=4"
        alt="Inkcredible"
        className={`${img} max-w-[min(100%,18rem)] object-contain rounded-md sm:max-w-[min(100%,22rem)]`}
        draggable={false}
      />
      {showWord && (
        <span className={`font-display ${text} leading-none tracking-tight truncate`}>
          <span className="text-cream">Pens</span>
        </span>
      )}
    </span>
  )
}
