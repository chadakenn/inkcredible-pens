import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { writeJsonAtomic } from '../server/security.mjs'

const dir = mkdtempSync(path.join(tmpdir(), 'inkcredible-secure-json-'))
const file = path.join(dir, 'users.json')

writeJsonAtomic(file, { users: [] }, { mode: 0o600 })
assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { users: [] })
assert.equal(statSync(file).mode & 0o777, 0o600)

writeJsonAtomic(file, { users: [{ username: 'test' }] }, { mode: 0o600 })
assert.equal(statSync(file).mode & 0o777, 0o600)
assert.equal(statSync(`${file}.bak`).mode & 0o777, 0o600)

console.log('secure JSON permissions regression test passed')
