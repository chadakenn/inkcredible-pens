/**
 * Server-side admin PIN + HMAC session tokens.
 * PIN: ADMIN_PIN env or data/admin/pin.json after Change PIN.
 * Production hardening: refuse missing / default 1234 PIN at boot.
 * Dev may default to 1234 with a loud warning.
 * Session secret: ADMIN_SESSION_SECRET env or durable file in data/admin/.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRateLimiter, isProductionHardening as _isProductionHardening } from './security.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ADMIN_DIR = path.resolve(__dirname, '../data/admin')
const PIN_FILE = path.join(ADMIN_DIR, 'pin.json')
const SECRET_FILE = path.join(ADMIN_DIR, 'session-secret.json')

const DEFAULT_PIN = '1234'
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12 // 12 hours

mkdirSync(ADMIN_DIR, { recursive: true })

function safeEqualStr(a, b) {
  const ba = Buffer.from(String(a), 'utf8')
  const bb = Buffer.from(String(b), 'utf8')
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Resolve effective admin PIN.
 * Order: persisted pin.json → ADMIN_PIN env → (dev only) default 1234.
 * @param {{ allowDefault?: boolean }} [opts]
 */
export function getAdminPin(opts = {}) {
  const allowDefault = opts.allowDefault !== false
  try {
    if (existsSync(PIN_FILE)) {
      const data = JSON.parse(readFileSync(PIN_FILE, 'utf8'))
      if (typeof data?.pin === 'string' && data.pin.trim().length >= 4) {
        return data.pin.trim()
      }
    }
  } catch (err) {
    console.error('[adminAuth] pin read failed', err)
  }
  const fromEnv = process.env.ADMIN_PIN
  if (typeof fromEnv === 'string' && fromEnv.trim().length >= 4) {
    return fromEnv.trim()
  }
  if (allowDefault) return DEFAULT_PIN
  return null
}

export function isDefaultAdminPin() {
  const pin = getAdminPin({ allowDefault: true })
  return pin === DEFAULT_PIN
}

/**
 * Production: refuse to boot if PIN missing or still the default 1234.
 * Dev: allow 1234 with a loud warning.
 * Call before app.listen.
 */
export function assertAdminPinSafeToBoot() {
  const persisted = (() => {
    try {
      if (existsSync(PIN_FILE)) {
        const data = JSON.parse(readFileSync(PIN_FILE, 'utf8'))
        if (typeof data?.pin === 'string' && data.pin.trim().length >= 4) {
          return data.pin.trim()
        }
      }
    } catch {
      /* ignore */
    }
    return null
  })()
  const fromEnv =
    typeof process.env.ADMIN_PIN === 'string' && process.env.ADMIN_PIN.trim().length >= 4
      ? process.env.ADMIN_PIN.trim()
      : null
  const effective = persisted || fromEnv

  if (_isProductionHardening()) {
    if (!effective) {
      console.error(
        '[adminAuth] FATAL: ADMIN_PIN missing under production hardening. Set a strong ADMIN_PIN in .env (not 1234).',
      )
      process.exit(1)
    }
    if (effective === DEFAULT_PIN) {
      console.error(
        '[adminAuth] FATAL: ADMIN_PIN is the default 1234 under production hardening. Set a strong PIN (or Change PIN so data/admin/pin.json is not 1234).',
      )
      process.exit(1)
    }
    if (effective.length < 6) {
      console.warn(
        '[adminAuth] WARNING: ADMIN_PIN is shorter than 6 characters — prefer a longer PIN in production.',
      )
    }
    return
  }

  if (!effective || effective === DEFAULT_PIN) {
    console.warn(
      '[adminAuth] WARNING: using default admin PIN 1234 — fine for local/dev only. Production will refuse to start with this PIN.',
    )
  }
}

