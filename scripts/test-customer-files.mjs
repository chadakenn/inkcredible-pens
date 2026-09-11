import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

const archiveRoot = mkdtempSync(path.join(tmpdir(), 'inkcredible-customer-files-'))
process.env.CUSTOMER_FILES_DIR = archiveRoot
const sourceId = `${randomUUID()}.png`
const sourceDir = path.resolve('uploads/custom')
const source = path.join(sourceDir, sourceId)
mkdirSync(sourceDir, { recursive: true })
writeFileSync(source, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))

try {
  const { archivePaidOrderArtwork } = await import('../server/customer-files.mjs')
  const items = archivePaidOrderArtwork([
    { name: 'Custom Freshie', custom: { artworkId: sourceId, artworkFileName: 'Family Photo.png', artworkUrl: `/api/admin/uploads/custom/${sourceId}` } },
  ], { displayCode: 'IP-260911-1234', createdAt: '2026-09-11T12:00:00.000Z', customerName: 'Chad Kennedy' })
  assert.match(items[0].custom.artworkUrl, /^\/api\/admin\/customer-files\/2026\/09\/Chad-Kennedy_IP-260911-1234\//)
  assert.match(items[0].custom.archivedArtworkPath, /^2026\/09\/Chad-Kennedy_IP-260911-1234\//)
  assert.equal(items[0].custom.artworkId, undefined)
  assert.ok(existsSync(path.join(archiveRoot, items[0].custom.archivedArtworkPath)))
} finally {
  rmSync(source, { force: true })
  rmSync(archiveRoot, { recursive: true, force: true })
}

console.log('paid-order customer artwork archive regression test passed')
