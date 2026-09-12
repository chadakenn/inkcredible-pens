import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Download, Eye, FileImage, FolderOpen, HardDrive, Pencil, Plus, RefreshCw, RotateCcw, Search, Trash2, Upload, X } from 'lucide-react'
import {
  downloadCustomerFolder,
  fetchCustomerFiles,
  permanentlyDeleteCustomerFile,
  recycleCustomerFile,
  restoreCustomerFile,
  updateCustomerFile,
  uploadCustomerFile,
  type CustomerFileRecord,
  type RecycledCustomerFile,
  type CustomerStorageSummary,
} from '../../lib/customerFilesApi'
import { downloadAdminArtwork, fetchAdminArtworkObjectUrl } from '../../lib/uploadCustomArtwork'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Preview({ file }: { file: CustomerFileRecord }) {
  const [src, setSrc] = useState<string | null>(null)
  const [large, setLarge] = useState(false)
  const [hover, setHover] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    if (!file.previewable) return
    let active = true
    let objectUrl: string | null = null
    void fetchAdminArtworkObjectUrl(file.url).then((url) => {
      objectUrl = url
      if (active) setSrc(url)
      else URL.revokeObjectURL(url)
    }).catch(() => undefined)
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file.path, file.previewable, file.url])
  if (!src) return <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-line bg-ink text-cyan"><FileImage className="h-7 w-7" /></span>
  return <>
    <button type="button" onClick={() => { setHover(null); setLarge(true) }} onMouseLeave={() => setHover(null)} onMouseEnter={(event) => { const box = event.currentTarget.getBoundingClientRect(); setHover({ top: Math.min(innerHeight - 380, Math.max(16, box.top - 80)), left: Math.min(innerWidth - 356, Math.max(16, box.right + 12)) }) }} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-white hover:border-cyan"><img src={src} alt={file.name} className="h-full w-full object-contain" /><span className="absolute inset-0 hidden items-center justify-center bg-black/55 text-white group-hover:flex"><Eye className="h-5 w-5" /></span></button>
    {hover && createPortal(<div style={hover} className="pointer-events-none fixed z-[110] hidden w-[340px] rounded-xl border border-cyan/50 bg-ink-2 p-3 shadow-2xl md:block"><img src={src} alt="Artwork preview" className="max-h-[340px] w-full rounded-lg bg-white object-contain" /><p className="mt-2 text-center text-xs font-bold text-cyan">Click for full screen</p></div>, document.body)}
    {large && createPortal(<div onClick={() => setLarge(false)} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4"><button className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-full bg-ink-2 text-cream"><X /></button><img onClick={(event) => event.stopPropagation()} src={src} alt={file.name} className="max-h-[90vh] max-w-[95vw] rounded-xl bg-white object-contain" /></div>, document.body)}
  </>
}

function manualLabels(file: CustomerFileRecord) {
  const folder = file.folder.split('/').at(-1) || ''
  const [customerName = '', jobName = ''] = folder.split('_MANUAL-')
  return { customerName: customerName.replaceAll('-', ' '), jobName: jobName.replaceAll('-', ' ') }
}

function folderDetails(folder: string) {
  const leaf = folder.split('/').at(-1) || folder
  if (leaf.includes('_MANUAL-')) {
    const [customer = 'Manager upload', job = 'General files'] = leaf.split('_MANUAL-')
    return { customer: customer.replaceAll('-', ' '), job: job.replaceAll('-', ' '), manual: true }
  }
  const pieces = leaf.split('_')
  return {
    customer: (pieces[0] || 'Customer').replaceAll('-', ' '),
    job: pieces.slice(1).join(' ').replaceAll('-', ' ') || 'Paid order artwork',
    manual: false,
  }
}

