/** Individual Store Manager accounts with scrypt password hashes and expiring HMAC sessions. */
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRateLimiter, isProductionHardening as _isProductionHardening, readJsonFile, writeJsonAtomic } from './security.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ADMIN_DIR = path.resolve(__dirname, '../data/admin')
const PIN_FILE = path.join(ADMIN_DIR, 'pin.json')
const USERS_FILE = path.join(ADMIN_DIR, 'users.json')
const SECRET_FILE = path.join(ADMIN_DIR, 'session-secret.json')
const DEFAULT_PIN = '1234'
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12
const DUMMY_SALT = '8f8d41fcbfb95a7ca94aa9abf71e9c2f'
const DUMMY_HASH = scryptSync('not-the-password', DUMMY_SALT, 64)

mkdirSync(ADMIN_DIR, { recursive: true })

function safeEqual(a, b) {
  const ba = Buffer.isBuffer(a) ? a : Buffer.from(String(a), 'utf8')
  const bb = Buffer.isBuffer(b) ? b : Buffer.from(String(b), 'utf8')
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

function normalizedUsername(value) { return String(value || '').trim().toLowerCase() }

function validateAccount(username, displayName, password) {
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw Object.assign(new Error('invalid_username'), { code: 'invalid_username' })
  if (String(displayName || '').trim().length < 2) throw Object.assign(new Error('invalid_display_name'), { code: 'invalid_display_name' })
  if (String(password || '').length < 10) throw Object.assign(new Error('password_too_short'), { code: 'password_too_short' })
  if (String(password || '').length > 256) throw Object.assign(new Error('password_too_long'), { code: 'password_too_long' })
}

function readUsers() {
  const data = readJsonFile(USERS_FILE)
  if (data == null) return []
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.users)) return data.users
  throw new Error('invalid_admin_users_file')
}

function writeUsers(users) { writeJsonAtomic(USERS_FILE, { version: 1, users }, { keepBackups: 5 }) }
function publicUser(user) { return { id: user.id, username: user.username, displayName: user.displayName, role: user.role || 'admin' } }

function passwordMatches(user, password) {
  const salt = user?.passwordSalt || DUMMY_SALT
  const expected = user?.passwordHash ? Buffer.from(user.passwordHash, 'hex') : DUMMY_HASH
  let actual
  try { actual = scryptSync(String(password || ''), salt, 64) } catch { actual = Buffer.alloc(64) }
  return Boolean(user) && safeEqual(actual, expected)
}

function createUserRecord({ username, displayName, password }) {
  const cleanUsername = normalizedUsername(username)
  const cleanName = String(displayName || '').trim()
  validateAccount(cleanUsername, cleanName, password)
  const salt = randomBytes(16).toString('hex')
  const now = new Date().toISOString()
  return {
    id: randomUUID(), username: cleanUsername, displayName: cleanName, role: 'admin',
    passwordSalt: salt, passwordHash: scryptSync(String(password), salt, 64).toString('hex'),
    sessionVersion: 1, createdAt: now, updatedAt: now,
  }
}

function addAdminUser(input) {
  const users = readUsers()
  const next = createUserRecord(input)
  if (users.some((user) => user.username === next.username)) throw Object.assign(new Error('username_exists'), { code: 'username_exists' })
  users.push(next)
  writeUsers(users)
  return next
}

function getAdminPin() {
  try {
    if (existsSync(PIN_FILE)) {
      const data = JSON.parse(readFileSync(PIN_FILE, 'utf8'))
      if (typeof data?.pin === 'string' && data.pin.trim().length >= 4) return data.pin.trim()
    }
  } catch (error) { console.error('[adminAuth] pin read failed', error) }
  const envPin = String(process.env.ADMIN_PIN || '').trim()
  return envPin.length >= 4 ? envPin : DEFAULT_PIN
}

export function assertAdminPinSafeToBoot() {
  if (readUsers().length > 0) return
  const pin = getAdminPin()
  if (_isProductionHardening() && (!pin || pin === DEFAULT_PIN)) {
    console.error('[adminAuth] FATAL: create Store Manager accounts first, or set a strong ADMIN_PIN for one-time account setup.')
    process.exit(1)
  }
  console.warn('[adminAuth] Store Manager account setup is pending; the existing ADMIN_PIN is setup-only.')
}

