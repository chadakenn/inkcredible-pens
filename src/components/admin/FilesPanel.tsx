import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, FileImage, FolderOpen, RefreshCw, Search, Upload } from 'lucide-react'
import { fetchCustomerFiles, uploadCustomerFile, type CustomerFileRecord } from '../../lib/customerFilesApi'
import { downloadAdminArtwork, fetchAdminArtworkObjectUrl } from '../../lib/uploadCustomArtwork'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Preview({ file }: { file: CustomerFileRecord }) {
  const [src, setSrc] = useState<string | null>(null)
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
  return src
    ? <img src={src} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-line bg-white object-contain" />
    : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-line bg-ink text-cyan"><FileImage className="h-7 w-7" /></span>
}

export default function FilesPanel() {
  const [files, setFiles] = useState<CustomerFileRecord[]>([])
  const [query, setQuery] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [jobName, setJobName] = useState('')
  const [selected, setSelected] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = () => {
    setBusy(true)
    setMessage(null)
    void fetchCustomerFiles()
      .then(setFiles)
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Could not load files.'))
      .finally(() => setBusy(false))
  }
  useEffect(refresh, [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? files.filter((file) => `${file.name} ${file.folder}`.toLowerCase().includes(needle)) : files
  }, [files, query])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return setMessage('Choose a file first.')
    setBusy(true)
    setMessage(null)
    void uploadCustomerFile(selected, customerName, jobName)
      .then((created) => {
        setFiles((current) => [created, ...current])
        setSelected(null)
        setCustomerName('')
        setJobName('')
        const input = document.getElementById('manager-file-upload') as HTMLInputElement | null
        if (input) input.value = ''
        setMessage('File saved to permanent customer storage.')
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Upload failed.'))
      .finally(() => setBusy(false))
  }

  return <section>
    <div className="rounded-3xl border border-line bg-ink-2 p-5 sm:p-7">
      <div className="flex items-start gap-3"><FolderOpen className="mt-1 h-7 w-7 text-cyan" /><div><h2 className="font-display text-3xl text-cream">Customer files</h2><p className="mt-1 text-sm text-mute">Paid-order artwork and files uploaded directly by a manager.</p></div></div>
      <form onSubmit={submit} className="mt-6 grid gap-3 rounded-2xl border border-line bg-ink p-4 lg:grid-cols-4">
        <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase text-mute">Customer name</span><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Jane Smith" className="min-h-12 w-full rounded-xl border border-line bg-ink-2 px-3 text-cream outline-none focus:border-cyan" /></label>
        <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase text-mute">Job name</span><input value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="Birthday banner" className="min-h-12 w-full rounded-xl border border-line bg-ink-2 px-3 text-cream outline-none focus:border-cyan" /></label>
        <label className="block"><span className="mb-2 block text-xs font-extrabold uppercase text-mute">Artwork</span><input id="manager-file-upload" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.svg,.pdf" onChange={(e) => setSelected(e.target.files?.[0] || null)} className="block min-h-12 w-full rounded-xl border border-line bg-ink-2 p-2 text-sm text-mute file:mr-3 file:rounded-lg file:border-0 file:bg-cyan file:px-3 file:py-2 file:font-bold file:text-ink" /></label>
        <button disabled={busy || !selected} className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime px-4 font-extrabold text-ink disabled:opacity-40"><Upload className="h-4 w-4" /> Save file</button>
      </form>
      {message && <p role="status" className="mt-3 rounded-xl border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm font-bold text-cyan">{message}</p>}
    </div>

    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <label className="relative flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer, order, job, or filename…" className="min-h-12 w-full rounded-xl border border-line bg-ink py-2 pl-11 pr-4 text-cream outline-none focus:border-cyan" /></label>
      <button type="button" onClick={refresh} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-ink px-4 font-bold text-cream"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh</button>
    </div>

    <p className="mt-4 text-sm font-bold text-mute">Showing {visible.length} of {files.length} files</p>
    <div className="mt-3 space-y-3">
      {visible.map((file) => <article key={file.path} className="flex flex-col gap-4 rounded-2xl border border-line bg-ink-2 p-4 sm:flex-row sm:items-center">
        <Preview file={file} />
        <div className="min-w-0 flex-1"><p className="break-all font-bold text-cream">{file.name}</p><p className="mt-1 break-all text-xs text-cyan">{file.folder}</p><p className="mt-1 text-xs text-mute">{formatBytes(file.size)} · {new Date(file.modifiedAt).toLocaleString()}</p></div>
        <button type="button" onClick={() => void downloadAdminArtwork(file.url, file.name).catch((error) => setMessage(error instanceof Error ? error.message : 'Download failed.'))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan px-4 font-extrabold text-ink"><Download className="h-4 w-4" /> Download</button>
      </article>)}
      {!busy && visible.length === 0 && <p className="rounded-2xl border border-dashed border-line p-10 text-center text-mute">No matching customer files yet.</p>}
    </div>
  </section>
}
