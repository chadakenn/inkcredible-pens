import assert from 'node:assert/strict'
import { buildPackingSlipHtml } from '../src/lib/packingSlip.ts'

const html = buildPackingSlipHtml({
  id: 'ord-test',
  displayCode: 'TEST-123',
  createdAt: '2026-09-11T12:00:00.000Z',
  status: 'new',
  total: 99,
  customer: {
    name: '<script>alert(1)</script>',
    email: 'customer@example.com',
    address: '123 Main St',
    city: 'Findlay',
    state: 'OH',
    zip: '45840',
  },
  items: [{ name: 'Canvas', price: 99, qty: 2 }],
}, () => 'Size: 12 × 16 in')

assert.match(html, /Order TEST-123/)
assert.match(html, /2 × Canvas/)
assert.match(html, /Size: 12 × 16 in/)
assert.doesNotMatch(html, /<script>alert/)
assert.doesNotMatch(html, /\$99/)
console.log('packing slip regression test passed')
