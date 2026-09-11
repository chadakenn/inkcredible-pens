import assert from 'node:assert/strict'
import { paidSalesSummary, type SalesOrder } from '../src/lib/salesSummary.ts'

const orders = [
  { id: 'paid', total: 43, paid: true },
  { id: 'stripe', total: 58, stripeSessionId: 'cs_test_paid', archivedAt: '2026-09-11T00:00:00.000Z' },
  { id: 'unpaid', total: 999 },
] as SalesOrder[]

assert.deepEqual(paidSalesSummary(orders), {
  total: 101,
  paidOrders: 2,
  archivedOrders: 1,
})

console.log('paid sales summary regression test passed')
