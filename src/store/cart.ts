import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '../data/products'
import { isUniqueCustomLine } from '../lib/customCartMeta'

export interface CartItem {
  product: Product
  qty: number
}

export interface AddItemOptions {
  freshieScent?: string
  freshieNote?: string
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  toast: string | null
  openCart: () => void
  closeCart: () => void
  toggleCart: () => void
  addItem: (product: Product, qty?: number, options?: AddItemOptions) => void
  removeItem: (id: string) => void
  setQty: (id: string, qty: number) => void
  clear: () => void
  clearToast: () => void
  showToast: (message: string) => void
  totalCount: () => number
  subtotal: () => number
}

function isLogoCustomLine(product: Product): boolean {
  return isUniqueCustomLine(product)
}

function scentSlug(scent: string): string {
  return (
    scent
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'scent'
  )
}

/** Attach freshie scent meta; unique id so cart qty/remove stay per-scent. */
function withFreshieMeta(
  product: Product,
  options?: AddItemOptions,
): Product {
  const scent = options?.freshieScent?.trim()
  const note = options?.freshieNote?.trim()
  if (!scent && !note) return product
  const baseId = product.id.includes('__scent__')
    ? product.id.split('__scent__')[0]
    : product.id
  return {
    ...product,
    id: scent ? `${baseId}__scent__${scentSlug(scent)}` : product.id,
    custom: {
      ...product.custom,
      ...(scent ? { freshieScent: scent } : {}),
      ...(note ? { freshieNote: note } : { freshieNote: undefined }),
    },
  }
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      toast: null,
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((s) => ({ isOpen: !s.isOpen })),
      clearToast: () => set({ toast: null }),
      showToast: (message) => set({ toast: message }),
      addItem: (product, qty = 1, options) =>
        set((s) => {
          const lineProduct = withFreshieMeta(product, options)
          // Custom logo lines always get their own cart row (unique ids expected)
          if (isLogoCustomLine(lineProduct)) {
            return {
              items: [...s.items, { product: lineProduct, qty }],
              isOpen: true,
              toast: 'Added to cart',
            }
          }
          const existing = s.items.find((i) => i.product.id === lineProduct.id)
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.product.id === lineProduct.id
                  ? { ...i, qty: i.qty + qty }
                  : i,
              ),
              isOpen: true,
              toast: 'Added to cart',
            }
          }
          return {
            items: [...s.items, { product: lineProduct, qty }],
            isOpen: true,
            toast: 'Added to cart',
          }
        }),
      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.product.id !== id) })),
      setQty: (id, qty) =>
        set((s) => {
          if (qty <= 0) {
            return { items: s.items.filter((i) => i.product.id !== id) }
          }
          return {
            items: s.items.map((i) =>
              i.product.id === id ? { ...i, qty } : i,
            ),
          }
        }),
      clear: () => set({ items: [] }),
      totalCount: () => get().items.reduce((n, i) => n + i.qty, 0),
      subtotal: () =>
        get().items.reduce((n, i) => n + i.product.price * i.qty, 0),
    }),
    { name: 'inkcredible-cart', partialize: (s) => ({ items: s.items }) },
  ),
)

export { FREE_SHIPPING_THRESHOLD } from '../data/shipping'
