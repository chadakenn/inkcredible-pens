import assert from 'node:assert/strict'
import { normalizeQuoteItems, quoteShippingCents } from '../server/quotes.mjs'

const items = normalizeQuoteItems([{ name: 'Custom Banner', qty: 1, estimate: 80, custom: { estimateOnly: true, bannerSizeLabel: '2×4 ft' } }])
assert.equal(items.length, 1)
assert.equal(items[0].estimate, 80)
assert.throws(() => normalizeQuoteItems([{ name: 'Normal product', qty: 1, custom: {} }]), /quote_items_only/)
assert.equal(quoteShippingCents(6000), 800)
assert.equal(quoteShippingCents(6001), 0)
console.log('no-payment quote workflow regression test passed')
