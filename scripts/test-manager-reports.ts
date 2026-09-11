import assert from 'node:assert/strict'
import { activeOrderCounts, monthlySalesReport } from '../src/lib/managerReports.ts'

const orders = [
  { id: 'one', createdAt: '2026-09-11T16:00:00.000Z', total: 50, paid: true, shippingCents: 800, status: 'new', customer: { name: 'A', email: 'a@example.com' }, items: [] },
  { id: 'two', createdAt: '2026-09-15T16:00:00.000Z', total: 100, stripeSessionId: 'cs_paid', shippingCents: 0, status: 'ready', customer: { name: 'B', email: 'b@example.com' }, items: [] },
  { id: 'unpaid', createdAt: '2026-09-16T16:00:00.000Z', total: 999, status: 'making', customer: { name: 'C', email: 'c@example.com' }, items: [] },
  { id: 'old', createdAt: '2026-08-01T16:00:00.000Z', total: 25, paid: true, status: 'shipped', archivedAt: '2026-08-02T16:00:00.000Z', customer: { name: 'D', email: 'd@example.com' }, items: [] },
] as const

const report = monthlySalesReport([...orders], '2026-09')
assert.equal(report.revenue, 150)
assert.equal(report.orderCount, 2)
assert.equal(report.averageOrder, 75)
assert.equal(report.shipping, 8)
assert.deepEqual(activeOrderCounts([...orders]), { new: 1, making: 1, ready: 1, shipped: 0 })
console.log('manager dashboard reports regression test passed')
