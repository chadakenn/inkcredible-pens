import assert from 'node:assert/strict'
import {
  FLAT_SHIPPING_CENTS,
  CANVAS_SHIPPING_CENTS,
  LARGE_PRINT_SHIPPING_CENTS,
  FREE_SHIPPING_THRESHOLD_CENTS,
  shippingCentsForSubtotal,
} from '../server/pricing.mjs'

assert.equal(FREE_SHIPPING_THRESHOLD_CENTS, 6000)
assert.equal(shippingCentsForSubtotal(5999), FLAT_SHIPPING_CENTS)
assert.equal(shippingCentsForSubtotal(6000), 0)
assert.equal(shippingCentsForSubtotal(6001), 0)
assert.equal(shippingCentsForSubtotal(3500, true), CANVAS_SHIPPING_CENTS)
assert.equal(shippingCentsForSubtotal(8500, true), CANVAS_SHIPPING_CENTS)
assert.equal(shippingCentsForSubtotal(3500, false, true), LARGE_PRINT_SHIPPING_CENTS)
assert.equal(shippingCentsForSubtotal(8500, false, true), LARGE_PRINT_SHIPPING_CENTS)

console.log('shipping boundary regression test passed')
