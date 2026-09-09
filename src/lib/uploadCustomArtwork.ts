import type { CustomLogoMeta } from '../data/products'

export type UploadedArtwork = {
  id: string
  fileName: string
  url: string
  size: number
  mime: string
}

const ACCEPT_RE = /image\/(png|jpeg|webp|svg\+xml)/
const EXT_RE = /\.(png|jpe?g|webp|svg)$/i
export const CUSTOM_ARTWORK_MAX_BYTES = 15 * 1024 * 1024

export function validateCustomArtworkFile(file: File): string | null {
  const okType = ACCEPT_RE.test(file.type) || EXT_RE.test(file.name)
  if (!okType) return 'Please upload PNG, JPG, WebP, or SVG.'
  if (file.size > CUSTOM_ARTWORK_MAX_BYTES) {
    return 'Keep it under 15MB.'
  }
  return null
}

export async function uploadCustomArtwork(file: File): Promise<UploadedArtwork> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/uploads/custom', {
    method: 'POST',
    body: form,
  })
  const data = (await res.json().catch(() => ({}))) as Partial<UploadedArtwork> & {
    error?: string
  }
  if (!res.ok || !data.url || !data.id) {
    const code = data.error || `Upload failed (${res.status})`
    throw new Error(
      code === 'file_too_large'
        ? 'File is too large (max 15MB).'
        : code === 'invalid_type'
          ? 'Please upload PNG, JPG, WebP, or SVG.'
          : 'Upload failed — you can email the file later.',
    )
  }
  return {
    id: String(data.id),
    fileName: String(data.fileName || file.name),
    url: String(data.url),
    size: Number(data.size) || file.size,
    mime: String(data.mime || file.type || 'application/octet-stream'),
  }
}

/** Strip huge data URLs when a durable artworkUrl exists (cart / orders / localStorage). */
export function sanitizeCustomMeta(
  custom: CustomLogoMeta | undefined,
): CustomLogoMeta | undefined {
  if (!custom) return undefined
  const next: CustomLogoMeta = { ...custom }
  if (next.artworkUrl) {
    delete next.logoDataUrl
  } else if (next.logoDataUrl && next.logoDataUrl.length > 80_000) {
    delete next.logoDataUrl
  }
  return next
}

export function customPreviewSrc(custom?: CustomLogoMeta): string | undefined {
  if (!custom) return undefined
  return custom.artworkUrl || custom.logoDataUrl
}