export default function FilesPanel() {
  const [files, setFiles] = useState<CustomerFileRecord[]>([])
  const [recycled, setRecycled] = useState<RecycledCustomerFile[]>([])
  const [storage, setStorage] = useState<CustomerStorageSummary | null>(null)
  const [view, setView] = useState<'folders' | 'files' | 'recycle'>('folders')
  const [query, setQuery] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [jobName, setJobName] = useState('')
  const [selected, setSelected] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState<({ path: string; fileName: string; customerName: string; jobName: string }) | null>(null)
  const [confirmRecycle, setConfirmRecycle] = useState<string | null>(null)
  const [confirmPermanent, setConfirmPermanent] = useState<string | null>(null)
  const [cleanupUnlocked, setCleanupUnlocked] = useState<string | null>(null)
  const [cleanupPin, setCleanupPin] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest')

  const refresh = () => {
    setBusy(true)
    setMessage(null)
    void fetchCustomerFiles()
      .then((result) => { setFiles(result.files); setRecycled(result.recycled); setStorage(result.storage) })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load files.'))
      .finally(() => setBusy(false))
  }
  useEffect(refresh, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matching = needle ? files.filter((file) => `${file.name} ${file.folder}`.toLowerCase().includes(needle)) : files
    return [...matching].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'oldest' ? a.modifiedAt.localeCompare(b.modifiedAt) : b.modifiedAt.localeCompare(a.modifiedAt))
  }, [files, query, sort])

  const folders = useMemo(() => {
    const grouped = new Map<string, { folder: string; files: CustomerFileRecord[]; bytes: number; newest: string }>()
    for (const file of files) {
      const current = grouped.get(file.folder) || { folder: file.folder, files: [], bytes: 0, newest: file.modifiedAt }
      current.files.push(file)
      current.bytes += file.size
      if (file.modifiedAt > current.newest) current.newest = file.modifiedAt
      grouped.set(file.folder, current)
    }
    return [...grouped.values()].sort((a, b) => b.newest.localeCompare(a.newest))
  }, [files])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return setMessage('Choose a file first.')
    setBusy(true)
    setMessage(null)
    void uploadCustomerFile(selected, customerName, jobName)
      .then((created) => {
        setFiles((current) => [created, ...current])
        setSelected(null); setCustomerName(''); setJobName('')
        setShowUpload(false)
        const input = document.getElementById('manager-file-upload') as HTMLInputElement | null
        if (input) input.value = ''
        setMessage('File saved to permanent customer storage.')
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Upload failed.'))
      .finally(() => setBusy(false))
  }

  const saveEdit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    setBusy(true)
    void updateCustomerFile(editing)
      .then((updated) => {
        setFiles((current) => current.map((file) => file.path === editing.path ? updated : file))
        setEditing(null)
        setMessage('File name and folder updated.')
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Could not update file.'))
      .finally(() => setBusy(false))
  }

  const recycle = (file: CustomerFileRecord) => {
    setBusy(true)
    void recycleCustomerFile(file.path, !file.manual && file.cleanupEligible, cleanupPin)
      .then(() => { setConfirmRecycle(null); setCleanupUnlocked(null); setCleanupPin(''); setMessage('File moved to the recycle bin.'); refresh() })
      .catch((error) => {
        const incorrectPin = error instanceof Error && error.message === 'invalid_cleanup_pin'
        const message = incorrectPin
          ? 'Incorrect cleanup PIN. The paid-order file is still locked.'
          : error instanceof Error ? error.message : 'Could not recycle file.'
        if (incorrectPin) {
          setCleanupUnlocked(null)
          setConfirmRecycle(null)
          setCleanupPin('')
        }
        setMessage(message)
        setBusy(false)
      })
  }

  const unlockEarlyWithPin = (file: CustomerFileRecord) => {
    const pin = window.prompt('Enter the emergency cleanup PIN to recycle this locked paid-order file:')
    if (pin === null) return
    setCleanupPin(pin.trim())
    setCleanupUnlocked(file.path)
    setConfirmRecycle(file.path)
  }

  const restore = (id: string) => {
    setBusy(true)
    void restoreCustomerFile(id)
      .then(() => { setMessage('File restored.'); refresh() })
      .catch((error) => { setMessage(error instanceof Error ? error.message : 'Could not restore file.'); setBusy(false) })
  }

  const permanentlyDelete = (id: string) => {
    setBusy(true)
    void permanentlyDeleteCustomerFile(id)
      .then(() => { setConfirmPermanent(null); setMessage('File permanently deleted.'); refresh() })
      .catch((error) => { setMessage(error instanceof Error ? error.message : 'Could not delete file.'); setBusy(false) })
  }

  return <section>
    <div className="rounded-2xl border border-line bg-ink-2 p-5 sm:p-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3"><FolderOpen className="mt-1 h-7 w-7 text-cyan" /><div><h2 className="font-display text-3xl text-cream">Customer files</h2><p className="mt-1 text-sm text-mute">Find paid artwork, organize outside jobs, and download production-ready files.</p></div></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowUpload((value) => !value)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-extrabold ${showUpload ? 'border border-line text-cream' : 'bg-lime text-ink'}`}>{showUpload ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{showUpload ? 'Close' : 'Add outside file'}</button>
          <button type="button" onClick={refresh} disabled={busy} aria-label="Refresh files" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 font-bold text-cream"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /><span className="hidden sm:inline">Refresh</span></button>
        </div>
      </div>
      {showUpload && <form onSubmit={submit} className="mt-6 grid gap-3 rounded-xl border border-cyan/30 bg-ink p-4 lg:grid-cols-4">
        <div className="lg:col-span-4"><p className="font-bold text-cream">Add a file that did not come through the shop</p><p className="text-xs text-mute">We’ll create an easy-to-find customer and job folder automatically.</p></div>
        <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase text-mute">Customer name</span><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Jane Smith" className="min-h-12 w-full rounded-xl border border-line bg-ink-2 px-3 text-cream outline-none focus:border-cyan" /></label>
        <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase text-mute">Job name</span><input value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="Birthday banner" className="min-h-12 w-full rounded-xl border border-line bg-ink-2 px-3 text-cream outline-none focus:border-cyan" /></label>
        <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase text-mute">Artwork</span><input id="manager-file-upload" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.pdf" onChange={(e) => setSelected(e.target.files?.[0] || null)} className="block min-h-12 w-full rounded-xl border border-line bg-ink-2 p-2 text-sm text-mute file:mr-3 file:rounded-lg file:border-0 file:bg-cyan file:px-3 file:py-2 file:font-bold file:text-ink" /></label>
        <button disabled={busy || !selected} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime px-4 font-extrabold text-ink disabled:opacity-40"><Upload className="h-4 w-4" /> Save file</button>
      </form>}
      {message && <p role="status" className="mt-3 rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm font-bold text-cyan">{message}</p>}
    </div>

    {storage && <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-line bg-ink-2 p-4"><HardDrive className="h-5 w-5 text-cyan" /><p className="mt-2 text-xs font-bold uppercase text-mute">Storage used</p><p className="font-display text-2xl text-cream">{formatBytes(storage.usedBytes)}</p><p className="text-xs text-mute">{formatBytes(storage.freeBytes)} free of {formatBytes(storage.totalBytes)}</p></div>
      <div className="rounded-xl border border-line bg-ink-2 p-4"><FileImage className="h-5 w-5 text-lime" /><p className="mt-2 text-xs font-bold uppercase text-mute">Active artwork</p><p className="font-display text-2xl text-cream">{storage.activeFileCount} files</p><p className="text-xs text-mute">{formatBytes(storage.activeBytes)}</p></div>
      <div className="rounded-xl border border-line bg-ink-2 p-4"><Trash2 className="h-5 w-5 text-pink" /><p className="mt-2 text-xs font-bold uppercase text-mute">Recycle bin</p><p className="font-display text-2xl text-cream">{storage.recycleFileCount} files</p><p className="text-xs text-mute">{formatBytes(storage.recycleBytes)}</p></div>
      <div className="rounded-xl border border-line bg-ink-2 p-4"><FolderOpen className="h-5 w-5 text-amber-300" /><p className="mt-2 text-xs font-bold uppercase text-mute">Oldest active file</p><p className="truncate font-bold text-cream">{storage.oldestFile?.name || 'None yet'}</p><p className="text-xs text-mute">{storage.oldestFile ? new Date(storage.oldestFile.modifiedAt).toLocaleDateString() : '—'}</p></div>
    </div>}

    <div className="mt-6 grid grid-cols-3 rounded-xl border border-line bg-ink p-1">
      <button type="button" onClick={() => setView('folders')} className={`min-h-12 rounded-xl font-extrabold ${view === 'folders' ? 'bg-lime text-ink' : 'text-mute'}`}>Folders ({folders.length})</button>
      <button type="button" onClick={() => setView('files')} className={`min-h-12 rounded-xl font-extrabold ${view === 'files' ? 'bg-cyan text-ink' : 'text-mute'}`}>Files ({files.length})</button>
      <button type="button" onClick={() => setView('recycle')} className={`min-h-12 rounded-xl font-extrabold ${view === 'recycle' ? 'bg-pink text-white' : 'text-mute'}`}>Recycle bin ({recycled.length})</button>
    </div>

    {view === 'folders' && <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {folders.map((folder) => {
        const details = folderDetails(folder.folder)
        return <article key={folder.folder} className="flex flex-col rounded-xl border border-line bg-ink-2 p-5 transition-colors hover:border-cyan/50">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime/10"><FolderOpen className="h-6 w-6 text-lime" /></span><div className="min-w-0"><span className={`rounded-full px-2 py-1 text-[10px] font-extrabold uppercase ${details.manual ? 'bg-cyan/10 text-cyan' : 'bg-lime/10 text-lime'}`}>{details.manual ? 'Manager upload' : 'Paid order'}</span><h3 className="mt-2 break-words font-display text-xl capitalize text-cream">{details.customer}</h3><p className="truncate text-sm text-mute">{details.job}</p><p className="mt-2 text-xs text-mute">{folder.files.length} {folder.files.length === 1 ? 'file' : 'files'} · {formatBytes(folder.bytes)} · updated {new Date(folder.newest).toLocaleDateString()}</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => { setQuery(folder.folder); setView('files') }} className="min-h-11 rounded-xl border border-line px-3 font-bold text-cream">Open folder</button>
            <button type="button" onClick={() => void downloadCustomerFolder(folder.folder).catch((error) => setMessage(error instanceof Error ? error.message : 'ZIP download failed.'))} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan px-3 font-extrabold text-ink"><Download className="h-4 w-4" /> Download job ZIP</button>
          </div>
        </article>
      })}
      {!busy && folders.length === 0 && <p className="rounded-2xl border border-dashed border-line p-10 text-center text-mute md:col-span-2">No customer folders yet.</p>}
    </div>}

    {view === 'files' && <>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, order, job, or filename…" className="min-h-12 w-full rounded-xl border border-line bg-ink py-2 pl-11 pr-4 text-cream outline-none focus:border-cyan" /></label>
        <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort files" className="min-h-12 rounded-xl border border-line bg-ink px-4 font-bold text-cream outline-none focus:border-cyan"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select>
      </div>
      <p className="mt-4 text-sm font-bold text-mute">Showing {visible.length} of {files.length} files</p>
      <div className="mt-3 space-y-3">
        {visible.map((file) => <article key={file.path} className={`rounded-xl border bg-ink-2 p-4 ${file.manual ? 'border-cyan/30' : 'border-lime/30'}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Preview file={file} />
            <div className="min-w-0 flex-1"><p className="break-all font-bold text-cream">{file.name}</p><p className="mt-1 break-all text-xs text-cyan">{file.folder}</p><p className="mt-1 text-xs text-mute">{formatBytes(file.size)} · {new Date(file.modifiedAt).toLocaleString()}</p>{!file.manual && <p className={`mt-2 text-xs font-bold ${file.cleanupEligible ? 'text-amber-300' : 'text-lime'}`}>{file.cleanupEligible ? 'One-year lock complete · eligible for cleanup' : `Linked to paid order · locked until ${new Date(file.cleanupEligibleAt!).toLocaleDateString()}`}</p>}</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void downloadAdminArtwork(file.url, file.name).catch((error) => setMessage(error instanceof Error ? error.message : 'Download failed.'))} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan px-3 font-extrabold text-ink"><Download className="h-4 w-4" /> Download</button>
              {file.manual && <button type="button" onClick={() => setEditing({ path: file.path, fileName: file.name, ...manualLabels(file) })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-3 font-bold text-cream"><Pencil className="h-4 w-4" /> Rename/move</button>}
              {(file.manual || cleanupUnlocked === file.path) && (confirmRecycle === file.path
                ? <><button type="button" onClick={() => recycle(file)} className="min-h-11 rounded-xl bg-pink px-3 font-bold text-white">Confirm recycle</button><button type="button" onClick={() => setConfirmRecycle(null)} className="min-h-11 rounded-xl border border-line px-3 text-cream">Cancel</button></>
                : <button type="button" onClick={() => setConfirmRecycle(file.path)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-pink/50 px-3 font-bold text-pink"><Trash2 className="h-4 w-4" /> Recycle</button>)}
              {!file.manual && file.cleanupEligible && cleanupUnlocked !== file.path && <button type="button" onClick={() => setCleanupUnlocked(file.path)} className="min-h-11 rounded-xl border border-amber-300/50 px-3 font-bold text-amber-300">Unlock for cleanup</button>}
              {!file.manual && !file.cleanupEligible && cleanupUnlocked !== file.path && <button type="button" onClick={() => unlockEarlyWithPin(file)} className="min-h-11 rounded-xl border border-pink/50 px-3 font-bold text-pink">Emergency delete</button>}
              {!file.manual && cleanupUnlocked === file.path && <button type="button" onClick={() => { setCleanupUnlocked(null); setConfirmRecycle(null); setCleanupPin('') }} className="min-h-11 rounded-xl border border-line px-3 text-cream">Keep locked</button>}
            </div>
          </div>
          {editing?.path === file.path && <form onSubmit={saveEdit} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3">
            <label><span className="mb-1 block text-xs font-bold text-mute">File name</span><input required value={editing.fileName} onChange={(e) => setEditing({ ...editing, fileName: e.target.value })} className="min-h-11 w-full rounded-xl border border-line bg-ink px-3 text-cream" /></label>
            <label><span className="mb-1 block text-xs font-bold text-mute">Customer/folder</span><input required value={editing.customerName} onChange={(e) => setEditing({ ...editing, customerName: e.target.value })} className="min-h-11 w-full rounded-xl border border-line bg-ink px-3 text-cream" /></label>
            <label><span className="mb-1 block text-xs font-bold text-mute">Job/folder</span><input required value={editing.jobName} onChange={(e) => setEditing({ ...editing, jobName: e.target.value })} className="min-h-11 w-full rounded-xl border border-line bg-ink px-3 text-cream" /></label>
            <div className="flex gap-2 sm:col-span-3"><button disabled={busy} className="min-h-11 rounded-xl bg-lime px-4 font-bold text-ink">Save changes</button><button type="button" onClick={() => setEditing(null)} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-4 text-cream"><X className="h-4 w-4" /> Cancel</button></div>
          </form>}
        </article>)}
        {!busy && visible.length === 0 && <p className="rounded-2xl border border-dashed border-line p-10 text-center text-mute">No matching customer files yet.</p>}
      </div>
    </>}

    {view === 'recycle' && <div className="mt-4 space-y-3">
      <p className="rounded-xl border border-pink/30 bg-pink/10 px-4 py-3 text-sm text-mute"><strong className="text-cream">30-day safety net.</strong> Restore a file anytime before its automatic cleanup date.</p>
      {recycled.map((file) => <article key={file.id} className="flex flex-col gap-3 rounded-xl border border-line bg-ink-2 p-4 sm:flex-row sm:items-center">
        <Trash2 className="h-7 w-7 shrink-0 text-pink" /><div className="min-w-0 flex-1"><p className="break-all font-bold text-cream">{file.name}</p><p className="break-all text-xs text-mute">Previously: {file.originalPath}</p><p className="mt-1 text-xs text-mute">{formatBytes(file.size)} · recycled {new Date(file.deletedAt).toLocaleString()}</p><p className="mt-1 text-xs font-bold text-pink">Deletes automatically after {new Date(file.deleteEligibleAt).toLocaleString()}</p></div>
        <button type="button" onClick={() => restore(file.id)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan px-3 font-bold text-ink"><RotateCcw className="h-4 w-4" /> Restore</button>
        {file.deleteEligible && (confirmPermanent === file.id
          ? <><button type="button" onClick={() => permanentlyDelete(file.id)} className="min-h-11 rounded-xl bg-pink px-3 font-bold text-white">Delete forever</button><button type="button" onClick={() => setConfirmPermanent(null)} className="min-h-11 rounded-xl border border-line px-3 text-cream">Cancel</button></>
          : <button type="button" onClick={() => setConfirmPermanent(file.id)} className="min-h-11 rounded-xl border border-pink/50 px-3 font-bold text-pink">Delete permanently</button>)}
      </article>)}
      {!busy && recycled.length === 0 && <p className="rounded-2xl border border-dashed border-line p-10 text-center text-mute">Recycle bin is empty.</p>}
    </div>}
  </section>
}
