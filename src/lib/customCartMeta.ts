import { formatBannerCartMeta } from '../data/banners'
import { formatBusinessCardsCartMeta } from '../data/businessCards'
import { formatCanvasCartMeta } from '../data/canvasPrints'
import { formatLogoCartMeta } from '../data/logoStickers'
import { formatThankYouCardsCartMeta } from '../data/thankYouCards'
import type { CustomLogoMeta, Product } from '../data/products'

/** One-line cart/checkout meta for any custom configurator line */
export function formatCustomCartMeta(custom: CustomLogoMeta | undefined): string | null {
  if (!custom) return null
  if (custom.type === 'banner' || custom.bannerSizeLabel) {
    return formatBannerCartMeta(custom.bannerSizeLabel, custom.bannerSides)
  }
  if (custom.type === 'canvas' || custom.canvasSizeLabel) {
    return formatCanvasCartMeta(custom.canvasSizeLabel, custom.canvasFinish)
  }
  if (custom.type === 'thank-you-cards') {
    return formatThankYouCardsCartMeta(custom.cardPackQty)
  }
  if (custom.type === 'business-cards' || custom.cardPackQty != null) {
    return formatBusinessCardsCartMeta(custom.cardPackQty)
  }
  if (custom.style) {
    return formatLogoCartMeta(custom.style, custom.cut, custom.stickerQty, custom.stickerSizeId ?? custom.stickerSize)
  }
  return null
}

export function isUniqueCustomLine(product: Product): boolean {
  const c = product.custom
  return (
    Boolean(c?.style) ||
    c?.type === 'banner' ||
    c?.type === 'canvas' ||
    c?.type === 'logo' ||
    c?.type === 'business-cards' ||
    c?.type === 'thank-you-cards' ||
    product.id.startsWith('custom-logo-sticker') ||
    product.id.startsWith('custom-banner') ||
    product.id.startsWith('custom-canvas') ||
    product.id.startsWith('custom-business-cards') ||
    product.id.startsWith('custom-thank-you-cards')
  )
}
