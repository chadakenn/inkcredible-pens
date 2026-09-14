/** Standard shipping is $8 (free at $60); carts with canvas ship for $15. */

export const FLAT_SHIPPING_CENTS = 800
export const CANVAS_SHIPPING_CENTS = 1500
/** Dollar threshold (matches historical cart export). */
export const FREE_SHIPPING_THRESHOLD = 60
export const FREE_SHIPPING_THRESHOLD_CENTS = FREE_SHIPPING_THRESHOLD * 100

/** Shipping fee in cents for a merchandise subtotal in cents. */
export function shippingCentsForSubtotal(subtotalCents: number, hasCanvas = false): number {
  if (hasCanvas) return CANVAS_SHIPPING_CENTS
  const cents = Math.max(0, Math.round(Number(subtotalCents) || 0))
  return cents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS
}

/** Shipping fee in dollars for a merchandise subtotal in dollars. */
export function shippingDollarsForSubtotal(subtotalDollars: number, hasCanvas = false): number {
  return shippingCentsForSubtotal(Math.round(Number(subtotalDollars) * 100), hasCanvas) / 100
}

export function isFreeShipping(subtotalDollars: number): boolean {
  return Number(subtotalDollars) >= FREE_SHIPPING_THRESHOLD
}
