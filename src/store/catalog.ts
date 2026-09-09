import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type Category,
  type Product,
} from '../data/products'
import {
  CatalogApiError,
  createProduct as apiCreateProduct,
  deleteProduct as apiDeleteProduct,
  fetchCatalog,
  patchProduct as apiPatchProduct,
  resetCatalog as apiResetCatalog,
  type CatalogSyncState,
} from '../lib/catalogApi'

export type ArtPick = 'pen' | 'sticker' | 'freshie' | 'pack'

export interface NewProductInput {
  name: string
  price: number
  category: Category
  tagline?: string
  description?: string
  imageUrl?: string
  art: ArtPick
}

interface CatalogState {
  products: Product[]
  syncState: CatalogSyncState
  syncError: string | null
  hydrateFromApi: () => Promise<void>
  addProduct: (input: NewProductInput) => Promise<Product>
  removeProduct: (id: string) => Promise<void>
  updateProduct: (id: string, patch: Partial<Omit<Product, 'id'>>) => Promise<void>
  resetToDefaults: () => Promise<void>
}

const ACCENTS: Record<Category, string[]> = {
  Pens: ['#ff9f43', '#ff2d95', '#c084fc', '#c8f542', '#22d3ee', '#a855f7'],
  Stickers: ['#ff2d95', '#22d3ee', '#c084fc', '#c8f542'],
  'Car Freshies': ['#f5e6c8', '#ffd166', '#22d3ee'],
  Custom: ['#c8f542', '#ff2d95', '#22d3ee'],
}

function pickAccent(category: Category, index: number): string {
  const list = ACCENTS[category]
  return list[index % list.length]
}

function mutationErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof CatalogApiError) {
    if (err.status === 0 || err.message.includes('Failed to fetch')) {
      return 'Catalog server unavailable — try again when online.'
    }
    return err.message || fallback
  }
  if (err instanceof TypeError) {
    return 'Catalog server unavailable — try again when online.'
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export const useCatalog = create<CatalogState>()(
  persist(
    (set, get) => ({
      products: [],
      syncState: 'idle',
      syncError: null,

      hydrateFromApi: async () => {
        set({ syncState: 'loading', syncError: null })
        try {
          const remote = await fetchCatalog()
          set({
            products: remote,
            syncState: 'synced',
            syncError: null,
          })
        } catch (err) {
          const message = mutationErrorMessage(err, 'sync_failed')
          // Keep cached products; mark offline
          set({ syncState: 'error', syncError: message })
        }
      },

      addProduct: async (input) => {
        const payload = {
          name: input.name.trim(),
          price: input.price,
          category: input.category,
          tagline: (input.tagline ?? '').trim() || 'Handmade Inkcredible goodies.',
          description:
            (input.description ?? '').trim() ||
            'Fresh from the Inkcredible bench — made with humor and hustle.',
          accent: pickAccent(input.category, get().products.length),
          art: input.art,
          imageUrl: input.imageUrl?.trim() || undefined,
        }
        try {
          const product = await apiCreateProduct(payload)
          set((s) => ({
            products: [product, ...s.products.filter((p) => p.id !== product.id)],
            syncState: 'synced',
            syncError: null,
          }))
          return product
        } catch (err) {
          const message = mutationErrorMessage(
            err,
            'Could not add product on server.',
          )
          set({ syncState: 'error', syncError: message })
          throw new Error(message)
        }
      },

      removeProduct: async (id) => {
        try {
          await apiDeleteProduct(id)
          set((s) => ({
            products: s.products.filter((p) => p.id !== id),
            syncState: 'synced',
            syncError: null,
          }))
        } catch (err) {
          const message = mutationErrorMessage(
            err,
            'Could not delete product on server.',
          )
          set({ syncState: 'error', syncError: message })
          throw new Error(message)
        }
      },

      updateProduct: async (id, patch) => {
        try {
          const updated = await apiPatchProduct(id, patch)
          set((s) => ({
            products: s.products.map((p) => (p.id === id ? updated : p)),
            syncState: 'synced',
            syncError: null,
          }))
        } catch (err) {
          const message = mutationErrorMessage(
            err,
            'Could not update product on server.',
          )
          set({ syncState: 'error', syncError: message })
          throw new Error(message)
        }
      },

      resetToDefaults: async () => {
        try {
          const products = await apiResetCatalog()
          set({
            products,
            syncState: 'synced',
            syncError: null,
          })
        } catch (err) {
          const message = mutationErrorMessage(
            err,
            'Could not reset catalog on server.',
          )
          set({ syncState: 'error', syncError: message })
          throw new Error(message)
        }
      },
    }),
    {
      name: 'inkcredible-catalog-v4',
      version: 4,
      partialize: (state) => ({ products: state.products }),
    },
  ),
)
