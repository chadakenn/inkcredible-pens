import { adminAuthHeaders } from './adminAuth'

export type ScentsSyncState = 'idle' | 'loading' | 'synced' | 'error'

export class ScentsApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ScentsApiError'
    this.status = status
    this.code = code
  }
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

function throwApi(res: Response, data: { error?: string } | null, fallback: string): never {
  throw new ScentsApiError(
    data?.error || `${fallback}_${res.status}`,
    res.status,
    data?.error || fallback,
  )
}

export async function fetchScents(): Promise<string[]> {
  const res = await fetch('/api/scents')
  const data = (await parseJson(res)) as { scents?: string[]; error?: string } | null
  if (!res.ok) throwApi(res, data, 'fetch_failed')
  return Array.isArray(data?.scents) ? data!.scents! : []
}

export async function createScent(name: string): Promise<string[]> {
  const res = await fetch('/api/scents', {
    method: 'POST',
    headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name }),
  })
  const data = (await parseJson(res)) as { scents?: string[]; error?: string } | null
  if (!res.ok) throwApi(res, data, 'create_failed')
  return Array.isArray(data?.scents) ? data!.scents! : []
}

export async function renameScentApi(from: string, to: string): Promise<string[]> {
  const res = await fetch('/api/scents', {
    method: 'PATCH',
    headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ from, to }),
  })
  const data = (await parseJson(res)) as { scents?: string[]; error?: string } | null
  if (!res.ok) throwApi(res, data, 'rename_failed')
  return Array.isArray(data?.scents) ? data!.scents! : []
}

export async function deleteScent(name: string): Promise<string[]> {
  const res = await fetch(`/api/scents/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: adminAuthHeaders(),
  })
  const data = (await parseJson(res)) as { scents?: string[]; error?: string } | null
  if (!res.ok) throwApi(res, data, 'delete_failed')
  return Array.isArray(data?.scents) ? data!.scents! : []
}

export async function clearScentsApi(): Promise<string[]> {
  const res = await fetch('/api/scents/clear', {
    method: 'POST',
    headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  })
  const data = (await parseJson(res)) as { scents?: string[]; error?: string } | null
  if (!res.ok) throwApi(res, data, 'clear_failed')
  return Array.isArray(data?.scents) ? data!.scents! : []
}

export async function resetScentsApi(): Promise<string[]> {
  const res = await fetch('/api/scents/reset', {
    method: 'POST',
    headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  })
  const data = (await parseJson(res)) as { scents?: string[]; error?: string } | null
  if (!res.ok) throwApi(res, data, 'reset_failed')
  return Array.isArray(data?.scents) ? data!.scents! : []
}
