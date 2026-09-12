import { adminAuthHeaders } from './adminAuth'

export interface CustomerFileRecord {
  path: string
  name: string
  folder: string
  size: number
  modifiedAt: string
  previewable: boolean
  manual: boolean
  cleanupEligible: boolean
  cleanupEligibleAt: string | null
  url: string
}

export interface RecycledCustomerFile {
  id: string
  name: string
  originalPath: string
  deletedAt: string
  size: number
  deleteEligibleAt: string
  deleteEligible: boolean
}

export interface CustomerStorageSummary {
  totalBytes: number
  freeBytes: number
  usedBytes: number
  activeBytes: number
  recycleBytes: number
  activeFileCount: number
  recycleFileCount: number
  oldestFile: { name: string; folder: string; modifiedAt: string } | null
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || `request_failed_${response.status}`)
  return body
}

export async function fetchCustomerFiles(): Promise<{ files: CustomerFileRecord[]; recycled: RecycledCustomerFile[]; storage: CustomerStorageSummary }> {
  const response = await fetch('/api/admin/customer-files', { headers: adminAuthHeaders() })
  return readJson<{ files: CustomerFileRecord[]; recycled: RecycledCustomerFile[]; storage: CustomerStorageSummary }>(response)
}

export async function downloadCustomerFolder(folder: string): Promise<void> {
  const url = `/api/admin/customer-files/folder.zip?folder=${encodeURIComponent(folder)}`
  const response = await fetch(url, { headers: adminAuthHeaders() })
  if (!response.ok) throw new Error((await response.json().catch(() => ({})) as { error?: string }).error || 'download_failed')
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = `${folder.split('/').at(-1) || 'customer-job'}.zip`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export async function updateCustomerFile(input: { path: string; customerName: string; jobName: string; fileName: string }): Promise<CustomerFileRecord> {
  const response = await fetch('/api/admin/customer-files/file', {
    method: 'PATCH', headers: adminAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(input),
  })
  return (await readJson<{ file: CustomerFileRecord }>(response)).file
}

export async function recycleCustomerFile(path: string, unlockConfirmed = false): Promise<void> {
  const response = await fetch(`/api/admin/customer-files/file?path=${encodeURIComponent(path)}&unlock=${unlockConfirmed ? '1' : '0'}`, { method: 'DELETE', headers: adminAuthHeaders() })
  await readJson<{ ok: true }>(response)
}

export async function restoreCustomerFile(id: string): Promise<void> {
  const response = await fetch(`/api/admin/customer-files/recycle/${encodeURIComponent(id)}/restore`, { method: 'POST', headers: adminAuthHeaders() })
  await readJson<{ ok: true }>(response)
}

export async function permanentlyDeleteCustomerFile(id: string): Promise<void> {
  const response = await fetch(`/api/admin/customer-files/recycle/${encodeURIComponent(id)}`, { method: 'DELETE', headers: adminAuthHeaders() })
  await readJson<{ ok: true }>(response)
}

export async function uploadCustomerFile(file: File, customerName: string, jobName: string): Promise<CustomerFileRecord> {
  const form = new FormData()
  form.append('file', file)
  form.append('customerName', customerName)
  form.append('jobName', jobName)
  const response = await fetch('/api/admin/customer-files', {
    method: 'POST',
    headers: adminAuthHeaders(),
    body: form,
  })
  return (await readJson<{ file: CustomerFileRecord }>(response)).file
}
