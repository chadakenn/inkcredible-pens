/** Fixed-pack custom thank you card pricing (double-sided, 5.5" × 4.25") */

export type ThankYouCardPackQty = 25 | 50

export interface ThankYouCardPack {
  qty: ThankYouCardPackQty
  price: number
  label: string
}

export const THANK_YOU_CARD_PACKS: ThankYouCardPack[] = [
  { qty: 25, price: 40, label: '25 cards' },
  { qty: 50, price: 50, label: '50 cards' },
]

export const THANK_YOU_CARDS_PRODUCT_ID = 'YHA4HC73NCLSAMJ7CKKCV4AQ'

export const THANK_YOU_CARDS_IMAGE =
  'https://153150097.cdn6.editmysite.com/uploads/1/5/3/1/153150097/HQXLILLLZJWK5BKGS3G5J6DQ.png'

export function getThankYouCardPack(qty: ThankYouCardPackQty): ThankYouCardPack {
  return THANK_YOU_CARD_PACKS.find((p) => p.qty === qty) ?? THANK_YOU_CARD_PACKS[0]
}

export function thankYouCardPackPrice(qty: ThankYouCardPackQty): number {
  return getThankYouCardPack(qty).price
}

export function formatThankYouCardsCartMeta(packQty: number | undefined): string {
  const qty = packQty === 50 ? 50 : 25
  return `Thank you cards · ${qty} · 5.5" × 4.25" · double-sided`
}
