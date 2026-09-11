export interface SalesOrder {
  total: number
  paid?: boolean
  stripeSessionId?: string
  archivedAt?: string
}

export function paidSalesSummary(orders: SalesOrder[]): {
  total: number
  paidOrders: number
  archivedOrders: number
} {
  const paid = orders.filter((order) => order.paid === true || Boolean(order.stripeSessionId))
  return {
    total: paid.reduce((sum, order) => sum + Math.max(0, Number(order.total) || 0), 0),
    paidOrders: paid.length,
    archivedOrders: paid.filter((order) => Boolean(order.archivedAt)).length,
  }
}
