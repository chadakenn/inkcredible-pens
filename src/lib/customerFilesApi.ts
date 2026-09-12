import { adminAuthHeaders } from './adminAuth'

export interface CustomerFileRecord {
  path: string
  name: string
  folder: string
  size: number
  modifiedAt: string
  previewable: boolean
  manual: boolean
  url: string
}

export interface RecycledCustomerFile {
  id: string
  name: string
  originalPath: string
  deletedAt: string
  size: number
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || `request_failed_${response.status}`)
  return body
}

export async function fetchCustomerFiles(): Promise<{ files: CustomerFileRecord[]; recycled: RecycledCustomerFile[] }> {
  const response = await fetch('/api/admin/customer-files', { headers: adminAuthHeaders() })
  return readJson<{ files: CustomerFileRecord[]; recycled: RecycledCustomerFile[] }>(response)
}

export async function updateCustomerFile(input: { path: string; customerName: string; jobName: string; fileName: string }): Promise<CustomerFileRecord> {
  const response = await fetch('/api/admin/customer-files/file', {
    method: 'PATCH', headers: adminAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(input),
  })
  return (await readJson<{ file: CustomerFileRecord }>(response)).file
}

export async function recycleCustomerFile(path: string): Promise<void> {
  const response = await fetch(`/api/admin/customer-files/file?path=${encodeURIComponent(path)}`, { method: 'DELETE', headers: adminAuthHeaders() })
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
