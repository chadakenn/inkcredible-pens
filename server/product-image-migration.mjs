import { promises as fs } from 'node:fs'
import dns from 'node:dns/promises'
import net from 'node:net'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { requireAdmin } from './adminAuth.mjs'
import { CATALOG_DIR, CATALOG_FILE, readProducts, writeProducts } from './catalog.mjs'
import { saveProductImageBuffer } from './uploads.mjs'

const JOB_FILE = path.join(CATALOG_DIR, 'image-migration.json')
const MAX_BYTES = 8 * 1024 * 1024
let running = false

const localImage = (url) => /^\/uploads\/products\//.test(String(url || ''))
const externalImage = (url) => /^https?:\/\//i.test(String(url || ''))

function isPrivateIp(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  }
  return net.isIPv6(address) && (address === '::1' || address === '::' || /^f[cd]/i.test(address) || /^fe[89ab]/i.test(address))
}

async function assertPublicUrl(raw) {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid_url')
  const records = await dns.lookup(url.hostname, { all: true })
  if (!records.length || records.some((record) => isPrivateIp(record.address))) throw new Error('blocked_host')
  return url
}

async function downloadImage(raw, redirects = 0) {
  if (redirects > 4) throw new Error('too_many_redirects')
  const url = await assertPublicUrl(raw)
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'Inkcredible-Image-Migrator/1.0', accept: 'image/*' } })
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (!location) throw new Error('bad_redirect')
    return downloadImage(new URL(location, url).toString(), redirects + 1)
  }
  if (!response.ok) throw new Error(`http_${response.status}`)
  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > MAX_BYTES) throw new Error('file_too_large')
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.length || buffer.length > MAX_BYTES) throw new Error('file_too_large')
  return buffer
}

async function saveJob(job) {
  await fs.mkdir(CATALOG_DIR, { recursive: true })
  await fs.writeFile(`${JOB_FILE}.tmp`, JSON.stringify(job, null, 2))
  await fs.rename(`${JOB_FILE}.tmp`, JOB_FILE)
}

export async function readMigrationStatus() {
  try { return JSON.parse(await fs.readFile(JOB_FILE, 'utf8')) } catch { return null }
}

async function currentMigrationStatus() {
  const status = await readMigrationStatus()
  if (status?.status === 'running' && !running) {
    const interrupted = {
      ...status,
      status: 'interrupted',
      finishedAt: status.finishedAt || new Date().toISOString(),
    }
    await saveJob(interrupted)
    return interrupted
  }
  return status
}

export function migrationCandidates() {
  return readProducts().filter((product) => externalImage(product.imageUrl))
}

export async function runImageMigration({ limit = 10 } = {}) {
  if (running) throw new Error('migration_running')
  running = true
  const products = readProducts()
  const queue = products.filter((product) => externalImage(product.imageUrl)).slice(0, Math.max(1, Math.min(1000, Number(limit) || 10)))
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  const backupFile = path.join(CATALOG_DIR, `products.pre-image-migration.${stamp}.json`)
  await fs.copyFile(CATALOG_FILE, backupFile)
  const job = { id: randomUUID(), status: 'running', total: queue.length, completed: 0, migrated: 0, failed: 0, skipped: 0, startedAt: new Date().toISOString(), finishedAt: null, backupFile: path.basename(backupFile), errors: [] }
  await saveJob(job)
  try {
    for (const candidate of queue) {
      const index = products.findIndex((product) => product.id === candidate.id)
      if (index < 0 || localImage(products[index].imageUrl) || products[index].imageUrl !== candidate.imageUrl) {
        job.skipped += 1
      } else {
        try {
          const buffer = await downloadImage(candidate.imageUrl)
          const saved = saveProductImageBuffer(buffer)
          products[index] = { ...products[index], imageUrl: saved.url }
          writeProducts(products)
          job.migrated += 1
        } catch (error) {
          job.failed += 1
          job.errors.push({ productId: candidate.id, name: candidate.name, url: candidate.imageUrl, error: error instanceof Error ? error.message : 'download_failed' })
          job.errors = job.errors.slice(-50)
        }
      }
      job.completed += 1
      await saveJob(job)
    }
    job.status = job.failed ? 'completed_with_errors' : 'completed'
  } catch (error) {
    job.status = 'failed'
    job.errors.push({ error: error instanceof Error ? error.message : 'migration_failed' })
  } finally {
    job.finishedAt = new Date().toISOString()
    running = false
    await saveJob(job)
  }
  return job
}

export function mountProductImageMigration(app) {
  app.get('/api/admin/product-image-migration', requireAdmin, async (_req, res) => {
    const candidates = migrationCandidates()
    res.json({ status: await currentMigrationStatus(), remaining: candidates.length, preview: candidates.slice(0, 10).map(({ id, name, imageUrl }) => ({ id, name, imageUrl })) })
  })
  app.post('/api/admin/product-image-migration', requireAdmin, (req, res) => {
    if (running) return res.status(409).json({ error: 'migration_running' })
    const limit = Math.max(1, Math.min(1000, Number(req.body?.limit) || 10))
    void runImageMigration({ limit })
    return res.status(202).json({ ok: true, limit })
  })
}
