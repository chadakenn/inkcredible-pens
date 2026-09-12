import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ClipboardList, Download, Droplets, FileText, FolderOpen, Package, PackageCheck, RefreshCw, Sparkles, Truck } from 'lucide-react'
import { paidSalesSummary } from '../../lib/salesSummary'
import { activeOrderCounts, currentEasternMonth, monthlySalesReport } from '../../lib/managerReports'
import { ORDER_STATUS_LABEL, ordersNewestFirst, useOrders } from '../../store/orders'

const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function ManagerDashboard({
  onOpenOrders,
  onOpenOrder,
  onNavigate,
}: {
  onOpenOrders: () => void
  onOpenOrder: (id: string) => void
  onNavigate: (tab: 'quotes' | 'files' | 'products' | 'scents') => void
}) {
  const orders = useOrders((state) => state.orders)
  const hydrateFromApi = useOrders((state) => state.hydrateFromApi)
  const syncState = useOrders((state) => state.syncState)
  const [month, setMonth] = useState(() => currentEasternMonth())

  useEffect(() => { void hydrateFromApi() }, [hydrateFromApi])

  const counts = useMemo(() => activeOrderCounts(orders), [orders])
  const lifetime = useMemo(() => paidSalesSummary(orders), [orders])
  const report = useMemo(() => monthlySalesReport(orders, month), [orders, month])
  const recent = useMemo(() => ordersNewestFirst(orders.filter((order) => !order.archivedAt)).slice(0, 5), [orders])

  const exportMonthlyCsv = () => {
    const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const rows = [
      ['Order', 'Date', 'Customer', 'Email', 'Items', 'Paid total', 'Shipping collected'],
      ...report.orders.map((order) => [
        order.displayCode || order.id,
        order.createdAt,
        order.customer.name,
        order.customer.email,
        order.items.map((item) => `${item.name} x${item.qty}`).join('; '),
        order.total.toFixed(2),
        ((order.shippingCents || 0) / 100).toFixed(2),
      ]),
    ]
    const blob = new Blob([rows.map((row) => row.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `inkcredible-sales-${month}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const statusCards = [
    { label: 'New orders', count: counts.new, color: 'text-cyan border-cyan/40 bg-cyan/10', icon: ClipboardList },
    { label: 'Being made', count: counts.making, color: 'text-lavender border-lavender/40 bg-lavender/10', icon: Sparkles },
    { label: 'Ready to ship', count: counts.ready, color: 'text-amber-200 border-amber-300/40 bg-amber-300/10', icon: PackageCheck },
    { label: 'Shipped', count: counts.shipped, color: 'text-lime border-lime/40 bg-lime/10', icon: Truck },
  ]

  const quickLinks = [
    { label: 'Review quotes', detail: 'Price and send custom jobs', tab: 'quotes' as const, icon: FileText, color: 'text-lavender' },
    { label: 'Customer files', detail: 'Artwork, folders, and downloads', tab: 'files' as const, icon: FolderOpen, color: 'text-cyan' },
    { label: 'Edit products', detail: 'Listings, prices, and photos', tab: 'products' as const, icon: Package, color: 'text-lime' },
    { label: 'Freshie scents', detail: 'Keep available scents current', tab: 'scents' as const, icon: Droplets, color: 'text-pink' },
  ]

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-display text-2xl text-cream">Today at a glance</h3><p className="mt-1 text-sm text-mute">Live order counts from the server.</p></div>
      <button type="button" onClick={() => void hydrateFromApi()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-ink-2 px-4 text-sm font-extrabold text-cream">
        <RefreshCw className={`h-4 w-4 ${syncState === 'loading' ? 'animate-spin' : ''}`} /> Refresh
      </button>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {statusCards.map(({ label, count, color, icon: Icon }) => <button key={label} type="button" onClick={onOpenOrders} className={`group aspect-[1.15/1] min-h-32 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl ${color}`}><div className="flex items-start justify-between"><Icon className="h-6 w-6" /><ArrowRight className="h-4 w-4 opacity-40 transition group-hover:translate-x-1 group-hover:opacity-100" /></div><p className="mt-4 font-display text-4xl text-cream">{count}</p><p className="text-sm font-extrabold">{label}</p></button>)}
    </div>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {quickLinks.map(({ label, detail, tab, icon: Icon, color }) => <button key={tab} type="button" onClick={() => onNavigate(tab)} className="group min-h-28 rounded-xl border border-line bg-ink-2 p-4 text-left transition hover:border-cyan/50 hover:bg-ink"><Icon className={`h-6 w-6 ${color}`} /><p className="mt-3 font-extrabold text-cream">{label}</p><p className="mt-1 text-xs text-mute">{detail}</p></button>)}
    </section>

    <section className="rounded-xl border border-line bg-ink-2 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="font-display text-2xl text-cream">Monthly sales report</h3><p className="mt-1 text-sm text-mute">Paid Stripe orders only.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label><span className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-mute">Sales month</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="min-h-11 rounded-xl border border-line bg-ink px-3 text-sm text-cream [color-scheme:dark] outline-none focus:border-cyan" /></label>
          <button type="button" disabled={!report.orderCount} onClick={exportMonthlyCsv} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-lime/40 bg-lime/10 px-4 text-sm font-extrabold text-lime disabled:opacity-40"><Download className="h-4 w-4" /> Export CSV</button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-ink p-4"><p className="text-xs font-extrabold uppercase text-mute">Sales</p><p className="mt-1 font-display text-2xl text-lime">{money(report.revenue)}</p></div>
        <div className="rounded-2xl bg-ink p-4"><p className="text-xs font-extrabold uppercase text-mute">Orders</p><p className="mt-1 font-display text-2xl text-cream">{report.orderCount}</p></div>
        <div className="rounded-2xl bg-ink p-4"><p className="text-xs font-extrabold uppercase text-mute">Average order</p><p className="mt-1 font-display text-2xl text-cream">{money(report.averageOrder)}</p></div>
        <div className="rounded-2xl bg-ink p-4"><p className="text-xs font-extrabold uppercase text-mute">Shipping</p><p className="mt-1 font-display text-2xl text-cream">{money(report.shipping)}</p></div>
      </div>
      <p className="mt-4 text-sm text-mute">Lifetime paid sales: <strong className="text-cream">{money(lifetime.total)}</strong> across {lifetime.paidOrders} orders.</p>
    </section>

    <section className="rounded-xl border border-line bg-ink-2 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3"><div><h3 className="font-display text-2xl text-cream">Recent active orders</h3><p className="mt-1 text-sm text-mute">Tap one to open the full order.</p></div><button type="button" onClick={onOpenOrders} className="min-h-11 rounded-xl border border-line bg-ink px-4 text-sm font-extrabold text-cyan">View all</button></div>
      {recent.length ? <ul className="mt-4 space-y-2">{recent.map((order) => <li key={order.id}><button type="button" onClick={() => onOpenOrder(order.id)} className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-line bg-ink px-4 text-left hover:border-cyan/50"><span><strong className="block text-cream">{order.customer.name}</strong><span className="text-xs text-mute">{order.displayCode || order.id} · {ORDER_STATUS_LABEL[order.status]}</span></span><span className="font-display text-lime">{money(order.total)}</span></button></li>)}</ul> : <p className="mt-4 rounded-2xl border border-dashed border-line p-6 text-center text-mute">No active orders.</p>}
    </section>
  </div>
}
