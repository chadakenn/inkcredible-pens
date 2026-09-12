import { adminAuthHeaders } from './adminAuth'

export interface CustomerFileRecord {
  path: string
  name: string
  folder: string
  size: number
  modifiedAt: string
  previewable: boolean
  url: string
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(body.error || `request_failed_${response.status}`)
  return body
}

export async function fetchCustomerFiles(): Promise<CustomerFileRecord[]> {
  const response = await fetch('/api/admin/customer-files', { headers: adminAuthHeaders() })
  return (await readJson<{ files: CustomerFileRecord[] }>(response)).files
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
