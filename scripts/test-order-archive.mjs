import assert from 'node:assert/strict'
import { applyOrderArchive } from '../server/orders.mjs'

const order = { id: 'ord-test', status: 'shipped', total: 35 }
const completedAt = '2026-09-11T03:00:00.000Z'

const archived = applyOrderArchive(order, completedAt)
assert.equal(archived.archivedAt, completedAt)
assert.equal(order.archivedAt, undefined)

const restored = applyOrderArchive(archived, null)
assert.equal(restored.archivedAt, undefined)
assert.equal(restored.status, 'shipped')

assert.throws(() => applyOrderArchive(order, 'not-a-date'), /invalid_archivedAt/)

console.log('order archive/restore regression test passed')
