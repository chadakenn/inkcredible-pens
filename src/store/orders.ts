import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CustomLogoMeta } from '../data/products'
import {
  createOrder as apiCreateOrder,
  deleteOrder as apiDeleteOrder,
  fetchOrders,
  patchOrder as apiPatchOrder,
  refreshOrderTracking as apiRefreshOrderTracking,
  updateOrderStatus as apiUpdateOrderStatus,
  type OrdersSyncState,
} from '../lib/ordersApi'

export type OrderStatus = 'new' | 'making' | 'ready' | 'shipped' | 'cancelled'

export type TrackingStatus =
  | 'unknown'
  | 'pre_transit'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'expired'

export interface OrderCustomer {
  email: string
  name: string
  address: string
  city: string
  state: string
  zip: string
}

export interface OrderItemSnapshot {
  name: string
  price: number
  qty: number
  custom?: CustomLogoMeta
}

export interface Order {
  id: string
  displayCode?: string
  createdAt: string
  customer: OrderCustomer
  items: OrderItemSnapshot[]
  status: OrderStatus
  total: number
  stripeSessionId?: string
  shippingCents?: number
  trackingCarrier?: string
  trackingNumber?: string
  shippedAt?: string
  trackingStatus?: TrackingStatus
  trackingDetail?: string
  trackingCheckedAt?: string
  deliveredAt?: string
  archivedAt?: string
}

export interface OrderTrackingInput {
  carrier: string
  trackingNumber: string
}

export interface PlaceOrderInput {
  customer: OrderCustomer
  items: OrderItemSnapshot[]
  total: number
  /** Optional stable id (e.g. stripe-${sessionId}) for dedupe */
  id?: string
  stripeSessionId?: string
  shippingCents?: number
}

export interface PlaceOrderFromStripeInput {
  sessionId: string
  customer: OrderCustomer
  items: OrderItemSnapshot[]
  total: number
  shippingCents?: number
}

interface OrdersState {
  orders: Order[]
  syncState: OrdersSyncState
  syncError: string | null
  placeOrder: (input: PlaceOrderInput) => Promise<Order>
  placeOrderFromStripe: (input: PlaceOrderFromStripeInput) => Promise<Order>
  setStatus: (id: string, status: OrderStatus) => Promise<void>
  setTracking: (id: string, tracking: OrderTrackingInput) => Promise<void>
  markShipped: (id: string, tracking: OrderTrackingInput) => Promise<void>
  setArchived: (id: string, archived: boolean) => Promise<void>
  refreshTracking: (id: string) => Promise<Order>
  patchLocalOrder: (order: Order) => void
  removeOrder: (id: string) => Promise<void>
  hydrateFromApi: () => Promise<void>
}

