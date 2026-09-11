import assert from 'node:assert/strict'
import { priceCartLine } from '../server/pricing.mjs'

function priced(style, requestedQty) {
  return priceCartLine({
    productId: 'custom-logo-stickers-test',
    quantity: 1,
    config: { type: 'logo', style, stickerSizeId: '3', stickerQty: requestedQty },
  })
}

assert.equal(priced('vinyl', 1).custom.stickerQty, 50)
assert.equal(priced('vinyl', 50).custom.stickerQty, 50)
assert.equal(priced('holo', 1).custom.stickerQty, 5)
assert.equal(priced('holo', 5).custom.stickerQty, 5)
assert.equal(priced('glow', 1).custom.stickerQty, 5)
assert.equal(priced('glow', 5).custom.stickerQty, 5)

console.log('logo sticker minimum regression test passed')
