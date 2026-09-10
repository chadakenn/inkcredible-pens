/**
 * Unit-ish: mock 17track "Delivered" payload → order remains shipped + deliveredAt.
 * Run: node scripts/test-tracking.mjs
 */
import assert from 'node:assert/strict'
import {
  applyTrackingToOrder,
  normalize17Status,
  parse17TrackPayload,
  carrierTo17Code,
} from '../server/tracking.mjs'

assert.equal(normalize17Status(7), 'delivered')
assert.equal(normalize17Status(5), 'out_for_delivery')
assert.equal(normalize17Status(2), 'in_transit')
assert.equal(normalize17Status(1), 'pre_transit')
assert.equal(normalize17Status(8), 'exception')
assert.equal(normalize17Status(3), 'expired')

assert.equal(carrierTo17Code('USPS'), 21051)
assert.equal(carrierTo17Code('UPS'), 100002)
assert.equal(carrierTo17Code('FedEx'), 100003)
assert.equal(carrierTo17Code('DHL'), 100001)
assert.equal(carrierTo17Code('Other'), null)

const mockAccepted = {
  number: '9400111899223344556677',
  carrier: 21051,
  track: {
    e: 7,
    z0: {
      a: 'Austin, TX',
      c: 'Delivered, Front Door/Porch',
      d: '2026-09-09 14:22',
      z: 7,
      s: 701,
    },
  },
}

const parsed = parse17TrackPayload(mockAccepted)
assert.equal(parsed.trackingStatus, 'delivered')
assert.match(parsed.trackingDetail, /Delivered/i)

const order = {
  id: 'ord-test',
  status: 'making',
  trackingNumber: mockAccepted.number,
  trackingCarrier: 'USPS',
}

const checkedAt = '2026-09-09T18:30:00.000Z'
const next = applyTrackingToOrder(order, {
  ...parsed,
  trackingCheckedAt: checkedAt,
})

assert.equal(next.status, 'shipped')
assert.equal(next.trackingStatus, 'delivered')
assert.equal(next.deliveredAt, checkedAt)
assert.equal(next.trackingCheckedAt, checkedAt)

// Idempotent deliveredAt
const again = applyTrackingToOrder(next, {
  trackingStatus: 'delivered',
  trackingDetail: 'Delivered',
  trackingCheckedAt: '2026-09-10T00:00:00.000Z',
})
assert.equal(again.deliveredAt, checkedAt)
assert.equal(again.status, 'shipped')

// Mock fetch path: simulate gettrackinfo → apply
const mockFetch = async () => ({
  ok: true,
  text: async () =>
    JSON.stringify({
      code: 0,
      data: { accepted: [mockAccepted], rejected: [] },
    }),
})

process.env.TRACK17_API_KEY = 'test-key-not-real'
const { getTrack17Info, firstAcceptedTrack, parse17TrackPayload: parse } =
  await import('../server/tracking.mjs')
const json = await getTrack17Info(
  { number: mockAccepted.number, carrier: 21051 },
  { fetchImpl: mockFetch },
)
const accepted = firstAcceptedTrack(json)
assert.ok(accepted)
const fromApi = parse(accepted)
assert.equal(fromApi.trackingStatus, 'delivered')

const applied = applyTrackingToOrder(
  { ...order, status: 'making' },
  { ...fromApi, trackingCheckedAt: checkedAt },
)
assert.equal(applied.status, 'shipped')
assert.equal(applied.deliveredAt, checkedAt)

console.log('ok — delivered payload keeps status=shipped + deliveredAt')
