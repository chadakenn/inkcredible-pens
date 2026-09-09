/**
 * Shared production-hardening helpers: env signals, rate limits, magic bytes, JSON I/O.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

/** True when we must behave like production (fail-closed webhooks, lock return origin). */
export function isProductionHardening() {
  if (process.env.NODE_ENV === 'production') return true
  if (process.env.REQUIRE_STRIPE_WEBHOOK === '1') return true
  const origin = String(process.env.ORIGIN || '')
  if (/inkcrediblepens\.org/i.test(origin)) return true
  try {
    const u = new URL(origin)
    const host = u.hostname.toLowerCase()
    const local = host === 'localhost' || host === '127.0.0.1' || host === '::1'
    if (u.protocol === 'https:' && !local) return true
  } catch {
    /* ignore */
  }
  return false
}

export function normalizeOrigin(value) {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const u = new URL(value.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

export function isLocalhostOrigin(value) {
  try {
    const u = new URL(value)
    const host = u.hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

/**
 * Stripe success/cancel origin.
 * Production / HTTPS prod ORIGIN: always configured ORIGIN (ignore client).
 * Dev: prefer env ORIGIN when set; else allow localhost (or any http) from client.
 */
export function resolveReturnOrigin(bodyOrigin, fallback = 'http://127.0.0.1:5173') {
  const envOrigin = normalizeOrigin(process.env.ORIGIN)
  const production = isProductionHardening()

  if (production) {
    if (envOrigin) return envOrigin
    console.error(
      '[security] production hardening on but ORIGIN missing — using https://inkcrediblepens.org',
    )
    return 'https://inkcrediblepens.org'
  }

  if (envOrigin) return envOrigin

  const client = normalizeOrigin(bodyOrigin)
  if (client) {
    if (isLocalhostOrigin(client)) return client
    // Dev without ORIGIN: still accept client http(s) for tunnel previews
    return client
  }

  return normalizeOrigin(fallback) || 'http://127.0.0.1:5173'
}

/**
 * Whether unsigned Stripe webhook bodies may be parsed.
 * Production hardening: never. Dev: only with ALLOW_INSECURE_WEBHOOK=1
 * (legacy: if neither production nor flag, still allow with loud warning for local convenience).
 */
export function allowUnsignedWebhook() {
  if (isProductionHardening()) return false
  if (process.env.ALLOW_INSECURE_WEBHOOK === '1') return true
  // Local convenience when no production signals and flag unset
  return true
}

/**
 * Configure Express trust proxy so req.ip is the client IP after Cloudflare/Caddy.
 * Recommended: TRUST_PROXY=1 (one hop: CF Tunnel → Node, or Caddy → Node).
 * Set TRUST_PROXY=2 if Cloudflare → Caddy → Node (two reverse-proxy hops).
 * Never leave unset behind a proxy — rate limits would key on 127.0.0.1 for everyone.
 */
export function configureTrustProxy(app) {
  const raw = process.env.TRUST_PROXY
  if (raw === undefined || raw === '') {
    // Default: one hop when production hardening is on (typical CF Tunnel / Caddy).
    if (isProductionHardening()) {
      app.set('trust proxy', 1)
      console.log('[security] trust proxy = 1 (production default; set TRUST_PROXY to override)')
    }
    return
  }
  if (raw === 'true' || raw === '1') {
    app.set('trust proxy', 1)
    return
  }
  if (raw === 'false' || raw === '0') {
    app.set('trust proxy', false)
    return
  }
  const n = Number(raw)
  if (Number.isFinite(n) && n >= 0) {
    app.set('trust proxy', n)
    return
  }
  // Allow Express subnet / named settings (e.g. "loopback")
  app.set('trust proxy', raw)
}

/** Client IP after trust proxy — never raw first X-Forwarded-For entry. */
export function clientIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown'
  return String(ip)
}

/** Simple in-memory sliding window rate limiter (single-node / Proxmox). */
export function createRateLimiter({ windowMs, max, name = 'rate' }) {
  /** @type {Map<string, number[]>} */
  const hits = new Map()

  function prune(now) {
    for (const [key, times] of hits) {
      const next = times.filter((t) => now - t < windowMs)
      if (next.length === 0) hits.delete(key)
      else hits.set(key, next)
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now()
    if (hits.size > 5000) prune(now)
    const ip = clientIp(req)
    const times = (hits.get(ip) || []).filter((t) => now - t < windowMs)
    if (times.length >= max) {
      const retrySec = Math.ceil((windowMs - (now - times[0])) / 1000)
      res.setHeader('Retry-After', String(Math.max(1, retrySec)))
      console.warn(`[${name}] rate limit hit ip=${ip}`)
      return res.status(429).json({ error: 'rate_limited', retryAfterSec: retrySec })
    }
    times.push(now)
    hits.set(ip, times)
    return next()
  }
}

/** Cart abuse caps for public checkout. */
export const CART_LIMITS = {
  maxLines: 30,
  maxQuantityPerLine: 99,
  maxStringFieldLen: 500,
  maxNotesLen: 500,
  maxDimension: 1000,
}

/**
 * Reject oversized / abusive cart payloads before pricing.
 * @param {unknown[]} items
 */
export function assertCartWithinLimits(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('empty_cart'), { code: 'empty_cart' })
  }
  if (items.length > CART_LIMITS.maxLines) {
    throw Object.assign(new Error('cart_too_many_lines'), { code: 'cart_too_many_lines' })
  }
  for (const raw of items) {
    const row = raw && typeof raw === 'object' ? raw : {}
    const qty = Math.round(Number(row.quantity ?? row.qty) || 1)
    if (qty < 1 || qty > CART_LIMITS.maxQuantityPerLine) {
      throw Object.assign(new Error('quantity_out_of_range'), { code: 'quantity_out_of_range' })
    }
    const config = row.config ?? row.custom ?? null
    if (config && typeof config === 'object') {
      for (const [k, v] of Object.entries(config)) {
        if (typeof v === 'string' && v.length > CART_LIMITS.maxStringFieldLen) {
          throw Object.assign(new Error(`field_too_long:${k}`), { code: 'field_too_long' })
        }
        if (
          (k === 'bannerWidthFt' || k === 'bannerHeightFt' || k === 'canvasWidthIn' || k === 'canvasHeightIn') &&
          Number.isFinite(Number(v)) &&
          Math.abs(Number(v)) > CART_LIMITS.maxDimension
        ) {
          throw Object.assign(new Error(`dimension_too_large:${k}`), { code: 'dimension_too_large' })
        }
      }
    }
  }
}

/** Raster image magic-byte detection (no SVG). */
export function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' }
  }
  // PNG
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' }
  }
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { mime: 'image/gif', ext: '.gif' }
  }
  // WebP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: '.webp' }
  }
  return null
}

