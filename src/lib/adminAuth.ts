/** Server-backed admin session (Bearer token in sessionStorage). */

export const DEMO_PIN = '1234'
export const UNLOCK_KEY = 'inkcredible-admin-unlocked'
export const TOKEN_KEY = 'inkcredible-admin-token'
/** @deprecated local PIN storage — no longer authoritative */
export const PIN_KEY = 'inkcredible-admin-pin'

export class AdminAuthError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'AdminAuthError'
    this.status = status
    this.code = code
  }
}

export function readAdminToken(): string | null {
  try {
    const t = sessionStorage.getItem(TOKEN_KEY)
    return typeof t === 'string' && t.length > 10 ? t : null
  } catch {
    return null
  }
}

export function writeAdminToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function adminAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) }
  const token = readAdminToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export function readAdminUnlocked(): boolean {
  try {
    if (!readAdminToken()) return false
    return sessionStorage.getItem(UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function writeAdminUnlocked(on: boolean) {
  try {
    if (on) sessionStorage.setItem(UNLOCK_KEY, '1')
    else {
      sessionStorage.removeItem(UNLOCK_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
    }
  } catch {
    /* ignore */
  }
}

export async function loginAdmin(pin: string): Promise<{
  token: string
  isDefaultPin: boolean
}> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: String(pin ?? '').trim() }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    token?: string
    isDefaultPin?: boolean
    error?: string
  }
  if (!res.ok || !data.token) {
    throw new AdminAuthError(
      data.error || `login_failed_${res.status}`,
      res.status,
      data.error || 'login_failed',
    )
  }
  writeAdminToken(data.token)
  writeAdminUnlocked(true)
  return { token: data.token, isDefaultPin: Boolean(data.isDefaultPin) }
}

export async function changeAdminPin(
  currentPin: string,
  newPin: string,
): Promise<{ isDefaultPin: boolean }> {
  const res = await fetch('/api/admin/change-pin', {
    method: 'POST',
    headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      currentPin: String(currentPin ?? '').trim(),
      newPin: String(newPin ?? '').trim(),
    }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    token?: string
    isDefaultPin?: boolean
    error?: string
  }
  if (!res.ok) {
    throw new AdminAuthError(
      data.error || `change_failed_${res.status}`,
      res.status,
      data.error || 'change_failed',
    )
  }
  if (data.token) writeAdminToken(data.token)
  return { isDefaultPin: Boolean(data.isDefaultPin) }
}

export async function fetchAdminSession(): Promise<{ ok: boolean; isDefaultPin: boolean }> {
  const token = readAdminToken()
  if (!token) return { ok: false, isDefaultPin: true }
  const res = await fetch('/api/admin/session', {
    headers: adminAuthHeaders(),
  })
  if (!res.ok) {
    writeAdminUnlocked(false)
    return { ok: false, isDefaultPin: true }
  }
  const data = (await res.json().catch(() => ({}))) as { isDefaultPin?: boolean }
  return { ok: true, isDefaultPin: Boolean(data.isDefaultPin) }
}

/** @deprecated Use loginAdmin — kept so old imports don't break during transition. */
export function verifyAdminPin(_input: string): boolean {
  return false
}

/** @deprecated */
export function readAdminPin(): string {
  return DEMO_PIN
}

/** @deprecated */
export function writeAdminPin(_pin: string) {
  throw new Error('use_changeAdminPin')
}

/** @deprecated Prefer session isDefaultPin from server. */
export function isDefaultAdminPin(): boolean {
  return true
}
