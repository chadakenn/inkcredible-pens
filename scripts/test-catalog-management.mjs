import assert from 'node:assert/strict'
import { applyProductDefaults, validateProductShape } from '../server/catalog.mjs'

const valid = validateProductShape({
  name: 'Canvas print',
  price: 30,
  category: 'Canvas',
  inventoryQuantity: 4,
  optionGroups: [{
    name: 'Size',
    values: [
      { label: '8×10', priceAdjustment: 0 },
      { label: '16×20', priceAdjustment: 25 },
    ],
  }],
})
assert.deepEqual(valid.errors, [])
assert.equal(valid.out.inventoryQuantity, 4)
assert.equal(valid.out.optionGroups[0].required, true)
assert.equal(valid.out.optionGroups[0].values[1].priceAdjustment, 25)

assert.deepEqual(
  validateProductShape({ inventoryQuantity: -1 }, { partial: true }).errors,
  ['invalid_inventoryQuantity'],
)
assert.deepEqual(
  validateProductShape({
    optionGroups: [{ name: 'Size', values: [{ label: '8×10' }, { label: '8×10' }] }],
  }, { partial: true }).errors,
  ['invalid_optionGroups'],
)

const canvas = applyProductDefaults({ name: 'Funny canvas', category: 'Canvas', price: 30 })
assert.equal(canvas.price, 35)
assert.deepEqual(canvas.optionGroups[0].values.map((value) => [value.label, value.priceAdjustment]), [
  ['12×16 in', 0],
  ['16×20 in', 15],
  ['20×32 in', 50],
])

console.log('catalog inventory/options regression test passed')
