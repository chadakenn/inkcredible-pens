import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { referencedDraftProductUploadFilenames } from '../server/uploads.mjs'

const dir = mkdtempSync(path.join(tmpdir(), 'inkcredible-draft-refs-'))
try {
  const draftId = '11111111-1111-4111-8111-111111111111'
  const imageName = '22222222-2222-4222-8222-222222222222.jpg'
  writeFileSync(
    path.join(dir, `${draftId}.json`),
    JSON.stringify({ imageUrl: `/uploads/products/${imageName}` }),
  )
  writeFileSync(path.join(dir, 'not-a-draft.json'), JSON.stringify({
    imageUrl: '/uploads/products/33333333-3333-4333-8333-333333333333.jpg',
  }))

  const refs = referencedDraftProductUploadFilenames(dir)
  assert.deepEqual([...refs], [imageName])
  console.log('product upload draft-retention regression test passed')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
