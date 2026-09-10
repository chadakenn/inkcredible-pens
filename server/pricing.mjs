/**
 * Server-side pricing — mirrors client formulas in src/data/*.ts
 * Never trust client unit prices for Stripe line items.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CATALOG_FILE = path.resolve(__dirname, '../data/catalog/products.json')
const CATALOG_SEED = path.join(__dirname, 'catalog-seed.json')

export const FLAT_SHIPPING_CENTS = 800
export const FREE_SHIPPING_THRESHOLD_CENTS = 3500

export function shippingCentsForSubtotal(subtotalCents) {
  const cents = Math.max(0, Math.round(Number(subtotalCents) || 0))
  return cents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : FLAT_SHIPPING_CENTS
}

function roundMoney(n) {
  return Math.round(n * 100) / 100
}

function dollarsToCents(d) {
  return Math.round(Number(d) * 100)
}

// --- Logo stickers (src/data/logoStickers.ts) ---
const LOGO_STICKER_SIZES = {
  '2': { id: '2', label: '2"', areaFactor: 4 / 9 },
  '3': { id: '3', label: '3"', areaFactor: 1 },
  '4': { id: '4', label: '4"', areaFactor: 16 / 9 },
  '5': { id: '5', label: '5"', areaFactor: 25 / 9 },
}

const LOGO_STICKER_STYLES = {
  vinyl: { id: 'vinyl', shortLabel: 'Vinyl', packQty: 100, unitPrice: 0.6 },
  holo: { id: 'holo', shortLabel: 'Holo', packQty: 25, unitPrice: 1.0 },
  glow: { id: 'glow', shortLabel: 'Glow', packQty: 25, unitPrice: 1.08 },
}

const LOGO_CUTS = {
  circle: 'Circle',
  rounded: 'Rounded',
  diecut: 'Die-cut',
}

function getLogoSize(id) {
  return LOGO_STICKER_SIZES[String(id ?? '3')] ?? LOGO_STICKER_SIZES['3']
}

function getLogoStyle(id) {
  return LOGO_STICKER_STYLES[id] ?? LOGO_STICKER_STYLES.vinyl
}

function unitPriceForSize(style, sizeId) {
  return roundMoney(style.unitPrice * getLogoSize(sizeId).areaFactor)
}

function priceLogoStickers(config) {
  const style = getLogoStyle(config?.style)
  const sizeId = config?.stickerSizeId ?? config?.stickerSize ?? '3'
  // stickerSize may be label like '3"' — try to parse
  let sizeKey = sizeId
  if (typeof sizeKey === 'string' && sizeKey.includes('"')) {
    sizeKey = sizeKey.replace('"', '')
  }
  const unit = unitPriceForSize(style, sizeKey)
  const qty = Math.max(1, Math.round(Number(config?.stickerQty) || style.packQty))
  const total = roundMoney(unit * qty)
  const cutLabel = LOGO_CUTS[config?.cut] ?? LOGO_CUTS.circle
  const sizeLabel = getLogoSize(sizeKey).label
  return {
    unitDollars: total, // one cart line = full pack total (qty on cart is usually 1)
    lineName: `Custom Logo Stickers`,
    description: `${style.shortLabel} · ${cutLabel} · ${sizeLabel} · ${qty}`,
    custom: {
      type: 'logo',
      style: style.id,
      cut: config?.cut ?? 'circle',
      stickerQty: qty,
      stickerSizeId: String(getLogoSize(sizeKey).id),
      stickerSize: sizeLabel,
      estimateOnly: false,
      ...(config?.artworkUrl ? { artworkUrl: config.artworkUrl } : {}),
      ...(config?.artworkId ? { artworkId: config.artworkId } : {}),
      ...(config?.artworkFileName ? { artworkFileName: config.artworkFileName } : {}),
      ...(config?.fileName ? { fileName: config.fileName } : {}),
      ...(config?.logoComingByEmail ? { logoComingByEmail: true } : {}),
    },
  }
}

// --- Banners (src/data/banners.ts) ---
const BANNER_PRESETS = {
  '2x4': { label: '2×4 ft', widthFt: 2, heightFt: 4, flatEstimate: 80 },
  '2x6': { label: '2×6 ft', widthFt: 2, heightFt: 6, flatEstimate: 110 },
  '3x6': { label: '3×6 ft', widthFt: 3, heightFt: 6, flatEstimate: 150 },
  '4x8': { label: '4×8 ft', widthFt: 4, heightFt: 8, flatEstimate: 220 },
  custom: { label: 'Custom', widthFt: 2, heightFt: 4 },
}
const BANNER_SQFT_MID = 10
const BANNER_DOUBLE_MULT = 1.75

function priceBanner(config) {
  const sizeId = config?.bannerSizeId || '2x4'
  const preset = BANNER_PRESETS[sizeId] ?? BANNER_PRESETS['2x4']
  const widthFt = Number(config?.bannerWidthFt) || preset.widthFt
  const heightFt = Number(config?.bannerHeightFt) || preset.heightFt
  const sides = config?.bannerSides === 'double' ? 'double' : 'single'
  let base
  if (sizeId !== 'custom' && preset.flatEstimate != null) {
    base = preset.flatEstimate
  } else {
    const w = Math.max(0.5, widthFt)
    const h = Math.max(0.5, heightFt)
    const sqft = Math.round(w * h * 100) / 100
    base = Math.round(sqft * BANNER_SQFT_MID)
  }
  const total = roundMoney(sides === 'double' ? base * BANNER_DOUBLE_MULT : base)
  const sizeLabel = config?.bannerSizeLabel || preset.label
  return {
    unitDollars: total,
    lineName: 'Custom Banner',
    description: `${sizeLabel} · ${sides === 'double' ? 'Double-sided' : 'Single-sided'} · Estimate`,
    custom: {
      type: 'banner',
      bannerSizeId: sizeId,
      bannerSizeLabel: sizeLabel,
      bannerWidthFt: widthFt,
      bannerHeightFt: heightFt,
      bannerSides: sides,
      estimateOnly: true,
      ...(config?.bannerNotes ? { bannerNotes: String(config.bannerNotes).slice(0, 500) } : {}),
      ...(config?.artworkUrl ? { artworkUrl: config.artworkUrl } : {}),
      ...(config?.artworkId ? { artworkId: config.artworkId } : {}),
      ...(config?.logoComingByEmail ? { logoComingByEmail: true } : {}),
    },
  }
}

// --- Canvas (src/data/canvasPrints.ts) ---
const CANVAS_PRESETS = {
  '8x10': { label: '8×10 in', estimate: 35 },
  '11x14': { label: '11×14 in', estimate: 45 },
  '16x20': { label: '16×20 in', estimate: 65 },
  '18x24': { label: '18×24 in', estimate: 85 },
}
const CANVAS_FRAMED_ADD = 25

function priceCanvas(config) {
  const sizeId = config?.canvasSizeId || '8x10'
  const preset = CANVAS_PRESETS[sizeId] ?? CANVAS_PRESETS['8x10']
  const finish = config?.canvasFinish === 'framed' ? 'framed' : 'stretched'
  const total = roundMoney(
    finish === 'framed' ? preset.estimate + CANVAS_FRAMED_ADD : preset.estimate,
  )
  const sizeLabel = config?.canvasSizeLabel || preset.label
  return {
    unitDollars: total,
    lineName: 'Custom Canvas Print',
    description: `${sizeLabel} · ${finish === 'framed' ? 'Framed' : 'Stretched'} · Estimate`,
    custom: {
      type: 'canvas',
      canvasSizeId: sizeId,
      canvasSizeLabel: sizeLabel,
      canvasFinish: finish,
      estimateOnly: true,
      ...(config?.canvasNotes ? { canvasNotes: String(config.canvasNotes).slice(0, 500) } : {}),
      ...(config?.artworkUrl ? { artworkUrl: config.artworkUrl } : {}),
      ...(config?.artworkId ? { artworkId: config.artworkId } : {}),
      ...(config?.logoComingByEmail ? { logoComingByEmail: true } : {}),
    },
  }
}

// --- Business cards (src/data/businessCards.ts) ---
const BUSINESS_CARD_PACKS = { 50: 30, 100: 50 }

function priceBusinessCards(config) {
  const qty = Number(config?.cardPackQty) === 100 ? 100 : 50
  const total = BUSINESS_CARD_PACKS[qty]
  return {
    unitDollars: total,
    lineName: 'Custom Business Cards',
    description: `Business cards · ${qty} · double-sided`,
    custom: {
      type: 'business-cards',
      cardPackQty: qty,
      ...(config?.cardNotes ? { cardNotes: String(config.cardNotes).slice(0, 500) } : {}),
      ...(config?.artworkUrl ? { artworkUrl: config.artworkUrl } : {}),
      ...(config?.artworkId ? { artworkId: config.artworkId } : {}),
      ...(config?.logoComingByEmail ? { logoComingByEmail: true } : {}),
    },
  }
}

// --- Thank-you cards (src/data/thankYouCards.ts) ---
const THANK_YOU_CARD_PACKS = { 25: 40, 50: 50 }

function priceThankYouCards(config) {
  const qty = Number(config?.cardPackQty) === 50 ? 50 : 25
  const total = THANK_YOU_CARD_PACKS[qty]
  return {
    unitDollars: total,
    lineName: 'Custom Thank You Cards',
    description: `Thank you cards · ${qty} · 5.5" × 4.25" · double-sided`,
    custom: {
      type: 'thank-you-cards',
      cardPackQty: qty,
      ...(config?.cardNotes ? { cardNotes: String(config.cardNotes).slice(0, 500) } : {}),
      ...(config?.artworkUrl ? { artworkUrl: config.artworkUrl } : {}),
      ...(config?.artworkId ? { artworkId: config.artworkId } : {}),
      ...(config?.logoComingByEmail ? { logoComingByEmail: true } : {}),
    },
  }
}

function readCatalogProducts() {
  const file = existsSync(CATALOG_FILE) ? CATALOG_FILE : CATALOG_SEED
  try {
    const raw = readFileSync(file, 'utf8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return data
    if (data && Array.isArray(data.products)) return data.products
    return []
  } catch (err) {
    console.error('[pricing] catalog read failed', err)
    return []
  }
}

function catalogProductById(id) {
  const products = readCatalogProducts()
  return products.find((p) => p.id === id) ?? null
}

function baseCatalogId(productId) {
  const id = String(productId || '')
  if (id.includes('__scent__')) return id.split('__scent__')[0]
  if (id.includes('__option__')) return id.split('__option__')[0]
  return id
}

function detectCustomKind(productId, config) {
  const id = String(productId || '')
  const c = config && typeof config === 'object' ? config : {}
  if (c.type === 'logo' || c.style || id.startsWith('custom-logo-sticker')) return 'logo'
  if (c.type === 'banner' || c.bannerSizeId || c.bannerSizeLabel || id.startsWith('custom-banner'))
    return 'banner'
  if (c.type === 'canvas' || c.canvasSizeId || c.canvasSizeLabel || id.startsWith('custom-canvas'))
    return 'canvas'
  if (c.type === 'thank-you-cards' || id.startsWith('custom-thank-you-cards')) return 'thank-you-cards'
  if (c.type === 'business-cards' || c.cardPackQty != null || id.startsWith('custom-business-cards'))
    return 'business-cards'
  return null
}

/**
 * Price one cart line. Returns { productId, name, quantity, unitAmountCents, amountCents, custom?, catalogId? }
 * For custom packs the unit is the full pack price and quantity is the cart qty (usually 1).
 */
