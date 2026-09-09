/**
 * Pending Stripe checkouts — written on session create, completed by webhook.
 * data/checkouts/<id>.json
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CorruptJsonError, readJsonFile, writeJsonAtomic } from './security.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CHECKOUTS_DIR = path.resolve(__dirname, '../data/checkouts')

mkdirSync(CHECKOUTS_DIR, { recursive: true })

function fileFor(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '')
  if (!safe) throw new Error('invalid_checkout_id')
  return path.join(CHECKOUTS_DIR, `${safe}.json`)
}

export function newCheckoutId() {
  return `chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function savePendingCheckout(checkout) {
  const id = checkout.id || newCheckoutId()
  const record = {
    ...checkout,
    id,
    status: checkout.status || 'pending',
    createdAt: checkout.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const dest = fileFor(id)
  writeJsonAtomic(dest, record, { keepBackups: 3 })
  return record
}

export function readCheckout(id) {
  const dest = fileFor(id)
  try {
    return readJsonFile(dest)
  } catch (err) {
    if (err instanceof CorruptJsonError || err?.code === 'corrupt_json') {
      console.error('[checkouts] CORRUPT checkout file', id, err)
      throw err
    }
    throw err
  }
}

export function findCheckoutByStripeSession(sessionId) {
  const sid = String(sessionId || '')
  if (!sid) return null
  try {
    const files = readdirSync(CHECKOUTS_DIR).filter((f) => f.endsWith('.json'))
    for (const f of files) {
      try {
        const data = readJsonFile(path.join(CHECKOUTS_DIR, f))
        if (data?.stripeSessionId === sid) return data
      } catch (err) {
        console.error('[checkouts] CORRUPT while scanning', f, err)
        /* skip corrupt file during scan */
      }
    }
  } catch (err) {
    console.error('[checkouts] scan failed', err)
  }
  return null
}

export function markCheckoutCompleted(id, extra = {}) {
  const existing = readCheckout(id)
  if (!existing) return null
  return savePendingCheckout({
    ...existing,
    ...extra,
    id,
    status: 'completed',
    completedAt: new Date().toISOString(),
  })
}

export function attachStripeSession(id, stripeSessionId) {
  const existing = readCheckout(id)
  if (!existing) return null
  return savePendingCheckout({
    ...existing,
    id,
    stripeSessionId,
  })
}

export function deleteCheckout(id) {
  const dest = fileFor(id)
  if (existsSync(dest)) unlinkSync(dest)
}


/**
 * Delete abandoned pending checkouts older than maxAgeMs (default 7 days).
 * Completed checkouts older than maxAgeMs are also removed (order already on disk).
 * @returns {{ removed: number, scanned: number }}
 */
export function cleanupAbandonedCheckouts(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
  const now = Date.now()
  let removed = 0
  let scanned = 0
  try {
    const files = readdirSync(CHECKOUTS_DIR).filter((f) => f.endsWith('.json'))
    for (const f of files) {
      scanned += 1
      const full = path.join(CHECKOUTS_DIR, f)
      try {
        const data = readJsonFile(full)
        const created = Date.parse(data?.createdAt || data?.updatedAt || 0)
        if (!Number.isFinite(created)) continue
        if (now - created < maxAgeMs) continue
        unlinkSync(full)
        // also drop rolling backups for this file
        for (const bak of readdirSync(CHECKOUTS_DIR).filter(
          (x) => x.startsWith(`${f}.`) && x.endsWith('.bak'),
        )) {
          try {
            unlinkSync(path.join(CHECKOUTS_DIR, bak))
          } catch {
            /* ignore */
          }
        }
        if (existsSync(`${full}.bak`)) {
          try {
            unlinkSync(`${full}.bak`)
          } catch {
            /* ignore */
          }
        }
        removed += 1
      } catch (err) {
        console.error('[checkouts] cleanup skip', f, err)
      }
    }
  } catch (err) {
    console.error('[checkouts] cleanup failed', err)
  }
  return { removed, scanned }
}
