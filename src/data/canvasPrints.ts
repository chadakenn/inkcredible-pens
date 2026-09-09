/** Estimate-only canvas pricing — final quote by email */

export type CanvasSizeId = '8x10' | '11x14' | '16x20' | '18x24'

export type CanvasFinish = 'stretched' | 'framed'

export interface CanvasSizePreset {
  id: CanvasSizeId
  label: string
  widthIn: number
  heightIn: number
  estimate: number
}

export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  { id: '8x10', label: '8×10 in', widthIn: 8, heightIn: 10, estimate: 35 },
  { id: '11x14', label: '11×14 in', widthIn: 11, heightIn: 14, estimate: 45 },
  { id: '16x20', label: '16×20 in', widthIn: 16, heightIn: 20, estimate: 65 },
  { id: '18x24', label: '18×24 in', widthIn: 18, heightIn: 24, estimate: 85 },
]

/** Framed finish adds a modest estimate bump */
export const CANVAS_FRAMED_ADD = 25

export const CANVAS_DATA_URL_MAX_CHARS = 180_000

export function getCanvasPreset(id: CanvasSizeId): CanvasSizePreset {
  return CANVAS_SIZE_PRESETS.find((p) => p.id === id) ?? CANVAS_SIZE_PRESETS[0]
}

export function estimateCanvasPrice(
  sizeId: CanvasSizeId,
  finish: CanvasFinish,
): number {
  const base = getCanvasPreset(sizeId).estimate
  const total = finish === 'framed' ? base + CANVAS_FRAMED_ADD : base
  return Math.round(total * 100) / 100
}

export function formatCanvasCartMeta(
  sizeLabel: string | undefined,
  finish: CanvasFinish | undefined,
): string {
  const size = sizeLabel ?? 'Canvas'
  const fin = finish === 'framed' ? 'Framed' : 'Stretched'
  return `${size} · ${fin} · Estimate`
}