function loadOrCreateSessionSecret() {
  if (typeof process.env.ADMIN_SESSION_SECRET === 'string' && process.env.ADMIN_SESSION_SECRET.length >= 16) return process.env.ADMIN_SESSION_SECRET
  try {
    if (existsSync(SECRET_FILE)) {
      const data = JSON.parse(readFileSync(SECRET_FILE, 'utf8'))
      if (typeof data?.secret === 'string' && data.secret.length >= 16) return data.secret
    }
  } catch (error) { console.error('[adminAuth] secret read failed', error) }
  const secret = randomBytes(32).toString('hex')
  writeFileSync(SECRET_FILE, JSON.stringify({ secret, createdAt: new Date().toISOString() }, null, 2), 'utf8')
  console.log('[adminAuth] generated session secret →', SECRET_FILE)
  return secret
}

const sessionSecret = loadOrCreateSessionSecret()
const b64url = (value) => Buffer.from(value).toString('base64url')

export function signAdminToken(user) {
  const body = { sub: user.id, username: user.username, displayName: user.displayName, role: 'admin', sv: user.sessionVersion || 1, iat: Date.now(), exp: Date.now() + TOKEN_TTL_MS }
  const payload = b64url(JSON.stringify(body))
  const signature = createHmac('sha256', sessionSecret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyAdminToken(token) {
  if (typeof token !== 'string') return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = createHmac('sha256', sessionSecret).update(payload).digest('base64url')
  if (!safeEqual(signature, expected)) return null
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!body?.sub || typeof body.exp !== 'number' || Date.now() > body.exp) return null
    const user = readUsers().find((row) => row.id === body.sub)
    if (!user || (user.sessionVersion || 1) !== body.sv) return null
    return { ...body, user: publicUser(user) }
  } catch { return null }
}

function extractBearer(req) {
  const match = /^Bearer\s+(.+)$/i.exec(String(req.headers?.authorization || '').trim())
  return match ? match[1].trim() : null
}

export function requireAdmin(req, res, next) {
  const payload = verifyAdminToken(extractBearer(req))
  if (!payload) return res.status(401).json({ error: 'unauthorized' })
  req.admin = payload
  return next()
}

function authResponse(user) { return { token: signAdminToken(user), expiresInMs: TOKEN_TTL_MS, user: publicUser(user) } }
function accountError(res, error) {
  const code = error?.code || 'account_failed'
  return res.status(code === 'username_exists' ? 409 : 400).json({ error: code })
}

export function mountAdminAuth(app) {
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, name: 'admin-login' })
  const accountLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, name: 'admin-account' })

  app.get('/api/admin/setup-status', (_req, res) => res.json({ needsSetup: readUsers().length === 0 }))

  app.post('/api/admin/setup', accountLimiter, (req, res) => {
    if (readUsers().length > 0) return res.status(409).json({ error: 'setup_complete' })
    if (!safeEqual(String(req.body?.pin || '').trim(), getAdminPin())) return res.status(401).json({ error: 'invalid_pin' })
    try {
      const user = addAdminUser(req.body || {})
      return res.status(201).json(authResponse(user))
    } catch (error) { return accountError(res, error) }
  })

  app.post('/api/admin/login', loginLimiter, (req, res) => {
    const username = normalizedUsername(req.body?.username)
    const user = readUsers().find((row) => row.username === username)
    const ok = passwordMatches(user, req.body?.password)
    const delay = 200 + Math.floor(Math.random() * 200)
    setTimeout(() => ok ? res.json(authResponse(user)) : res.status(401).json({ error: 'invalid_credentials' }), delay)
  })

  app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ ok: true, user: req.admin.user }))
  app.get('/api/admin/users', requireAdmin, (_req, res) => res.json({ users: readUsers().map(publicUser) }))

  app.post('/api/admin/users', requireAdmin, accountLimiter, (req, res) => {
    try { return res.status(201).json({ user: publicUser(addAdminUser(req.body || {})) }) }
    catch (error) { return accountError(res, error) }
  })

  app.post('/api/admin/change-password', requireAdmin, accountLimiter, (req, res) => {
    const users = readUsers()
    const index = users.findIndex((user) => user.id === req.admin.sub)
    if (index < 0 || !passwordMatches(users[index], req.body?.currentPassword)) return res.status(401).json({ error: 'invalid_password' })
    const nextPassword = String(req.body?.newPassword || '')
    try { validateAccount(users[index].username, users[index].displayName, nextPassword) }
    catch (error) { return accountError(res, error) }
    const salt = randomBytes(16).toString('hex')
    users[index] = { ...users[index], passwordSalt: salt, passwordHash: scryptSync(nextPassword, salt, 64).toString('hex'), sessionVersion: (users[index].sessionVersion || 1) + 1, updatedAt: new Date().toISOString() }
    writeUsers(users)
    return res.json({ ok: true, ...authResponse(users[index]) })
  })
}
