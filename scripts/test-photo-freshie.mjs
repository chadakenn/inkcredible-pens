import assert from 'node:assert/strict'
import { priceCartLine } from '../server/pricing.mjs'

const line = priceCartLine({
  productId: 'custom-photo-freshie-test',
  quantity: 2,
  config: { type: 'photo-freshie', freshieScent: 'Black Ice', artworkId: 'test.png' },
})
assert.equal(line.unitAmountCents, 1000)
assert.equal(line.quantity, 2)
assert.equal(line.custom.type, 'photo-freshie')
assert.equal(line.custom.freshieScent, 'Black Ice')
assert.throws(
  () => priceCartLine({ productId: 'custom-photo-freshie-test', quantity: 1, config: { type: 'photo-freshie' } }),
  /missing_freshie_scent/,
)
console.log('custom photo freshie pricing regression test passed')