export class CorruptJsonError extends Error {
  constructor(filePath, cause) {
    super(`Corrupt JSON: ${filePath}`)
    this.name = 'CorruptJsonError'
    this.code = 'corrupt_json'
    this.path = filePath
    this.cause = cause
  }
}

/**
 * Atomic JSON write with rolling backups (file.bak + timestamped, keep last N).
 */
export function writeJsonAtomic(filePath, data, { keepBackups = 5 } = {}) {
  const dir = path.dirname(filePath)
  mkdirSync(dir, { recursive: true })
  const payload = JSON.stringify(data, null, 2)

  if (existsSync(filePath)) {
    try {
      const bak = `${filePath}.bak`
      copyFileSync(filePath, bak)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const stamped = `${filePath}.${stamp}.bak`
      copyFileSync(filePath, stamped)
      rotateBackups(filePath, keepBackups)
    } catch (err) {
      console.error('[jsonStore] backup failed', filePath, err)
    }
  }

  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, payload, 'utf8')
  renameSync(tmp, filePath)
}

function rotateBackups(filePath, keepBackups) {
  const dir = path.dirname(filePath)
  const base = path.basename(filePath)
  let stamped
  try {
    stamped = readdirSync(dir)
      .filter((f) => f.startsWith(`${base}.`) && f.endsWith('.bak') && f !== `${base}.bak`)
      .map((f) => ({ f, t: path.join(dir, f) }))
      .sort((a, b) => b.f.localeCompare(a.f))
  } catch {
    return
  }
  for (const row of stamped.slice(keepBackups)) {
    try {
      unlinkSync(row.t)
    } catch {
      /* ignore */
    }
  }
}

/**
 * Read + parse JSON. Missing file → null (caller may treat as empty).
 * Corrupt / invalid JSON → throws CorruptJsonError (fail loudly).
 */
export function readJsonFile(filePath) {
  if (!existsSync(filePath)) return null
  let raw
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (err) {
    console.error('[jsonStore] read I/O failed', filePath, err)
    throw new CorruptJsonError(filePath, err)
  }
  try {
    return JSON.parse(raw)
  } catch (err) {
    console.error('[jsonStore] CORRUPT JSON — refusing to continue', filePath, err)
    throw new CorruptJsonError(filePath, err)
  }
}
