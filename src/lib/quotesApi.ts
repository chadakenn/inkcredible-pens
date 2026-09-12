import { adminAuthHeaders } from './adminAuth'
import type { CustomLogoMeta } from '../data/products'

export interface QuoteRequest {
  id: string
  displayCode: string
  createdAt: string
  status: 'requested' | 'payment_sent' | 'paid' | 'cancelled'
  customer: { email: string; name: string; address?: string; city?: string; state?: string; zip?: string }
  items: { name: string; qty: number; estimate: number; custom?: CustomLogoMeta }[]
  estimateTotal: number
  finalPriceCents?: number
  shippingCents?: number
  paymentUrl?: string
  paymentSentAt?: string
  orderId?: string
  managerMessage?: string
  turnaround?: string
  paymentRevision?: number
  cancelledAt?: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `request_failed_${response.status}`)
  return data as T
}

export async function fetchQuotes(): Promise<QuoteRequest[]> {
  const data = await request<{ quotes: QuoteRequest[] }>('/api/admin/quotes', { headers: adminAuthHeaders() })
  return data.quotes
}

export async function sendQuotePayment(id: string, input: { finalPrice: number; shipping: number; managerMessage: string; turnaround: string }): Promise<QuoteRequest> {
  const data = await request<{ quote: QuoteRequest }>(`/api/admin/quotes/${encodeURIComponent(id)}/send-payment`, {
    method: 'POST', headers: adminAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(input),
  })
  return data.quote
}

export async function setQuoteStatus(id: string, status: 'requested' | 'cancelled'): Promise<QuoteRequest> {
  const data = await request<{ quote: QuoteRequest }>(`/api/admin/quotes/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: adminAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ status }),
  })
  return data.quote
}
