/** Flat shipping: $8, free at $35+ merchandise subtotal. */

export const FLAT_SHIPPING_CENTS = 800
/** Dollar threshold (matches historical cart export). */
export const FREE_SHIPPING_THRESHOLD = 35
export const FREE_SHIPPING_THRESHOLD_CENTS = FREE_SHIPPING_THRESHOLD * 100

/** Shipping fee in cents for a merchandise subtotal in cents. */
export function shippingCentsForSubtotal(subtotalCents: number): number {
  const cents = Math.max(0, Math.round(Number(subtotalCents) || 0))
  return cents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS
}

/** Shipping fee in dollars for a merchandise subtotal in dollars. */
export function shippingDollarsForSubtotal(subtotalDollars: number): number {
  return shippingCentsForSubtotal(Math.round(Number(subtotalDollars) * 100)) / 100
}

export function isFreeShipping(subtotalDollars: number): boolean {
  return Number(subtotalDollars) >= FREE_SHIPPING_THRESHOLD
}
