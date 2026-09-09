/** Banner size presets + estimate pricing (add estimate to cart; final art by email) */

export const CUSTOM_BANNERS_PRODUCT_ID = 'MLJTHKL7NSRUCPUAIBOFAFV3'

export const CUSTOM_BANNERS_IMAGE =
  'https://153150097.cdn6.editmysite.com/uploads/1/5/3/1/153150097/REBUKBWB3OKCQGYAVP5JSJCM.png'

export type BannerSizeId = '2x4' | '2x6' | '3x6' | '4x8' | 'custom'

export interface BannerSizePreset {
  id: BannerSizeId
  label: string
  widthFt: number
  heightFt: number
  /** Flat estimate for preset sizes; custom uses sq-ft formula */
  flatEstimate?: number
}

export const BANNER_SIZE_PRESETS: BannerSizePreset[] = [
  { id: '2x4', label: '2×4 ft', widthFt: 2, heightFt: 4, flatEstimate: 80 },
  { id: '2x6', label: '2×6 ft', widthFt: 2, heightFt: 6, flatEstimate: 110 },
  { id: '3x6', label: '3×6 ft', widthFt: 3, heightFt: 6, flatEstimate: 150 },
  { id: '4x8', label: '4×8 ft', widthFt: 4, heightFt: 8, flatEstimate: 220 },
  { id: 'custom', label: 'Custom', widthFt: 2, heightFt: 4 },
]

/** Rough mid-range for custom W×H: ~$10/sq ft (range $8–12 labeled in UI) */
export const BANNER_SQFT_MID = 10
export const BANNER_SQFT_LOW = 8
export const BANNER_SQFT_HIGH = 12

/** Double-sided estimate multiplier */
export const BANNER_DOUBLE_MULT = 1.75

export const BANNER_DATA_URL_MAX_CHARS = 180_000

export function getBannerPreset(id: BannerSizeId): BannerSizePreset {
  return BANNER_SIZE_PRESETS.find((p) => p.id === id) ?? BANNER_SIZE_PRESETS[0]
}

export function bannerSqFt(widthFt: number, heightFt: number): number {
  const w = Math.max(0.5, widthFt)
  const h = Math.max(0.5, heightFt)
  return Math.round(w * h * 100) / 100
}

export function estimateBannerPrice(
  sizeId: BannerSizeId,
  widthFt: number,
  heightFt: number,
  sides: 'single' | 'double',
): number {
  const preset = getBannerPreset(sizeId)
  let base: number
  if (sizeId !== 'custom' && preset.flatEstimate != null) {
    base = preset.flatEstimate
  } else {
    base = Math.round(bannerSqFt(widthFt, heightFt) * BANNER_SQFT_MID)
  }
  const total = sides === 'double' ? base * BANNER_DOUBLE_MULT : base
  return Math.round(total * 100) / 100
}

export function formatBannerCartMeta(
  sizeLabel: string | undefined,
  sides: 'single' | 'double' | undefined,
): string {
  const size = sizeLabel ?? 'Banner'
  const side = sides === 'double' ? 'Double-sided' : 'Single-sided'
  return `${size} · ${side} · Estimate`
}
