import type { CustomLogoMeta } from '../data/products'
import { adminAuthHeaders, readAdminToken } from './adminAuth'

export type UploadedArtwork = {
  id: string
  fileName: string
  /** Admin-protected download path */
  url: string
  adminUrl?: string
  size: number
  mime: string
}

const ACCEPT_RE = /image\/(png|jpeg|webp|gif)/
const EXT_RE = /\.(png|jpe?g|webp|gif)$/i
export const CUSTOM_ARTWORK_MAX_BYTES = 12 * 1024 * 1024

export function validateCustomArtworkFile(file: File): string | null {
  const okType = ACCEPT_RE.test(file.type) || EXT_RE.test(file.name)
  if (!okType) return 'Please upload PNG, JPG, WebP, or GIF (no SVG).'
  if (file.size > CUSTOM_ARTWORK_MAX_BYTES) {
    return 'Keep it under 12MB.'
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
        ? 'File is too large (max 12MB).'
        : code === 'invalid_type'
          ? 'Please upload PNG, JPG, WebP, or GIF (no SVG).'
          : code === 'rate_limited'
            ? 'Too many uploads — wait a few minutes and try again.'
            : 'Upload failed — you can email the file later.',
    )
  }
  return {
    id: String(data.id),
    fileName: String(data.fileName || file.name),
    url: String(data.url),
    adminUrl: data.adminUrl ? String(data.adminUrl) : String(data.url),
    size: Number(data.size) || file.size,
    mime: String(data.mime || file.type || 'application/octet-stream'),
  }
}

function isAdminArtworkPath(url?: string): boolean {
  return Boolean(url && url.startsWith('/api/admin/uploads/custom/'))
}

/** Strip huge data URLs when a durable artworkUrl exists (cart / orders / localStorage). */
export function sanitizeCustomMeta(
  custom: CustomLogoMeta | undefined,
): CustomLogoMeta | undefined {
  if (!custom) return undefined
  const next: CustomLogoMeta = { ...custom }
  // Keep a small client preview when artwork is admin-only (no public URL).
  if (next.artworkUrl && isAdminArtworkPath(next.artworkUrl)) {
    if (next.logoDataUrl && next.logoDataUrl.length > 120_000) {
      delete next.logoDataUrl
    }
  } else if (next.artworkUrl) {
    delete next.logoDataUrl
  } else if (next.logoDataUrl && next.logoDataUrl.length > 80_000) {
    delete next.logoDataUrl
  }
  return next
}

/** Browser preview: prefer local data URL; admin artwork paths are not world-readable. */
export function customPreviewSrc(custom?: CustomLogoMeta): string | undefined {
  if (!custom) return undefined
  if (custom.logoDataUrl) return custom.logoDataUrl
  if (custom.artworkUrl && !isAdminArtworkPath(custom.artworkUrl)) {
    return custom.artworkUrl
  }
  return undefined
}

/** Admin Store Manager: fetch print file with Bearer token and trigger download. */
export async function downloadAdminArtwork(
  artworkUrl: string,
  fileName = 'artwork',
): Promise<void> {
  if (!readAdminToken()) {
    throw new Error('Login to Store Manager to download print files.')
  }
  const url = artworkUrl.includes('?')
    ? `${artworkUrl}&download=1&filename=${encodeURIComponent(fileName)}`
    : `${artworkUrl}?download=1&filename=${encodeURIComponent(fileName)}`
  const res = await fetch(url, { headers: adminAuthHeaders() })
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Session expired — unlock Store Manager again.' : 'Download failed.')
  }
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

/** Admin preview object URL (caller should revoke). */
export async function fetchAdminArtworkObjectUrl(artworkUrl: string): Promise<string> {
  const res = await fetch(artworkUrl, { headers: adminAuthHeaders() })
  if (!res.ok) throw new Error('preview_failed')
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
