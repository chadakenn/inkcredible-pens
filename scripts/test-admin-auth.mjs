import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = mkdtempSync(path.join(tmpdir(), 'inkcredible-admin-auth-'))
const serverDir = path.join(root, 'server')
await import('node:fs/promises').then(({ mkdir }) => mkdir(serverDir, { recursive: true }))
copyFileSync(new URL('../server/adminAuth.mjs', import.meta.url), path.join(serverDir, 'adminAuth.mjs'))
copyFileSync(new URL('../server/security.mjs', import.meta.url), path.join(serverDir, 'security.mjs'))

process.env.ADMIN_PIN = 'setup-code-for-test'
process.env.ADMIN_SESSION_SECRET = 'test-session-secret-long-enough'
process.env.NODE_ENV = 'development'

const auth = await import(`${pathToFileURL(path.join(serverDir, 'adminAuth.mjs')).href}?test=${Date.now()}`)
const routes = new Map()
const app = {
  get(pathname, ...handlers) { routes.set(`GET ${pathname}`, handlers) },
  post(pathname, ...handlers) { routes.set(`POST ${pathname}`, handlers) },
}
auth.mountAdminAuth(app)

function invoke(method, pathname, body = {}, headers = {}) {
  const handlers = routes.get(`${method} ${pathname}`)
  assert.ok(handlers, `missing route ${method} ${pathname}`)
  return new Promise((resolve, reject) => {
    const req = { body, headers, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } }
    const res = {
      statusCode: 200,
      headers: {},
      status(code) { this.statusCode = code; return this },
      setHeader(key, value) { this.headers[key] = value },
      json(payload) { resolve({ status: this.statusCode, payload }); return this },
    }
    let index = 0
    const next = (error) => {
      if (error) return reject(error)
      const handler = handlers[index++]
      if (!handler) return reject(new Error('route_did_not_respond'))
      try { handler(req, res, next) } catch (err) { reject(err) }
    }
    next()
  })
}

const setup = await invoke('POST', '/api/admin/setup', {
  pin: process.env.ADMIN_PIN,
  username: 'chad',
  displayName: 'Chad',
  password: 'correct-horse-battery',
})
assert.equal(setup.status, 201)
assert.ok(setup.payload.token)

const usersFile = path.join(root, 'data/admin/users.json')
assert.equal(statSync(usersFile).mode & 0o777, 0o600)
assert.equal(JSON.parse(readFileSync(usersFile, 'utf8')).users[0].username, 'chad')

assert.equal((await invoke('POST', '/api/admin/login', { username: 'chad', password: 'wrong-password' })).status, 401)
const login = await invoke('POST', '/api/admin/login', { username: 'chad', password: 'correct-horse-battery' })
assert.equal(login.status, 200)
assert.ok(auth.verifyAdminToken(login.payload.token))

const session = await invoke('GET', '/api/admin/session', {}, { authorization: `Bearer ${login.payload.token}` })
assert.equal(session.status, 200)
assert.equal(session.payload.user.username, 'chad')

console.log('admin account setup/login/session regression test passed')
