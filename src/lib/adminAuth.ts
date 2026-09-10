/** Server-backed Store Manager accounts (Bearer token in sessionStorage). */

export const UNLOCK_KEY = 'inkcredible-admin-unlocked'
export const TOKEN_KEY = 'inkcredible-admin-token'

export interface AdminUser {
  id: string
  username: string
  displayName: string
  role: 'admin'
}

export class AdminAuthError extends Error {
  status: number
  code: string

  constructor(status: number, code: string) {
    super(code)
    this.name = 'AdminAuthError'
    this.status = status
    this.code = code
  }
}

export function readAdminToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function writeAdminToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore */ }
}

export function adminAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers = { ...(extra || {}) }
  const token = readAdminToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export function readAdminUnlocked(): boolean {
  try { return Boolean(readAdminToken()) && sessionStorage.getItem(UNLOCK_KEY) === '1' } catch { return false }
}

export function writeAdminUnlocked(on: boolean) {
  try {
    if (on) sessionStorage.setItem(UNLOCK_KEY, '1')
    else {
      sessionStorage.removeItem(UNLOCK_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
    }
  } catch { /* ignore */ }
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new AdminAuthError(response.status, data.error || `request_failed_${response.status}`)
  return data
}

function saveSession(data: { token: string; user: AdminUser }) {
  writeAdminToken(data.token)
  writeAdminUnlocked(true)
  return data.user
}

export async function fetchAdminSetupStatus(): Promise<boolean> {
  const data = await jsonRequest<{ needsSetup: boolean }>('/api/admin/setup-status')
  return Boolean(data.needsSetup)
}

export async function setupAdminAccount(input: { pin: string; username: string; displayName: string; password: string }): Promise<AdminUser> {
  const data = await jsonRequest<{ token: string; user: AdminUser }>('/api/admin/setup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })
  return saveSession(data)
}

export async function loginAdmin(username: string, password: string): Promise<AdminUser> {
  const data = await jsonRequest<{ token: string; user: AdminUser }>('/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  })
  return saveSession(data)
}

export async function fetchAdminSession(): Promise<{ ok: boolean; user: AdminUser | null }> {
  if (!readAdminToken()) return { ok: false, user: null }
  try {
    const data = await jsonRequest<{ user: AdminUser }>('/api/admin/session', { headers: adminAuthHeaders() })
    return { ok: true, user: data.user }
  } catch {
    writeAdminUnlocked(false)
    return { ok: false, user: null }
  }
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const data = await jsonRequest<{ users: AdminUser[] }>('/api/admin/users', { headers: adminAuthHeaders() })
  return data.users
}

export async function addAdminUser(input: { username: string; displayName: string; password: string }): Promise<AdminUser> {
  const data = await jsonRequest<{ user: AdminUser }>('/api/admin/users', {
    method: 'POST', headers: adminAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(input),
  })
  return data.user
}

export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<AdminUser> {
  const data = await jsonRequest<{ token: string; user: AdminUser }>('/api/admin/change-password', {
    method: 'POST', headers: adminAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ currentPassword, newPassword }),
  })
  return saveSession(data)
}
