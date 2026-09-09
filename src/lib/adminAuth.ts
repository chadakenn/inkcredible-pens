export const DEMO_PIN = '1234'
export const UNLOCK_KEY = 'inkcredible-admin-unlocked'
export const PIN_KEY = 'inkcredible-admin-pin'

export function readAdminPin(): string {
  try {
    const stored = localStorage.getItem(PIN_KEY)
    if (typeof stored === 'string' && stored.length >= 4) return stored
  } catch {
    /* ignore */
  }
  return DEMO_PIN
}

export function writeAdminPin(pin: string) {
  const next = String(pin ?? '').trim()
  if (next.length < 4) {
    throw new Error('pin_too_short')
  }
  try {
    localStorage.setItem(PIN_KEY, next)
  } catch {
    /* ignore */
  }
}

export function verifyAdminPin(input: string): boolean {
  return String(input ?? '').trim() === readAdminPin()
}

export function isDefaultAdminPin(): boolean {
  return readAdminPin() === DEMO_PIN
}

export function readAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function writeAdminUnlocked(on: boolean) {
  try {
    if (on) sessionStorage.setItem(UNLOCK_KEY, '1')
    else sessionStorage.removeItem(UNLOCK_KEY)
  } catch {
    /* ignore */
  }
}
