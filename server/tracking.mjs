/**
 * 17TRACK package watching — register + poll, auto-mark delivered.
 * Env: TRACK17_API_KEY (optional), TRACKING_POLL_MINUTES (default 45).
 * Never expose the API key to the client.
 */
import { requireAdmin } from './adminAuth.mjs'
import {
  findOrderById,
  listOrders,
  updateOrderById,
} from './orders.mjs'

const API_BASE = 'https://api.17track.net/track/v2.2'

/** @typedef {'unknown'|'pre_transit'|'in_transit'|'out_for_delivery'|'delivered'|'exception'|'expired'} TrackingStatus */

export const TRACKING_STATUSES = new Set([
  'unknown',
  'pre_transit',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'expired',
])

/** UI + API carrier labels → 17track numeric carrier codes */
export const CARRIER_CODE_MAP = {
  usps: 21051,
  ups: 100002,
  fedex: 100003,
  dhl: 100001,
  'dhl express': 100001,
  'dhl ecommerce': 100004,
  other: null,
}

/** Public carrier tracking page templates (no API key needed). */
export const CARRIER_TRACK_URL = {
  usps: (n) =>
    `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
  ups: (n) =>
    `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  fedex: (n) =>
    `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  dhl: (n) =>
    `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(n)}`,
}

/**
 * @param {string | undefined | null} carrier
 * @returns {number | null}
 */
export function carrierTo17Code(carrier) {
  if (!carrier || typeof carrier !== 'string') return null
  const key = carrier.trim().toLowerCase()
  if (Object.prototype.hasOwnProperty.call(CARRIER_CODE_MAP, key)) {
    return CARRIER_CODE_MAP[key]
  }
  // Fuzzy: "USPS Priority" → usps
  for (const [name, code] of Object.entries(CARRIER_CODE_MAP)) {
    if (name !== 'other' && key.includes(name)) return code
  }
  return null
}

/**
 * Map 17track main status `e` / `z` (0–8) to our enum.
 * @param {number | string | undefined | null} code
 * @returns {TrackingStatus}
 */
export function normalize17Status(code) {
  const n = typeof code === 'string' ? Number(code) : code
  if (n == null || Number.isNaN(n)) return 'unknown'
  switch (n) {
    case 0:
      return 'unknown'
    case 1:
      return 'pre_transit'
    case 2:
      return 'in_transit'
    case 3:
      return 'expired'
    case 4:
      return 'in_transit' // AvailableForPickup
    case 5:
      return 'out_for_delivery'
    case 6:
      return 'exception' // DeliveryFailure
    case 7:
      return 'delivered'
    case 8:
      return 'exception'
    default:
      return 'unknown'
  }
}

/**
 * Extract status + detail from a 17track gettrackinfo accepted item / webhook payload.
 * @param {unknown} payload
 * @returns {{ trackingStatus: TrackingStatus, trackingDetail: string }}
 */
export function parse17TrackPayload(payload) {
  const root = payload && typeof payload === 'object' ? payload : {}
  // Accepted item shape: { number, carrier, track: { e, z0: { c, z }, … } }
  const track =
    root.track && typeof root.track === 'object'
      ? root.track
      : root.data && typeof root.data === 'object' && root.data.track
        ? root.data.track
        : root

  const main =
    track.e ??
    track.z ??
    track.status ??
    (track.z0 && typeof track.z0 === 'object' ? track.z0.z : undefined)

  const z0 = track.z0 && typeof track.z0 === 'object' ? track.z0 : null
  const detailRaw =
    (z0 && (z0.c || z0.z || z0.description)) ||
    track.status_desc ||
    track.statusDescription ||
    track.description ||
    ''

  const trackingStatus = normalize17Status(main)
  const trackingDetail =
    typeof detailRaw === 'string' && detailRaw.trim()
      ? detailRaw.trim().slice(0, 280)
      : trackingStatus === 'delivered'
        ? 'Delivered'
        : trackingStatus.replace(/_/g, ' ')

  return { trackingStatus, trackingDetail }
}

/**
 * Apply tracking fields onto an order; when delivered, set status=done + deliveredAt (idempotent).
 * Pure — returns next order object (does not write).
 * @param {object} order
 * @param {{ trackingStatus: TrackingStatus, trackingDetail?: string, trackingCheckedAt?: string }} info
 */
export function applyTrackingToOrder(order, info) {
  const now = info.trackingCheckedAt || new Date().toISOString()
  const next = {
    ...order,
    trackingStatus: info.trackingStatus,
    trackingDetail: info.trackingDetail || order.trackingDetail,
    trackingCheckedAt: now,
  }

  if (info.trackingStatus === 'delivered') {
    next.status = 'done'
    if (!next.deliveredAt) {
      next.deliveredAt = now
    }
  }
  return next
}

export function getTrack17ApiKey() {
  const key = process.env.TRACK17_API_KEY
  return typeof key === 'string' && key.trim() ? key.trim() : ''
}

export function isTrackingConfigured() {
  return Boolean(getTrack17ApiKey())
}

export function trackingPollMinutes() {
  const raw = Number(process.env.TRACKING_POLL_MINUTES)
  if (Number.isFinite(raw) && raw >= 5 && raw <= 24 * 60) return Math.round(raw)
  return 45
}

/**
 * @param {string} path
 * @param {unknown} body
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
async function track17Post(path, body, opts = {}) {
  const key = getTrack17ApiKey()
  if (!key) {
    const err = new Error('tracking_not_configured')
    err.code = 'tracking_not_configured'
    throw err
  }
  const fetchImpl = opts.fetchImpl || globalThis.fetch
  const res = await fetchImpl(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      '17token': key,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    const err = new Error(`track17_http_${res.status}`)
    err.code = 'track17_http_error'
    err.status = res.status
    err.body = json || text
    throw err
  }
  return json
}

/**
 * Register a number with 17track (idempotent — already-registered is ok).
 * @param {{ number: string, carrier?: number | null, tag?: string }} input
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function registerTrack17(input, opts = {}) {
  const row = { number: String(input.number).trim() }
  if (input.carrier != null) row.carrier = input.carrier
  if (input.tag) row.tag = String(input.tag).slice(0, 64)
  const json = await track17Post('/register', [row], opts)
  return json
}

/**
 * @param {{ number: string, carrier?: number | null }} input
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function getTrack17Info(input, opts = {}) {
  const row = { number: String(input.number).trim() }
  if (input.carrier != null) row.carrier = input.carrier
  const json = await track17Post('/gettrackinfo', [row], opts)
  return json
}

/**
 * Pull first accepted track item from gettrackinfo response.
 * @param {unknown} json
 */
export function firstAcceptedTrack(json) {
  const data = json && typeof json === 'object' ? json.data : null
  const accepted = data && Array.isArray(data.accepted) ? data.accepted : []
  return accepted[0] || null
}

/**
 * Register (if needed) + refresh one order. Writes atomically via updateOrderById.
 * @param {string} orderId
 * @param {{ fetchImpl?: typeof fetch, skipRegister?: boolean }} [opts]
 */
export async function refreshOrderTracking(orderId, opts = {}) {
  if (!isTrackingConfigured()) {
    const err = new Error('tracking_not_configured')
    err.code = 'tracking_not_configured'
    throw err
  }

  const order = findOrderById(orderId)
  if (!order) {
    const err = new Error('not_found')
    err.code = 'not_found'
    throw err
  }
  if (!order.trackingNumber) {
    const err = new Error('no_tracking_number')
    err.code = 'no_tracking_number'
    throw err
  }

  const carrierCode = carrierTo17Code(order.trackingCarrier)
  const number = String(order.trackingNumber).trim()

  if (!opts.skipRegister) {
    try {
      await registerTrack17(
        { number, carrier: carrierCode, tag: order.id },
        { fetchImpl: opts.fetchImpl },
      )
    } catch (err) {
      // Already registered / soft failures — still try gettrackinfo
      console.warn(
        '[tracking] register',
        orderId,
        err?.code || err?.message || err,
      )
    }
  }

  const infoJson = await getTrack17Info(
    { number, carrier: carrierCode },
    { fetchImpl: opts.fetchImpl },
  )
  const accepted = firstAcceptedTrack(infoJson)
  if (!accepted) {
    const rejected =
      infoJson?.data?.rejected?.[0]?.error?.message ||
      infoJson?.data?.rejected?.[0]?.error?.code
    const updated = updateOrderById(orderId, (o) =>
      applyTrackingToOrder(o, {
        trackingStatus: 'unknown',
        trackingDetail: rejected
          ? `Lookup failed: ${rejected}`
          : 'No tracking data yet',
        trackingCheckedAt: new Date().toISOString(),
      }),
    )
    return { order: updated, trackingStatus: 'unknown', raw: infoJson }
  }

  const parsed = parse17TrackPayload(accepted)
  const updated = updateOrderById(orderId, (o) =>
    applyTrackingToOrder(o, {
      ...parsed,
      trackingCheckedAt: new Date().toISOString(),
    }),
  )
  return {
    order: updated,
    trackingStatus: parsed.trackingStatus,
    trackingDetail: parsed.trackingDetail,
    raw: infoJson,
  }
}

/**
 * After Store Manager saves trackingCarrier + trackingNumber — fire-and-forget watch.
 * @param {object} order
 */
export function maybeWatchAfterTrackingSave(order) {
  if (!order?.trackingNumber) return
  if (order.status === 'cancelled') return
  if (!isTrackingConfigured()) {
    console.warn(
      '[tracking] TRACK17_API_KEY not set — skip watch for',
      order.id,
    )
    return
  }
  void refreshOrderTracking(order.id).catch((err) => {
    console.warn(
      '[tracking] immediate refresh failed',
      order.id,
      err?.code || err?.message || err,
    )
  })
}

function shouldPollOrder(o) {
  if (!o?.trackingNumber) return false
  if (o.status === 'cancelled') return false
  if (o.deliveredAt) return false
  if (o.trackingStatus === 'delivered') return false
  return true
}

/**
 * Poll all watchable orders once.
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 */
export async function refreshAllWatchableOrders(opts = {}) {
  if (!isTrackingConfigured()) {
    console.warn('[tracking] poll skipped — TRACK17_API_KEY not set')
    return { skipped: true, reason: 'tracking_not_configured', refreshed: 0 }
  }
  const orders = listOrders().filter(shouldPollOrder)
  let refreshed = 0
  const errors = []
  for (const o of orders) {
    try {
      await refreshOrderTracking(o.id, {
        fetchImpl: opts.fetchImpl,
        skipRegister: false,
      })
      refreshed += 1
    } catch (err) {
      errors.push({ id: o.id, error: err?.code || err?.message || String(err) })
      console.warn('[tracking] poll order failed', o.id, err?.message || err)
    }
  }
  return { skipped: false, refreshed, total: orders.length, errors }
}

let pollTimer = null

export function startTrackingPoll() {
  const minutes = trackingPollMinutes()
  const ms = minutes * 60 * 1000

  if (pollTimer) clearInterval(pollTimer)

  if (!isTrackingConfigured()) {
    console.warn(
      `[tracking] watching disabled — set TRACK17_API_KEY (poll would be every ${minutes}m)`,
    )
    return
  }

  console.log(`[tracking] 17track poll every ${minutes} minutes`)
  // First sweep shortly after boot (give server a moment)
  setTimeout(() => {
    void refreshAllWatchableOrders().catch((err) =>
      console.warn('[tracking] initial poll failed', err),
    )
  }, 15_000)

  pollTimer = setInterval(() => {
    void refreshAllWatchableOrders().catch((err) =>
      console.warn('[tracking] interval poll failed', err),
    )
  }, ms)
  if (typeof pollTimer.unref === 'function') pollTimer.unref()
}

/**
 * @param {import('express').Express} app
 */
export function mountTracking(app) {
  app.post('/api/orders/:id/tracking/refresh', requireAdmin, async (req, res) => {
    const id = String(req.params.id || '')
    if (!id) return res.status(400).json({ error: 'invalid_id' })
    if (!isTrackingConfigured()) {
      return res.status(503).json({ error: 'tracking_not_configured' })
    }
    try {
      const result = await refreshOrderTracking(id)
      return res.json({
        order: result.order,
        trackingStatus: result.trackingStatus,
        trackingDetail: result.trackingDetail,
      })
    } catch (err) {
      const code = err?.code || 'refresh_failed'
      if (code === 'not_found') return res.status(404).json({ error: code })
      if (code === 'no_tracking_number') {
        return res.status(400).json({ error: code })
      }
      if (code === 'tracking_not_configured') {
        return res.status(503).json({ error: code })
      }
      console.error('[tracking] refresh', id, err)
      return res.status(502).json({ error: code, message: err?.message })
    }
  })

  app.post('/api/orders/tracking/refresh-all', requireAdmin, async (_req, res) => {
    if (!isTrackingConfigured()) {
      return res.status(503).json({ error: 'tracking_not_configured' })
    }
    try {
      const result = await refreshAllWatchableOrders()
      return res.json(result)
    } catch (err) {
      console.error('[tracking] refresh-all', err)
      return res.status(502).json({
        error: err?.code || 'refresh_failed',
        message: err?.message,
      })
    }
  })
}
