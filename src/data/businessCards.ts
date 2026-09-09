/** Fixed-pack custom business card pricing (double-sided) */

export type BusinessCardPackQty = 50 | 100

export interface BusinessCardPack {
  qty: BusinessCardPackQty
  price: number
  label: string
}

export const BUSINESS_CARD_PACKS: BusinessCardPack[] = [
  { qty: 50, price: 30, label: '50 cards' },
  { qty: 100, price: 50, label: '100 cards' },
]

export const BUSINESS_CARDS_PRODUCT_ID = 'LRSW33ZAB5KH6F6P2F4R5X7G'

export const BUSINESS_CARDS_IMAGE =
  'https://153150097.cdn6.editmysite.com/uploads/1/5/3/1/153150097/EFHXHJXEKEIPU7MLTZZ4KGDJ.png'

export function getBusinessCardPack(qty: BusinessCardPackQty): BusinessCardPack {
  return BUSINESS_CARD_PACKS.find((p) => p.qty === qty) ?? BUSINESS_CARD_PACKS[0]
}

export function businessCardPackPrice(qty: BusinessCardPackQty): number {
  return getBusinessCardPack(qty).price
}

export function formatBusinessCardsCartMeta(packQty: number | undefined): string {
  const qty = packQty === 100 ? 100 : 50
  return `Business cards · ${qty} · double-sided`
}
