import { useEffect, useMemo, useState } from 'react'
import { Activity, RefreshCw, Search } from 'lucide-react'
import { adminAuthHeaders } from '../../lib/adminAuth'

interface ActivityEntry { id: string; at: string; action: string; subject: string; manager: { displayName: string; username: string } }

const labels: Record<string, string> = {
  'account.created': 'Created manager account', 'account.password_changed': 'Changed password', 'account.password_reset': 'Reset manager password',
  'product.created': 'Added product', 'product.updated': 'Updated product', 'product.deleted': 'Deleted product', 'product.catalog_restored': 'Restored product catalog',
  'quote.payment_sent': 'Sent quote payment link', 'quote.updated': 'Updated quote', 'order.updated': 'Updated order', 'order.deleted': 'Deleted order',
  'file.uploaded_or_restored': 'Uploaded or restored file', 'file.renamed_or_moved': 'Renamed or moved file', 'file.recycled_or_deleted': 'Recycled or deleted file',
  'scent.changed': 'Changed scent list', 'scent.renamed': 'Renamed scent', 'scent.deleted': 'Deleted scent', 'order.proof_changed': 'Changed order proof',
}

export default function ActivityPanel() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => { setBusy(true); setError(null); void fetch('/api/admin/activity', { headers: adminAuthHeaders() }).then(async (response) => { if (!response.ok) throw new Error('Could not load activity.'); const data = await response.json(); setEntries(Array.isArray(data.entries) ? data.entries : []) }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load activity.')).finally(() => setBusy(false)) }
  useEffect(refresh, [])
  const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return needle ? entries.filter((entry) => `${entry.manager.displayName} ${entry.manager.username} ${entry.action} ${entry.subject}`.toLowerCase().includes(needle)) : entries }, [entries, query])
  return <section>
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-ink-2 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan/10 text-cyan"><Activity className="h-7 w-7" /></span><div><h2 className="font-display text-2xl text-cream">Manager activity</h2><p className="text-sm text-mute">A server-recorded history of changes made in Store Manager.</p></div></div><div className="rounded-xl border border-line bg-ink px-4 py-3"><p className="text-xs font-bold uppercase text-mute">Recorded changes</p><p className="font-display text-2xl text-cream">{entries.length}</p></div></div>
    <div className="mt-4 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search person, action, or item…" className="min-h-12 w-full rounded-xl border border-line bg-ink pl-11 pr-4 text-cream outline-none focus:border-cyan" /></label><button onClick={refresh} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-ink px-4 font-bold text-cream"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button></div>
    {error && <p className="mt-3 rounded-xl border border-pink/40 bg-pink/10 px-4 py-3 font-bold text-pink">{error}</p>}
    <div className="mt-4 overflow-hidden rounded-xl border border-line bg-ink-2">{visible.map((entry) => <article key={entry.id} className="flex flex-col gap-2 border-b border-line p-4 last:border-0 sm:flex-row sm:items-center"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan/10 font-display uppercase text-cyan">{entry.manager.displayName?.charAt(0) || '?'}</span><div className="min-w-0 flex-1"><p className="font-bold text-cream">{labels[entry.action] || entry.action.replaceAll('.', ' ')}</p><p className="break-words text-sm text-mute">{entry.subject}</p></div><div className="sm:text-right"><p className="text-sm font-bold text-cyan">{entry.manager.displayName}</p><p className="text-xs text-mute">{new Date(entry.at).toLocaleString()}</p></div></article>)}{!busy && visible.length === 0 && <p className="p-10 text-center text-mute">No matching activity yet.</p>}</div>
  </section>
}