export function setAdminPin(newPin) {
  const pin = String(newPin ?? '').trim()
  if (pin.length < 4) {
    const err = new Error('pin_too_short')
    err.code = 'pin_too_short'
    throw err
  }
  writeFileSync(
    PIN_FILE,
    JSON.stringify({ pin, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  )
  return pin
}

function loadOrCreateSessionSecret() {
  if (typeof process.env.ADMIN_SESSION_SECRET === 'string' && process.env.ADMIN_SESSION_SECRET.length >= 16) {
    return process.env.ADMIN_SESSION_SECRET
  }
  try {
    if (existsSync(SECRET_FILE)) {
      const data = JSON.parse(readFileSync(SECRET_FILE, 'utf8'))
      if (typeof data?.secret === 'string' && data.secret.length >= 16) {
        return data.secret
      }
    }
  } catch (err) {
    console.error('[adminAuth] secret read failed', err)
  }
  const secret = randomBytes(32).toString('hex')
  writeFileSync(
    SECRET_FILE,
    JSON.stringify({ secret, createdAt: new Date().toISOString() }, null, 2),
    'utf8',
  )
  console.log('[adminAuth] generated session secret →', SECRET_FILE)
  return secret
}

const sessionSecret = loadOrCreateSessionSecret()

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromB64url(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(b64, 'base64').toString('utf8')
}

export function signAdminToken(payload = {}) {
  const body = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + TOKEN_TTL_MS,
  }
  const payloadPart = b64url(JSON.stringify(body))
  const sig = createHmac('sha256', sessionSecret).update(payloadPart).digest()
  return `${payloadPart}.${b64url(sig)}`
}

export function verifyAdminToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [payloadPart, sigPart] = token.split('.')
  if (!payloadPart || !sigPart) return null
  const expected = createHmac('sha256', sessionSecret).update(payloadPart).digest()
  let provided
  try {
    const pad = sigPart.length % 4 === 0 ? '' : '='.repeat(4 - (sigPart.length % 4))
    const b64 = sigPart.replace(/-/g, '+').replace(/_/g, '/') + pad
    provided = Buffer.from(b64, 'base64')
  } catch {
    return null
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null
  }
  try {
    const body = JSON.parse(fromB64url(payloadPart))
    if (!body || typeof body.exp !== 'number' || Date.now() > body.exp) return null
    return body
  } catch {
    return null
  }
}

export function extractBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization
  if (typeof h !== 'string') return null
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m ? m[1].trim() : null
}

/** Express middleware — requires valid admin session Bearer token. */
export function requireAdmin(req, res, next) {
  const token = extractBearer(req)
  const payload = token ? verifyAdminToken(token) : null
  if (!payload) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  req.admin = payload
  return next()
}

/**
 * @param {import('express').Express} app
 */
export function mountAdminAuth(app) {
  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    name: 'admin-login',
  })
  const changePinLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    name: 'admin-change-pin',
  })

  app.post('/api/admin/login', loginLimiter, (req, res) => {
    // Slight delay on every attempt to slow brute force (does not reveal PIN existence)
    const delayMs = 200 + Math.floor(Math.random() * 200)
    const pin = String(req.body?.pin ?? '').trim()
    const ok = Boolean(pin) && safeEqualStr(pin, getAdminPin())
    setTimeout(() => {
      if (!ok) {
        return res.status(401).json({ error: 'invalid_pin' })
      }
      const token = signAdminToken({ role: 'admin' })
      return res.json({
        token,
        expiresInMs: TOKEN_TTL_MS,
        isDefaultPin: isDefaultAdminPin(),
      })
    }, delayMs)
  })

  // Requires authenticated admin Bearer session — current PIN alone is not enough.
  app.post('/api/admin/change-pin', changePinLimiter, requireAdmin, (req, res) => {
    const currentPin = String(req.body?.currentPin ?? '').trim()
    const newPin = String(req.body?.newPin ?? '').trim()

    if (!currentPin || !safeEqualStr(currentPin, getAdminPin())) {
      return res.status(401).json({ error: 'invalid_pin' })
    }
    if (newPin === DEFAULT_PIN) {
      return res.status(400).json({ error: 'pin_is_default' })
    }
    try {
      setAdminPin(newPin)
    } catch (err) {
      if (err?.code === 'pin_too_short') {
        return res.status(400).json({ error: 'pin_too_short' })
      }
      console.error('[adminAuth] change-pin', err)
      return res.status(500).json({ error: 'change_failed' })
    }
    const nextToken = signAdminToken({ role: 'admin' })
    return res.json({
      ok: true,
      token: nextToken,
      expiresInMs: TOKEN_TTL_MS,
      isDefaultPin: isDefaultAdminPin(),
    })
  })

  app.get('/api/admin/session', requireAdmin, (_req, res) => {
    return res.json({ ok: true, isDefaultPin: isDefaultAdminPin() })
  })
}