function newOrderId(): string {
  return `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function stripeOrderId(sessionId: string): string {
  return `stripe-${sessionId}`
}

function findExisting(
  orders: Order[],
  opts: { id?: string; stripeSessionId?: string },
): Order | undefined {
  if (opts.id) {
    const byId = orders.find((o) => o.id === opts.id)
    if (byId) return byId
  }
  if (opts.stripeSessionId) {
    const sid = opts.stripeSessionId
    return orders.find(
      (o) =>
        o.stripeSessionId === sid ||
        o.id === stripeOrderId(sid) ||
        o.id === `stripe-${sid.slice(-12)}`,
    )
  }
  return undefined
}

function mergeOrders(local: Order[], remote: Order[]): Order[] {
  const map = new Map<string, Order>()
  for (const o of local) map.set(o.id, o)
  for (const o of remote) map.set(o.id, o)
  return ordersNewestFirst([...map.values()])
}

export const useOrders = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      syncState: 'idle',
      syncError: null,

      hydrateFromApi: async () => {
        set({ syncState: 'loading', syncError: null })
        try {
          const remote = await fetchOrders()
          // Server list replaces local — do not merge browser "ghost" demo orders on top.
          set({
            orders: ordersNewestFirst(remote),
            syncState: 'synced',
            syncError: null,
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'sync_failed'
          // Keep local persist as temporary cache/fallback when API is down.
          set({ syncState: 'error', syncError: message })
        }
      },

      placeOrder: async (input) => {
        const existing = findExisting(get().orders, {
          id: input.id,
          stripeSessionId: input.stripeSessionId,
        })
        if (existing) {
          // Still try to ensure server has it
          void apiCreateOrder({
            id: existing.id,
            createdAt: existing.createdAt,
            customer: existing.customer,
            items: existing.items,
            total: existing.total,
            status: existing.status,
            stripeSessionId: existing.stripeSessionId,
            shippingCents: existing.shippingCents,
          }).catch(() => {
            /* offline ok */
          })
          return existing
        }

        const order: Order = {
          id: input.id || newOrderId(),
          createdAt: new Date().toISOString(),
          customer: input.customer,
          items: input.items,
          status: 'new',
          total: input.total,
          ...(input.stripeSessionId
            ? { stripeSessionId: input.stripeSessionId }
            : {}),
          ...(input.shippingCents != null
            ? { shippingCents: input.shippingCents }
            : {}),
        }
        set((s) => ({ orders: [order, ...s.orders] }))

        try {
          const saved = await apiCreateOrder({
            id: order.id,
            createdAt: order.createdAt,
            customer: order.customer,
            items: order.items,
            total: order.total,
            status: order.status,
            stripeSessionId: order.stripeSessionId,
            shippingCents: order.shippingCents,
          })
          set((s) => ({
            orders: mergeOrders(
              s.orders.filter((o) => o.id !== order.id),
              [saved],
            ),
            syncState: 'synced',
            syncError: null,
          }))
          return saved
        } catch {
          set({ syncState: 'error', syncError: 'Could not sync order to server' })
          return order
        }
      },

      placeOrderFromStripe: async (input) => {
        return get().placeOrder({
          id: stripeOrderId(input.sessionId),
          stripeSessionId: input.sessionId,
          customer: input.customer,
          items: input.items,
          total: input.total,
          shippingCents: input.shippingCents,
        })
      },

      setStatus: async (id, status) => {
        try {
          const updated = await apiUpdateOrderStatus(id, status)
          set((s) => ({
            orders: s.orders.map((o) => (o.id === id ? updated : o)),
            syncState: 'synced',
            syncError: null,
          }))
        } catch (error) {
          set({
            syncState: 'error',
            syncError: 'Could not save status — nothing was changed',
          })
          throw error
        }
      },

      setTracking: async (id, tracking) => {
        const carrier = tracking.carrier.trim()
        const trackingNumber = tracking.trackingNumber.trim()

        try {
          const patch = {
            trackingCarrier: carrier || null,
            trackingNumber: trackingNumber || null,
          }
          const updated = await apiPatchOrder(id, patch)
          set((s) => ({
            orders: s.orders.map((o) => (o.id === id ? updated : o)),
            syncState: 'synced',
            syncError: null,
          }))
        } catch (error) {
          set({
            syncState: 'error',
            syncError: 'Could not save tracking — nothing was changed',
          })
          throw error
        }
      },

      markShipped: async (id, tracking) => {
        const carrier = tracking.carrier.trim() || 'Other'
        const trackingNumber = tracking.trackingNumber.trim()
        if (!trackingNumber) throw new Error('Add a tracking number first.')
        const shippedAt = new Date().toISOString()

        try {
          const updated = await apiPatchOrder(id, {
            status: 'shipped',
            trackingCarrier: carrier,
            trackingNumber,
            shippedAt,
          })
          set((s) => ({
            orders: s.orders.map((o) => (o.id === id ? updated : o)),
            syncState: 'synced',
            syncError: null,
          }))
        } catch (error) {
          set({ syncState: 'error', syncError: 'Could not mark the order shipped.' })
          throw error
        }
      },

      setArchived: async (id, archived) => {
        try {
          const updated = await apiPatchOrder(id, {
            archivedAt: archived ? new Date().toISOString() : null,
          })
          set((s) => ({
            orders: s.orders.map((o) => (o.id === id ? updated : o)),
            syncState: 'synced',
            syncError: null,
          }))
        } catch (error) {
          set({
            syncState: 'error',
            syncError: archived
              ? 'Could not archive order — nothing was changed'
              : 'Could not restore order — nothing was changed',
          })
          throw error
        }
      },

      patchLocalOrder: (order) => {
        set((s) => ({
          orders: s.orders.map((o) => (o.id === order.id ? order : o)),
        }))
      },

      refreshTracking: async (id) => {
        const updated = await apiRefreshOrderTracking(id)
        set((s) => ({
          orders: s.orders.map((o) => (o.id === id ? updated : o)),
          syncState: 'synced',
          syncError: null,
        }))
        return updated
      },

      removeOrder: async (id) => {
        set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }))
        try {
          await apiDeleteOrder(id)
          set({ syncState: 'synced', syncError: null })
        } catch {
          set({
            syncState: 'error',
            syncError: 'Could not delete on server — removed locally',
          })
        }
      },
    }),
    {
      name: 'inkcredible-orders',
      partialize: (state) => ({ orders: state.orders }),
    },
  ),
)

export function ordersNewestFirst(orders: Order[]): Order[] {
  return [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'New',
  making: 'Making',
  ready: 'Ready',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
}

export const TRACKING_STATUS_LABEL: Record<TrackingStatus, string> = {
  unknown: 'Unknown',
  pre_transit: 'Pre-transit',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  exception: 'Exception',
  expired: 'Expired',
}

export function carrierTrackingUrl(
  carrier: string | undefined,
  trackingNumber: string,
): string {
  const n = trackingNumber.trim()
  const c = (carrier || '').trim().toLowerCase()
  if (c.includes('usps')) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`
  }
  if (c.includes('ups')) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`
  }
  if (c.includes('fedex')) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`
  }
  if (c.includes('dhl')) {
    return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(n)}`
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier || ''} ${n}`.trim())}`
}