export function priceCartLine(raw) {
  const row = raw && typeof raw === 'object' ? raw : {}
  const productId = String(row.productId || row.id || '')
  const quantity = Math.max(1, Math.round(Number(row.quantity ?? row.qty) || 1))
  const config = row.config ?? row.custom ?? null

  if (!productId) {
    throw Object.assign(new Error('missing_product_id'), { code: 'missing_product_id' })
  }

  const kind = detectCustomKind(productId, config)
  if (kind === 'logo') {
    const priced = priceLogoStickers(config || {})
    const unitAmountCents = dollarsToCents(priced.unitDollars)
    return {
      productId,
      name: priced.lineName,
      description: priced.description,
      quantity,
      unitAmountCents,
      amountCents: unitAmountCents,
      custom: priced.custom,
    }
  }
  if (kind === 'banner') {
    const priced = priceBanner(config || {})
    const unitAmountCents = dollarsToCents(priced.unitDollars)
    return {
      productId,
      name: priced.lineName,
      description: priced.description,
      quantity,
      unitAmountCents,
      amountCents: unitAmountCents,
      custom: priced.custom,
    }
  }
  if (kind === 'canvas') {
    const priced = priceCanvas(config || {})
    const unitAmountCents = dollarsToCents(priced.unitDollars)
    return {
      productId,
      name: priced.lineName,
      description: priced.description,
      quantity,
      unitAmountCents,
      amountCents: unitAmountCents,
      custom: priced.custom,
    }
  }
  if (kind === 'business-cards') {
    const priced = priceBusinessCards(config || {})
    const unitAmountCents = dollarsToCents(priced.unitDollars)
    return {
      productId,
      name: priced.lineName,
      description: priced.description,
      quantity,
      unitAmountCents,
      amountCents: unitAmountCents,
      custom: priced.custom,
    }
  }
  if (kind === 'thank-you-cards') {
    const priced = priceThankYouCards(config || {})
    const unitAmountCents = dollarsToCents(priced.unitDollars)
    return {
      productId,
      name: priced.lineName,
      description: priced.description,
      quantity,
      unitAmountCents,
      amountCents: unitAmountCents,
      custom: priced.custom,
    }
  }

  const catalogId = String(config?.catalogId || baseCatalogId(productId))
  const product = catalogProductById(catalogId)
  if (!product) {
    throw Object.assign(new Error(`unknown_product:${catalogId}`), {
      code: 'unknown_product',
      productId: catalogId,
    })
  }
  const selectedOptions = config?.selectedOptions && typeof config.selectedOptions === 'object'
    ? config.selectedOptions : {}
  let optionAdjustment = 0
  const normalizedSelections = {}
  for (const group of Array.isArray(product.optionGroups) ? product.optionGroups : []) {
    const selected = selectedOptions[group.name]
    if (!selected && group.required !== false) {
      throw Object.assign(new Error(`missing_option:${group.name}`), { code: 'missing_option' })
    }
    if (!selected) continue
    const choice = Array.isArray(group.values)
      ? group.values.find((value) => value.label === selected)
      : null
    if (!choice) {
      throw Object.assign(new Error(`invalid_option:${group.name}`), { code: 'invalid_option' })
    }
    normalizedSelections[group.name] = choice.label
    optionAdjustment += Number(choice.priceAdjustment) || 0
  }
  if (Number.isInteger(product.inventoryQuantity) && product.inventoryQuantity < quantity) {
    throw Object.assign(new Error(`insufficient_inventory:${catalogId}`), { code: 'insufficient_inventory' })
  }
  const unitAmountCents = dollarsToCents(Number(product.price) + optionAdjustment)
  if (!Number.isFinite(unitAmountCents) || unitAmountCents < 1) {
    throw Object.assign(new Error(`invalid_catalog_price:${catalogId}`), {
      code: 'invalid_catalog_price',
    })
  }

  const scent =
    typeof config?.freshieScent === 'string' && config.freshieScent.trim()
      ? config.freshieScent.trim()
      : productId.includes('__scent__')
        ? decodeURIComponent(productId.split('__scent__')[1] || '').replace(/-/g, ' ')
        : null

  const customOut = {}
  if (scent) customOut.freshieScent = scent
  if (config?.freshieNote) customOut.freshieNote = String(config.freshieNote).slice(0, 500)
  if (Object.keys(normalizedSelections).length) {
    customOut.selectedOptions = normalizedSelections
    customOut.catalogId = catalogId
  }

  return {
    productId,
    catalogId,
    name: String(product.name || 'Item'),
    description: [
      scent ? `Scent: ${scent}` : '',
      ...Object.entries(normalizedSelections).map(([name, value]) => `${name}: ${value}`),
    ].filter(Boolean).join(' · ') || undefined,
    quantity,
    unitAmountCents,
    amountCents: unitAmountCents,
    custom: Object.keys(customOut).length ? customOut : undefined,
  }
}

/**
 * Price a full cart. Returns priced lines + shipping + totals.
 */
export function priceCart(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('empty_cart'), { code: 'empty_cart' })
  }
  const lines = items.map((item) => priceCartLine(item))
  const subtotalCents = lines.reduce(
    (sum, line) => sum + line.unitAmountCents * line.quantity,
    0,
  )
  const shippingCents = shippingCentsForSubtotal(subtotalCents)
  return {
    lines,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
  }
}
