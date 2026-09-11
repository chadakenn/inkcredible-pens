export interface ReportOrder {
  id: string
  displayCode?: string
  createdAt: string
  total: number
  paid?: boolean
  stripeSessionId?: string
  shippingCents?: number
  archivedAt?: string
  status: 'new' | 'making' | 'ready' | 'shipped' | 'cancelled'
  customer: { name: string; email: string }
  items: { name: string; qty: number }[]
}

export function orderMonthKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(iso))
  const year = parts.find((part) => part.type === 'year')?.value || ''
  const month = parts.find((part) => part.type === 'month')?.value || ''
  return `${year}-${month}`
}

export function currentEasternMonth(now = new Date()): string {
  return orderMonthKey(now.toISOString())
}

export function isPaidOrder(order: ReportOrder): boolean {
  return order.paid === true || Boolean(order.stripeSessionId)
}

export function monthlySalesReport(orders: ReportOrder[], month: string) {
  const paidOrders = orders.filter((order) => isPaidOrder(order) && orderMonthKey(order.createdAt) === month)
  const revenue = paidOrders.reduce((sum, order) => sum + Math.max(0, Number(order.total) || 0), 0)
  const shipping = paidOrders.reduce((sum, order) => sum + Math.max(0, Number(order.shippingCents) || 0) / 100, 0)
  return {
    orders: paidOrders,
    revenue,
    orderCount: paidOrders.length,
    averageOrder: paidOrders.length ? revenue / paidOrders.length : 0,
    shipping,
  }
}

export function activeOrderCounts(orders: ReportOrder[]) {
  const active = orders.filter((order) => !order.archivedAt && order.status !== 'cancelled')
  return {
    new: active.filter((order) => order.status === 'new').length,
    making: active.filter((order) => order.status === 'making').length,
    ready: active.filter((order) => order.status === 'ready').length,
    shipped: active.filter((order) => order.status === 'shipped').length,
  }
}
