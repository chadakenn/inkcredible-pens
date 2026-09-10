import { create } from 'zustand'
import type { FilterCategory } from '../data/products'
import { BUSINESS_CARDS_PRODUCT_ID } from '../data/businessCards'
import { THANK_YOU_CARDS_PRODUCT_ID } from '../data/thankYouCards'
import { CUSTOM_BANNERS_PRODUCT_ID } from '../data/banners'
import { CUSTOM_LOGO_STICKERS_PRODUCT_ID } from '../data/logoStickers'

/** Lightweight filter store — kept for optional within-page search helpers */
interface ShopState {
  filter: FilterCategory
  setFilter: (f: FilterCategory) => void
}

export const useShop = create<ShopState>((set) => ({
  filter: 'All',
  setFilter: (f) => set({ filter: f }),
}))

export function pathForCategory(label: string): string {
  const key = label.trim().toLowerCase()
  if (key === 'pens') return '/pens'
  if (key === 'stickers') return '/stickers'
  if (key === 'freshies' || key === 'car freshies') return '/freshies'
  if (key === 'canvas' || key === 'canvases') return '/canvas'
  if (
    key === 'custom logo stickers' ||
    key === 'logo stickers' ||
    key === 'for custom logo stickers' ||
    key === 'logo-stickers'
  ) {
    return '/custom/logo-stickers'
  }
  if (key === 'custom banners' || key === 'banners') return '/custom/banners'
  if (key === 'custom canvas') return '/custom/canvas'
  if (
    key === 'custom business cards' ||
    key === 'business cards' ||
    key === 'business-cards'
  ) {
    return '/custom/business-cards'
  }
  if (
    key === 'custom thank you cards' ||
    key === 'thank you cards' ||
    key === 'thank-you-cards'
  ) {
    return '/custom/thank-you-cards'
  }
  if (key === 'custom' || key === 'custom orders') return '/custom'
  if (key === 'shop now' || key === 'all' || key === 'shop the catalog') return '/shop'
  return '/shop'
}

/** Map catalog products that have dedicated configurators */
export function pathForCustomProduct(id: string | undefined | null): string | null {
  if (!id) return null
  if (id === BUSINESS_CARDS_PRODUCT_ID) return '/custom/business-cards'
  if (id === THANK_YOU_CARDS_PRODUCT_ID) return '/custom/thank-you-cards'
  if (id === CUSTOM_BANNERS_PRODUCT_ID) return '/custom/banners'
  if (id === CUSTOM_LOGO_STICKERS_PRODUCT_ID) return '/custom/logo-stickers'
  return null
}
