import { useEffect, useState } from 'react'
import { DownloadCloud, RefreshCw } from 'lucide-react'
import { adminAuthHeaders } from '../../lib/adminAuth'

type Status = { status: string; total: number; completed: number; migrated: number; failed: number; skipped: number }
type Summary = { status: Status | null; remaining: number; preview: { id: string; name: string; imageUrl: string }[] }

export default function ImageMigrationPanel({ onCatalogChanged }: { onCatalogChanged: () => void }) {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const load = async () => {
    const response = await fetch('/api/admin/product-image-migration', { headers: adminAuthHeaders() })
    if (!response.ok) throw new Error('Could not check images')
    setData(await response.json())
  }
  useEffect(() => { void load().catch((e) => setError(e.message)) }, [])
  const running = data?.status?.status === 'running'
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => void load().then(onCatalogChanged).catch(() => {}), 1200)
    return () => window.clearInterval(timer)
  }, [running, onCatalogChanged])
  const start = async (limit: number) => {
    setError('')
    const response = await fetch('/api/admin/product-image-migration', { method: 'POST', headers: adminAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ limit }) })
    if (!response.ok) { setError('Could not start migration.'); return }
    await load()
  }
  const progress = data?.status?.total ? Math.round((data.status.completed / data.status.total) * 100) : 0
  const statusLabel = data?.status?.status === 'interrupted'
    ? 'Interrupted — safe to resume'
    : data?.status?.status?.replaceAll('_', ' ') || 'Ready'
  return <section className="mb-5 rounded-xl border border-cyan/30 bg-ink-2 p-5">
    <div className="flex items-start gap-3"><DownloadCloud className="h-6 w-6 text-cyan" /><div><h3 className="font-display text-xl text-cream">Move product photos to this server</h3><p className="mt-1 text-sm text-mute">Copies externally hosted photos into the protected product upload folder and updates each listing. Existing photos stay online until their listing is safely updated.</p></div></div>
    <div className="mt-4 rounded-xl bg-ink p-4"><div className="flex justify-between gap-3 text-sm font-bold"><span className="text-cream">{data?.remaining ?? '…'} external photos remaining</span><span className="text-cyan">{running ? `${progress}%` : statusLabel}</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-ink-3"><div className="h-full bg-lime transition-all" style={{ width: `${progress}%` }} /></div>{data?.status && <p className="mt-2 text-xs text-mute">Migrated {data.status.migrated} · Failed {data.status.failed} · Skipped {data.status.skipped}</p>}</div>
    {error && <p className="mt-3 text-sm font-bold text-pink">{error}</p>}
    <div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={running || !data?.remaining} onClick={() => void start(10)} className="min-h-12 rounded-xl bg-cyan px-5 font-extrabold text-ink disabled:opacity-40">Test first 10</button><button type="button" disabled={running || !data?.remaining} onClick={() => void start(1000)} className="min-h-12 rounded-xl bg-lime px-5 font-extrabold text-ink disabled:opacity-40">Migrate all remaining</button><button type="button" onClick={() => void load().catch((e) => setError(e.message))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-5 font-bold text-cream"><RefreshCw className="h-4 w-4" />Refresh</button></div>
  </section>
}
