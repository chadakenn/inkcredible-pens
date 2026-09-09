/**
 * Pending Stripe checkouts — written on session create, completed by webhook.
 * data/checkouts/<id>.json
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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
  const tmp = `${dest}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(tmp, JSON.stringify(record, null, 2), 'utf8')
  renameSync(tmp, dest)
  return record
}

export function readCheckout(id) {
  const dest = fileFor(id)
  if (!existsSync(dest)) return null
  try {
    return JSON.parse(readFileSync(dest, 'utf8'))
  } catch (err) {
    console.error('[checkouts] read failed', id, err)
    return null
  }
}

export function findCheckoutByStripeSession(sessionId) {
  const sid = String(sessionId || '')
  if (!sid) return null
  try {
    const files = readdirSync(CHECKOUTS_DIR).filter((f) => f.endsWith('.json'))
    for (const f of files) {
      try {
        const data = JSON.parse(readFileSync(path.join(CHECKOUTS_DIR, f), 'utf8'))
        if (data?.stripeSessionId === sid) return data
      } catch {
        /* skip */
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
