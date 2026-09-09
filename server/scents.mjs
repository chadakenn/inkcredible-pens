/**
 * Freshie scents list (JSON on disk) — mounted on Express (4242).
 * Live: data/catalog/scents.json (gitignored)
 * Seed: server/scents-seed.json (committed)
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAdmin } from './adminAuth.mjs'
import {
  CorruptJsonError,
  readJsonFile,
  writeJsonAtomic,
} from './security.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SCENTS_DIR = path.resolve(__dirname, '../data/catalog')
export const SCENTS_FILE = path.join(SCENTS_DIR, 'scents.json')
export const SCENTS_SEED_FILE = path.join(__dirname, 'scents-seed.json')

mkdirSync(SCENTS_DIR, { recursive: true })

function normalize(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function loadSeedScents() {
  if (!existsSync(SCENTS_SEED_FILE)) {
    console.warn('[scents] seed file missing:', SCENTS_SEED_FILE)
    return []
  }
  try {
    const raw = readFileSync(SCENTS_SEED_FILE, 'utf8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.map(normalize).filter(Boolean)
  } catch (err) {
    console.error('[scents] seed read failed', err)
    return []
  }
}

function ensureScentsFile() {
  if (existsSync(SCENTS_FILE)) return
  const seed = loadSeedScents()
  try {
    if (existsSync(SCENTS_SEED_FILE) && seed.length > 0) {
      copyFileSync(SCENTS_SEED_FILE, SCENTS_FILE)
      console.log(`[scents] seeded ${seed.length} scents → ${SCENTS_FILE}`)
      return
    }
  } catch (err) {
    console.error('[scents] seed copy failed', err)
  }
  writeAtomic(seed)
}

function readScents() {
  ensureScentsFile()
  const data = readJsonFile(SCENTS_FILE)
  if (data == null) return []
  if (Array.isArray(data)) {
    return data.map(normalize).filter(Boolean)
  }
  if (data && Array.isArray(data.scents)) {
    return data.scents.map(normalize).filter(Boolean)
  }
  console.error('[scents] unexpected JSON shape — refusing empty fallback')
  throw new CorruptJsonError(SCENTS_FILE, new Error('unexpected_shape'))
}

function writeAtomic(scents) {
  writeJsonAtomic(SCENTS_FILE, scents, { keepBackups: 5 })
}

function handleCorrupt(res, err) {
  if (err instanceof CorruptJsonError || err?.code === 'corrupt_json') {
    console.error('[scents] CORRUPT scents.json — returning 500')
    return res.status(500).json({ error: 'corrupt_scents', path: SCENTS_FILE })
  }
  throw err
}

/**
 * @param {import('express').Express} app
 */
export function mountScents(app) {
  ensureScentsFile()

  app.get('/api/scents', (_req, res) => {
    try {
      const scents = readScents()
      return res.json({ scents })
    } catch (err) {
      return handleCorrupt(res, err)
    }
  })

  app.post('/api/scents', requireAdmin, (req, res) => {
    const name = normalize(req.body?.name ?? req.body?.scent)
    if (!name) return res.status(400).json({ error: 'invalid_name' })
    let scents
    try {
      scents = readScents()
    } catch (err) {
      return handleCorrupt(res, err)
    }
    if (scents.some((s) => s.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'duplicate_scent', scents })
    }
    scents.push(name)
    writeAtomic(scents)
    return res.status(201).json({ scents, scent: name })
  })

  app.patch('/api/scents', requireAdmin, (req, res) => {
    const from = normalize(req.body?.from)
    const to = normalize(req.body?.to)
    if (!from || !to) return res.status(400).json({ error: 'invalid_rename' })
    let scents
    try {
      scents = readScents()
    } catch (err) {
      return handleCorrupt(res, err)
    }
    if (!scents.includes(from)) {
      return res.status(404).json({ error: 'not_found' })
    }
    if (
      scents.some((s) => s !== from && s.toLowerCase() === to.toLowerCase())
    ) {
      return res.status(409).json({ error: 'duplicate_scent' })
    }
    const next = scents.map((s) => (s === from ? to : s))
    writeAtomic(next)
    return res.json({ scents: next, scent: to })
  })

  app.delete('/api/scents/:name', requireAdmin, (req, res) => {
    const name = normalize(decodeURIComponent(String(req.params.name || '')))
    if (!name) return res.status(400).json({ error: 'invalid_name' })
    let scents
    try {
      scents = readScents()
    } catch (err) {
      return handleCorrupt(res, err)
    }
    const next = scents.filter((s) => s !== name)
    if (next.length === scents.length) {
      return res.status(404).json({ error: 'not_found' })
    }
    writeAtomic(next)
    return res.json({ ok: true, scents: next })
  })

  app.post('/api/scents/clear', requireAdmin, (_req, res) => {
    writeAtomic([])
    return res.json({ scents: [], cleared: true })
  })

  app.post('/api/scents/reset', requireAdmin, (_req, res) => {
    const seed = loadSeedScents()
    writeAtomic(seed)
    return res.json({ scents: seed, reset: true, count: seed.length })
  })
}
