import assert from 'node:assert/strict'
import { existsSync, unlinkSync } from 'node:fs'
import { cleanupExpiredSocialUploads, saveSocialImageBuffer } from '../server/uploads.mjs'

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

const saved = saveSocialImageBuffer(onePixelPng)
try {
  assert.equal(saved.mime, 'image/png')
  assert.match(saved.url, /^\/uploads\/social\/[a-f0-9-]{36}\.png$/)
  assert.equal(existsSync(saved.path), true)
  assert.throws(() => saveSocialImageBuffer(Buffer.from('not an image')), /invalid_type/)
  assert.equal(cleanupExpiredSocialUploads(Number.MAX_SAFE_INTEGER).removed, 0)
  console.log('social upload regression test passed')
} finally {
  if (existsSync(saved.path)) unlinkSync(saved.path)
}
