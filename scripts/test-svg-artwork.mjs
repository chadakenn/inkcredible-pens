import assert from 'node:assert/strict'
import sharp from 'sharp'
import { sanitizeSvgBuffer, svgPreviewPng } from '../server/svg-artwork.mjs'

const malicious = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="200" height="100">
    <script>alert(1)</script>
    <foreignObject><div xmlns="http://www.w3.org/1999/xhtml">bad</div></foreignObject>
    <image href="https://attacker.example/pixel.png" width="10" height="10" />
    <rect width="200" height="100" fill="#22d3ee" onclick="alert(2)" />
  </svg>
`)

const sanitized = sanitizeSvgBuffer(malicious)
const text = sanitized.toString('utf8')
assert.match(text, /<svg/i)
assert.doesNotMatch(text, /<script|foreignObject|onclick|attacker\.example/i)

const preview = await svgPreviewPng(sanitized)
const metadata = await sharp(preview).metadata()
assert.equal(metadata.format, 'png')
assert.ok((metadata.width || 0) <= 1200)
assert.ok((metadata.height || 0) <= 1200)

assert.throws(
  () => sanitizeSvgBuffer(Buffer.from('<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>')),
  /unsafe_svg/,
)

console.log('SVG sanitization and PNG preview regression test passed')
