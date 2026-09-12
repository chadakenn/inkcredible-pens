import type { Product } from '../data/products'

type AnalyticsProduct = { product: Product; qty: number }

function baseProductId(product: Product): string {
  return product.custom?.catalogId || product.id.split('__scent__')[0].split('__option__')[0]
}

function variant(product: Product): string | undefined {
  const custom = product.custom
  if (!custom) return undefined
  const values = [
    custom.freshieScent,
    custom.styleLabel,
    custom.stickerSize,
    custom.bannerSizeLabel,
    custom.canvasSizeLabel,
    custom.photoFreshieSize,
    ...Object.values(custom.selectedOptions || {}),
  ].filter(Boolean)
  return values.length ? values.join(' / ') : undefined
}

function analyticsItem({ product, qty }: AnalyticsProduct) {
  return {
    item_id: baseProductId(product),
    item_name: product.name,
    item_brand: 'Inkcredible',
    item_category: product.category,
    item_variant: variant(product),
    price: product.price,
    quantity: qty,
  }
}

function event(name: string, params: Record<string, unknown>) {
  if (import.meta.env.DEV) return
  window.gtag?.('event', name, params)
}

export function trackProductView(product: Product) {
  event('view_item', {
    currency: 'USD',
    value: product.price,
    items: [analyticsItem({ product, qty: 1 })],
  })
}

export function trackAddToCart(product: Product, qty: number) {
  event('add_to_cart', {
    currency: 'USD',
    value: product.price * qty,
    items: [analyticsItem({ product, qty })],
  })
}

export function trackBeginCheckout(items: AnalyticsProduct[], value: number) {
  event('begin_checkout', {
    currency: 'USD',
    value,
    items: items.map(analyticsItem),
  })
}

export function trackPurchase(
  transactionId: string,
  items: AnalyticsProduct[],
  value: number,
  shipping: number,
) {
  if (import.meta.env.DEV || !window.gtag) return
  const storageKey = `inkcredible-ga-purchase:${transactionId}`
  try {
    if (localStorage.getItem(storageKey)) return
  } catch {
    /* Analytics can still work when storage is unavailable. */
  }

  event('purchase', {
    transaction_id: transactionId,
    affiliation: 'Inkcredible Online Store',
    currency: 'USD',
    value,
    shipping,
    items: items.map(analyticsItem),
  })

  try {
    localStorage.setItem(storageKey, new Date().toISOString())
  } catch {
    /* Ignore storage restrictions. */
  }
}
