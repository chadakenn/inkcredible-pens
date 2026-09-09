/** Live Inkcredible store pack pricing for custom logo stickers */

export const CUSTOM_LOGO_STICKERS_PRODUCT_ID = 'PXPO7L3DW6SDE2LKVPDQ47V2'

export const CUSTOM_LOGO_STICKERS_IMAGE =
  'https://153150097.cdn6.editmysite.com/uploads/1/5/3/1/153150097/7D4PIKWE2QKTPA7525GMV4ZN.png'

export type LogoStickerStyleId = 'vinyl' | 'holo' | 'glow'

export type LogoStickerCut = 'circle' | 'rounded' | 'diecut'

export type LogoStickerSizeId = '2' | '3' | '4' | '5'

export interface LogoStickerCutOption {
  id: LogoStickerCut
  label: string
  helper: string
}

export const LOGO_STICKER_CUTS: LogoStickerCutOption[] = [
  { id: 'circle', label: 'Circle', helper: 'Classic round sticker' },
  { id: 'rounded', label: 'Rounded', helper: 'Soft square corners' },
  { id: 'diecut', label: 'Die-cut', helper: 'Follows your logo outline' },
]

export function getLogoCut(id: LogoStickerCut): LogoStickerCutOption {
  return LOGO_STICKER_CUTS.find((c) => c.id === id) ?? LOGO_STICKER_CUTS[0]
}

export interface LogoStickerSize {
  id: LogoStickerSizeId
  label: string
  inches: number
  /** Area scale vs 3″ baseline: (inches / 3)² */
  areaFactor: number
}

/** Baseline: $60 for 100 × 3″ vinyl. Other sizes scale by area. */
export const LOGO_STICKER_SIZES: LogoStickerSize[] = [
  { id: '2', label: '2"', inches: 2, areaFactor: 4 / 9 },
  { id: '3', label: '3"', inches: 3, areaFactor: 1 },
  { id: '4', label: '4"', inches: 4, areaFactor: 16 / 9 },
  { id: '5', label: '5"', inches: 5, areaFactor: 25 / 9 },
]

export function getLogoSize(id: LogoStickerSizeId | string | undefined): LogoStickerSize {
  return LOGO_STICKER_SIZES.find((s) => s.id === id) ?? LOGO_STICKER_SIZES[1]
}

export interface LogoStickerStyle {
  id: LogoStickerStyleId
  label: string
  shortLabel: string
  /** Default size label (unused for pricing — size picker drives price) */
  size: string
  packQty: number
  /** 3″ pack display price (baseline) */
  packPrice: number
  /** 3″ unit price (baseline for area scaling) */
  unitPrice: number
  blurb: string
  accent: string
}

export const LOGO_STICKER_STYLES: LogoStickerStyle[] = [
  {
    id: 'vinyl',
    label: 'Laminated Waterproof Vinyl',
    shortLabel: 'Vinyl',
    size: '3"',
    packQty: 100,
    packPrice: 60,
    unitPrice: 0.6,
    blurb: 'Tough everyday vinyl — classic pick.',
    accent: '#22d3ee',
  },
  {
    id: 'holo',
    label: 'Holographic',
    shortLabel: 'Holo',
    size: '3"',
    packQty: 25,
    packPrice: 25,
    unitPrice: 1.0,
    blurb: 'Shimmery catch-light drama.',
    accent: '#c084fc',
  },
  {
    id: 'glow',
    label: 'Glow-in-the-Dark',
    shortLabel: 'Glow',
    size: '3"',
    packQty: 25,
    packPrice: 27,
    unitPrice: 1.08,
    blurb: 'Lights out, logo on.',
    accent: '#c8f542',
  },
]

export function getLogoStyle(id: LogoStickerStyleId): LogoStickerStyle {
  return LOGO_STICKER_STYLES.find((s) => s.id === id) ?? LOGO_STICKER_STYLES[0]
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/** Unit price for a style at a given size (3″ baseline × area factor). */
export function unitPriceForSize(
  style: LogoStickerStyle,
  sizeId: LogoStickerSizeId | string | undefined,
): number {
  const size = getLogoSize(sizeId)
  return roundMoney(style.unitPrice * size.areaFactor)
}

/** Pack display price = unit × style.packQty (holo/glow stay 25-pack). */
export function packPriceForSize(
  style: LogoStickerStyle,
  sizeId: LogoStickerSizeId | string | undefined,
): number {
  return roundMoney(unitPriceForSize(style, sizeId) * style.packQty)
}

/** Cart/checkout line meta, e.g. Vinyl · Die-cut · 3" · 100 */
export function formatLogoCartMeta(
  styleId: LogoStickerStyleId | undefined,
  cutId: LogoStickerCut | undefined,
  stickerQty: number | undefined,
  sizeId?: LogoStickerSizeId | string | undefined,
): string {
  const style = styleId ? getLogoStyle(styleId).shortLabel : 'Custom'
  const cut = getLogoCut(cutId ?? 'circle').label
  const size = getLogoSize(sizeId ?? '3').label
  const qty = stickerQty ?? 0
  return `${style} · ${cut} · ${size} · ${qty}`
}

export function computeLogoStickerTotal(unitPrice: number, qty: number): number {
  return Math.round(unitPrice * qty * 100) / 100
}

export function formatLogoStickerLine(
  total: number,
  qty: number,
  style: LogoStickerStyle,
): string {
  return `$${total.toFixed(2)} · ${qty} stickers · ${style.shortLabel}`
}

/** Skip persisting huge data URLs in localStorage cart */
export const LOGO_DATA_URL_MAX_CHARS = 180_000
