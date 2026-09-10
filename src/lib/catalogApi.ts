import { adminAuthHeaders } from './adminAuth'
import type { Category, Product } from '../data/products'

export type CatalogSyncState = 'idle' | 'loading' | 'synced' | 'error'

export type CatalogArtPick =
  | 'pen'
  | 'sticker'
  | 'freshie'
  | 'resin'
  | 'badge'
  | 'pack'
  | 'skin'

export class CatalogApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'CatalogApiError'
    this.status = status
    this.code = code
  }
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchCatalog(): Promise<Product[]> {
  const res = await fetch('/api/catalog')
  const data = (await parseJson(res)) as {
    products?: Product[]
    error?: string
  } | null
  if (!res.ok) {
    throw new CatalogApiError(
      data?.error || `fetch_failed_${res.status}`,
      res.status,
      data?.error || 'fetch_failed',
    )
  }
  return Array.isArray(data?.products) ? data!.products! : []
}

export async function fetchProduct(id: string): Promise<Product> {
  const res = await fetch(`/api/catalog/products/${encodeURIComponent(id)}`)
  const data = (await parseJson(res)) as { product?: Product; error?: string } | null
  if (!res.ok || !data?.product) {
    throw new CatalogApiError(
      data?.error || `fetch_failed_${res.status}`,
      res.status,
      data?.error || 'fetch_failed',
    )
  }
  return data.product
}

export async function fetchProductPrice(
  id: string,
): Promise<{ id: string; price: number; name: string }> {
  const res = await fetch(`/api/catalog/product-price/${encodeURIComponent(id)}`)
  const data = (await parseJson(res)) as {
    id?: string
    price?: number
    name?: string
    error?: string
  } | null
  if (!res.ok || data?.id == null || data?.price == null) {
    throw new CatalogApiError(
      data?.error || `price_failed_${res.status}`,
      res.status,
      data?.error || 'price_failed',
    )
  }
  return { id: data.id, price: data.price, name: data.name ?? '' }
}

export interface CreateProductBody {
  id?: string
  name: string
  price: number
  category: Category
  tagline?: string
  description?: string
  imageUrl?: string
  art?: CatalogArtPick
  accent?: string
  badge?: string
}

export async function createProduct(body: CreateProductBody): Promise<Product> {
  const res = await fetch('/api/catalog/products', {
    method: 'POST',
    headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const data = (await parseJson(res)) as { product?: Product; error?: string } | null
  if (!res.ok || !data?.product) {
    throw new CatalogApiError(
      data?.error || `create_failed_${res.status}`,
      res.status,
      data?.error || 'create_failed',
    )
  }
  return data.product
}

export type PatchProductBody = Partial<Omit<Product, 'id' | 'inventoryQuantity'>> & {
  inventoryQuantity?: number | null
}

export async function patchProduct(
  id: string,
  body: PatchProductBody,
): Promise<Product> {
  const res = await fetch(`/api/catalog/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const data = (await parseJson(res)) as { product?: Product; error?: string } | null
  if (!res.ok || !data?.product) {
    throw new CatalogApiError(
      data?.error || `update_failed_${res.status}`,
      res.status,
      data?.error || 'update_failed',
    )
  }
  return data.product
}

export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`/api/catalog/products/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: adminAuthHeaders(),
  })
  if (res.status === 404) return
  if (!res.ok) {
    const data = (await parseJson(res)) as { error?: string } | null
    throw new CatalogApiError(
      data?.error || `delete_failed_${res.status}`,
      res.status,
      data?.error || 'delete_failed',
    )
  }
}

export async function resetCatalog(): Promise<Product[]> {
  const res = await fetch('/api/catalog/reset', {
    method: 'POST',
    headers: adminAuthHeaders(),
  })
  const data = (await parseJson(res)) as {
    products?: Product[]
    error?: string
  } | null
  if (!res.ok) {
    throw new CatalogApiError(
      data?.error || `reset_failed_${res.status}`,
      res.status,
      data?.error || 'reset_failed',
    )
  }
  return Array.isArray(data?.products) ? data!.products! : []
}

export async function uploadProductPhoto(file: Blob, fileName = 'product.webp'): Promise<{
  url: string
  id: string
  mime: string
  size: number
}> {
  const form = new FormData()
  form.append('file', file, fileName)
  const res = await fetch('/api/uploads/products', {
    method: 'POST',
    headers: adminAuthHeaders(),
    body: form,
  })
  const data = (await parseJson(res)) as {
    url?: string
    id?: string
    mime?: string
    size?: number
    error?: string
  } | null
  if (!res.ok || !data?.url || !data?.id) {
    throw new CatalogApiError(
      data?.error || `upload_failed_${res.status}`,
      res.status,
      data?.error || 'upload_failed',
    )
  }
  return {
    url: data.url,
    id: data.id,
    mime: data.mime || 'image/webp',
    size: data.size || 0,
  }
}
