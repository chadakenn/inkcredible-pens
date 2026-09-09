import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ImagePlus, Link2, LoaderCircle, RefreshCw, Trash2, Upload } from 'lucide-react'
import { prepareProductImage } from '../../lib/productImage'

interface ProductPhotoFieldProps {
  value?: string
  onChange: (value: string) => void
  saveError?: string | null
}

export default function ProductPhotoField({
  value = '',
  onChange,
  saveError,
}: ProductPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [linkDraft, setLinkDraft] = useState(value.startsWith('http') ? value : '')

  useEffect(() => {
    if (value.startsWith('http')) setLinkDraft(value)
    if (!value) setLinkDraft('')
  }, [value])

  const useFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setPhotoError(null)
    try {
      const prepared = await prepareProductImage(file)
      onChange(prepared)
      setLinkDraft('')
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'That photo could not be used.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void useFile(event.dataTransfer.files[0])
  }

  const applyLink = () => {
    const link = linkDraft.trim()
    if (!link) {
      setPhotoError('Paste an image link first.')
      return
    }
    try {
      const parsed = new URL(link)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error()
    } catch {
      setPhotoError('That does not look like a valid image link.')
      return
    }
    setPhotoError(null)
    onChange(link)
  }

  return (
    <section aria-label="Product photo" className="rounded-3xl border-2 border-cyan/50 bg-ink p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan text-ink">
          <ImagePlus className="h-7 w-7" />
        </span>
        <div>
          <h3 className="font-display text-xl text-cream">Product photo</h3>
          <p className="text-sm text-mute">PNG, JPG, or WebP. We resize it for you.</p>
        </div>
      </div>

      <div
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
        className={`mt-4 overflow-hidden rounded-2xl border-2 border-dashed transition ${
          dragging ? 'border-lime bg-lime/10' : 'border-cyan/60 bg-ink-2'
        }`}
      >
        {value ? (
          <div className="p-3">
            <img
              src={value}
              alt="Product preview"
              onLoad={() => setPhotoError(null)}
              onError={() => setPhotoError('This photo cannot be previewed. Try another file or link.')}
              className="h-64 w-full rounded-xl bg-white object-contain sm:h-72"
            />
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-cyan px-4 text-lg font-extrabold text-ink disabled:opacity-60"
              >
                <RefreshCw className="h-5 w-5" />
                Replace photo
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setLinkDraft('')
                  setPhotoError(null)
                }}
                className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-pink px-4 text-lg font-extrabold text-white"
              >
                <Trash2 className="h-5 w-5" />
                Remove photo
              </button>
            </div>
            <p className="mt-3 text-center text-sm font-bold text-mute">Or drop a replacement photo here</p>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex min-h-52 w-full flex-col items-center justify-center gap-3 px-5 py-8 text-center disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle className="h-12 w-12 animate-spin text-lime" />
            ) : (
              <Upload className="h-12 w-12 text-cyan" />
            )}
            <span className="font-display text-2xl text-cream">
              {busy ? 'Getting photo ready…' : 'Choose a product photo'}
            </span>
            <span className="text-base font-bold text-mute">Tap here or drop a photo</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        onChange={(event) => void useFile(event.target.files?.[0])}
      />

      <div className="mt-5 border-t border-line pt-4">
        <label htmlFor={undefined} className="mb-2 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-mute">
          <Link2 className="h-4 w-4" />
          Or paste an image link <span className="font-normal normal-case">(optional)</span>
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            value={linkDraft}
            onChange={(event) => {
              setLinkDraft(event.target.value)
              setPhotoError(null)
            }}
            placeholder="https://example.com/photo.jpg"
            className="min-h-14 min-w-0 flex-1 rounded-2xl border border-line bg-ink-2 px-4 text-base text-cream outline-none placeholder:text-mute focus:border-cyan"
          />
          <button
            type="button"
            onClick={applyLink}
            className="min-h-14 rounded-2xl border-2 border-cyan bg-ink-2 px-5 text-lg font-extrabold text-cyan"
          >
            Use this link
          </button>
        </div>
      </div>

      {(photoError || saveError) && (
        <p role="alert" className="mt-3 rounded-xl border border-pink/50 bg-pink/10 px-4 py-3 text-base font-extrabold text-pink">
          {saveError || photoError}
        </p>
      )}
    </section>
  )
}
