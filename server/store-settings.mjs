import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { requireAdmin } from './adminAuth.mjs'
import { readJsonFile, writeJsonAtomic } from './security.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SETTINGS_FILE = path.resolve(__dirname, '../data/catalog/store-settings.json')
const defaults = { announcement: { enabled: true, message: 'Handmade to order' } }

function readSettings() {
  const data = readJsonFile(SETTINGS_FILE)
  return { ...defaults, ...(data || {}), announcement: { ...defaults.announcement, ...(data?.announcement || {}) } }
}

export function mountStoreSettings(app) {
  app.get('/api/store-settings', (_req, res) => res.json({ settings: readSettings() }))
  app.patch('/api/admin/store-settings', requireAdmin, (req, res) => {
    const message = String(req.body?.announcement?.message || '').trim().slice(0, 120)
    const enabled = req.body?.announcement?.enabled !== false
    if (enabled && message.length < 2) return res.status(400).json({ error: 'announcement_required' })
    const settings = { ...readSettings(), announcement: { enabled, message: message || defaults.announcement.message } }
    writeJsonAtomic(SETTINGS_FILE, settings, { keepBackups: 5, mode: 0o600 })
    return res.json({ settings })
  })
}
