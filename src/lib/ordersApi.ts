import { adminAuthHeaders } from './adminAuth'
import type { Order, OrderStatus } from '../store/orders'

export type OrdersSyncState = 'idle' | 'loading' | 'synced' | 'error'

export class OrdersApiError extends Error {
  status: number
  code: string
  order?: Order

  constructor(message: string, status: number, code: string, order?: Order) {
    super(message)
    this.name = 'OrdersApiError'
    this.status = status
    this.code = code
    this.order = order
  }
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch('/api/orders', { headers: adminAuthHeaders() })
  const data = (await parseJson(res)) as { orders?: Order[]; error?: string } | null
  if (!res.ok) {
    throw new OrdersApiError(
      data?.error || `fetch_failed_${res.status}`,
      res.status,
      data?.error || 'fetch_failed',
    )
  }
  return Array.isArray(data?.orders) ? data!.orders! : []
}

export interface CreateOrderBody {
  id?: string
  createdAt?: string
  customer: Order['customer']
  items: Order['items']
  total: number
  status?: OrderStatus
  stripeSessionId?: string
  shippingCents?: number
}

export async function createOrder(body: CreateOrderBody): Promise<Order> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const data = (await parseJson(res)) as {
    order?: Order
    error?: string
  } | null
  if (res.status === 409 && data?.order) {
    return data.order
  }
  if (!res.ok || !data?.order) {
    throw new OrdersApiError(
      data?.error || `create_failed_${res.status}`,
      res.status,
      data?.error || 'create_failed',
      data?.order,
    )
  }
  return data.order
}

export interface PatchOrderBody {
  status?: OrderStatus
  trackingCarrier?: string | null
  trackingNumber?: string | null
  shippedAt?: string | null
}

export async function patchOrder(
  id: string,
  body: PatchOrderBody,
): Promise<Order> {
  const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: adminAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const data = (await parseJson(res)) as { order?: Order; error?: string } | null
  if (!res.ok || !data?.order) {
    throw new OrdersApiError(
      data?.error || `update_failed_${res.status}`,
      res.status,
      data?.error || 'update_failed',
    )
  }
  return data.order
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
): Promise<Order> {
  return patchOrder(id, { status })
}

export async function deleteOrder(id: string): Promise<void> {
  const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: adminAuthHeaders(),
  })
  if (res.status === 404) return
  if (!res.ok) {
    const data = (await parseJson(res)) as { error?: string } | null
    throw new OrdersApiError(
      data?.error || `delete_failed_${res.status}`,
      res.status,
      data?.error || 'delete_failed',
    )
  }
}
