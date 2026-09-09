import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, Download, Trash2, RefreshCw, Truck, ExternalLink } from 'lucide-react'
import { formatBannerCartMeta } from '../../data/banners'
import { formatBusinessCardsCartMeta } from '../../data/businessCards'
import { formatThankYouCardsCartMeta } from '../../data/thankYouCards'
import { formatCanvasCartMeta } from '../../data/canvasPrints'
import { formatLogoCartMeta } from '../../data/logoStickers'
import type { CustomLogoMeta } from '../../data/products'
import { customPreviewSrc } from '../../lib/uploadCustomArtwork'
import {
  ORDER_STATUS_LABEL,
  ordersNewestFirst,
  useOrders,
  type Order,
  type OrderStatus,
} from '../../store/orders'

const STATUS_BTNS: { id: OrderStatus; className: string }[] = [
  { id: 'new', className: 'bg-cyan text-ink' },
  { id: 'in_progress', className: 'bg-lavender text-ink' },
  { id: 'done', className: 'bg-lime text-ink' },
  { id: 'cancelled', className: 'bg-pink text-white' },
]

const CARRIERS = ['USPS', 'UPS', 'FedEx', 'Other'] as const

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function itemMetaLine(custom?: CustomLogoMeta): string | null {
  if (!custom) return null
  if (custom.type === 'banner') {
    return formatBannerCartMeta(custom.bannerSizeLabel, custom.bannerSides)
  }
  if (custom.type === 'canvas') {
    return formatCanvasCartMeta(custom.canvasSizeLabel, custom.canvasFinish)
  }
  if (custom.type === 'thank-you-cards') {
    return formatThankYouCardsCartMeta(custom.cardPackQty)
  }
  if (custom.type === 'business-cards' || custom.cardPackQty != null) {
    return formatBusinessCardsCartMeta(custom.cardPackQty)
  }
  if (custom.style) {
    return formatLogoCartMeta(custom.style, custom.cut, custom.stickerQty, custom.stickerSizeId ?? custom.stickerSize)
  }
  if (custom.freshieScent) return `Scent: ${custom.freshieScent}`
  return null
}

function OrderCard({
  order,
  expanded,
  onToggle,
}: {
  order: Order
  expanded: boolean
  onToggle: () => void
}) {
  const setStatus = useOrders((s) => s.setStatus)
  const setTracking = useOrders((s) => s.setTracking)
  const removeOrder = useOrders((s) => s.removeOrder)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [carrier, setCarrier] = useState(order.trackingCarrier || 'USPS')
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '')
  const [trackingSaving, setTrackingSaving] = useState(false)
  const [trackingMsg, setTrackingMsg] = useState<string | null>(null)

  useEffect(() => {
    setCarrier(order.trackingCarrier || 'USPS')
    setTrackingNumber(order.trackingNumber || '')
  }, [order.id, order.trackingCarrier, order.trackingNumber])

  return (
    <li className="overflow-hidden rounded-3xl border border-line bg-ink-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left sm:p-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${
                order.status === 'new'
                  ? 'bg-cyan/20 text-cyan'
                  : order.status === 'in_progress'
                    ? 'bg-lavender/20 text-lavender'
                    : order.status === 'done'
                      ? 'bg-lime/20 text-lime'
                      : 'bg-pink/20 text-pink'
              }`}
            >
              {ORDER_STATUS_LABEL[order.status]}
            </span>
            <span className="text-xs text-mute">{formatWhen(order.createdAt)} ET</span>
            {order.trackingNumber ? (
              <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-lime">
                Tracked
              </span>
            ) : null}
          </div>
          <p className="mt-1 font-display text-xl text-cream">{order.customer.name}</p>
          <p className="truncate text-sm text-mute">{order.customer.email}</p>
          <p className="mt-1 text-sm font-extrabold text-lime">
            ${order.total.toFixed(2)} · {order.items.reduce((n, i) => n + i.qty, 0)} item
            {order.items.reduce((n, i) => n + i.qty, 0) === 1 ? '' : 's'}
          </p>
        </div>
        <span className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-mute">
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-line px-4 pb-5 pt-4 sm:px-5">
          <div className="rounded-2xl border border-line bg-ink p-4 text-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-mute">Customer</p>
            <p className="mt-1 font-bold text-cream">{order.customer.name}</p>
            <p className="text-mute">{order.customer.email}</p>
            <p className="mt-2 text-mute">
              {order.customer.address}
              <br />
              {order.customer.city}, {order.customer.state} {order.customer.zip}
            </p>
            <p className="mt-2 text-[11px] text-mute">Order ID: {order.id}</p>
          </div>

          <ul className="space-y-2">
            {order.items.map((item, idx) => {
              const meta = itemMetaLine(item.custom)
              const preview = customPreviewSrc(item.custom)
              const artUrl = item.custom?.artworkUrl
              const downloadName =
                item.custom?.artworkFileName || item.custom?.fileName || 'artwork'
              return (
                <li
                  key={`${order.id}-${idx}`}
                  className="rounded-2xl border border-line bg-ink px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      {preview && (
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-ink-2 p-1">
                          <img
                            src={preview}
                            alt=""
                            className="h-full w-full object-contain"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-cream">{item.name}</p>
                        {meta && <p className="text-xs text-mute">{meta}</p>}
                        {item.custom?.bannerNotes && (
                          <p className="mt-0.5 text-[11px] text-mute">
                            Notes: {item.custom.bannerNotes}
                          </p>
                        )}
                        {item.custom?.canvasNotes && (
                          <p className="mt-0.5 text-[11px] text-mute">
                            Notes: {item.custom.canvasNotes}
                          </p>
                        )}
                        {item.custom?.cardNotes && (
                          <p className="mt-0.5 text-[11px] text-mute">
                            Notes: {item.custom.cardNotes}
                          </p>
                        )}
                        {item.custom?.estimateOnly && (
                          <p className="mt-0.5 text-[11px] font-bold text-lavender">
                            Estimate — final quote by email
                          </p>
                        )}
                        {artUrl ? (
                          <a
                            href={`${artUrl}?download=1`}
                            download={downloadName}
                            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan/40 bg-cyan/10 px-3 text-xs font-extrabold text-cyan transition hover:bg-cyan/20"
                          >
                            <Download className="h-3.5 w-3.5" /> Download print file
                          </a>
                        ) : item.custom?.logoComingByEmail ? (
                          <p className="mt-1 text-[11px] font-bold text-lavender">
                            Customer will email artwork
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-mute">Qty {item.qty}</p>
                      </div>
                    </div>
                    <p className="shrink-0 font-display text-lime">
                      ${(item.price * item.qty).toFixed(2)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="rounded-2xl border border-line bg-ink p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-mute">
              <Truck className="h-3.5 w-3.5 text-cyan" />
              Shipping tracking
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-mute">Carrier</span>
                <select
                  value={CARRIERS.includes(carrier as (typeof CARRIERS)[number]) ? carrier : 'Other'}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === 'Other') {
                      setCarrier(
                        order.trackingCarrier &&
                          !CARRIERS.includes(order.trackingCarrier as (typeof CARRIERS)[number])
                          ? order.trackingCarrier
                          : 'Other',
                      )
                    } else {
                      setCarrier(v)
                    }
                  }}
                  className="min-h-12 w-full rounded-xl border border-line bg-ink-2 px-3 text-sm font-bold text-cream outline-none focus:border-cyan"
                >
                  {CARRIERS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {(carrier === 'Other' ||
                  !CARRIERS.includes(carrier as (typeof CARRIERS)[number])) && (
                  <input
                    type="text"
                    value={carrier === 'Other' ? '' : carrier}
                    onChange={(e) => setCarrier(e.target.value || 'Other')}
                    placeholder="Carrier name"
                    className="mt-2 min-h-11 w-full rounded-xl border border-line bg-ink-2 px-3 text-sm font-bold text-cream outline-none placeholder:text-mute focus:border-cyan"
                  />
                )}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-mute">Tracking #</span>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Tracking number"
                  className="min-h-12 w-full rounded-xl border border-line bg-ink-2 px-3 text-sm font-bold text-cream outline-none placeholder:text-mute focus:border-cyan"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={trackingSaving || !trackingNumber.trim()}
                onClick={() => {
                  setTrackingSaving(true)
                  setTrackingMsg(null)
                  void setTracking(order.id, {
                    carrier: carrier.trim() || 'Other',
                    trackingNumber: trackingNumber.trim(),
                  }).finally(() => {
                    setTrackingSaving(false)
                    setTrackingMsg('Tracking saved')
                    window.setTimeout(() => setTrackingMsg(null), 2000)
                  })
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime px-4 text-sm font-extrabold text-ink transition hover:bg-lime-hot disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save tracking
              </button>
              {order.trackingNumber ? (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(
                    `${order.trackingCarrier ? order.trackingCarrier + ' ' : ''}${order.trackingNumber}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan/40 bg-cyan/10 px-3 text-xs font-extrabold text-cyan transition hover:bg-cyan/20"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Track package
                </a>
              ) : null}
              {trackingMsg && (
                <span className="text-xs font-bold text-lime">{trackingMsg}</span>
              )}
            </div>
            {order.shippedAt && (
              <p className="mt-2 text-[11px] text-mute">
                Shipped {formatWhen(order.shippedAt)} ET
                {order.trackingCarrier ? ` · ${order.trackingCarrier}` : ''}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-mute">
              Change status
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STATUS_BTNS.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => void setStatus(order.id, btn.id)}
                  className={`min-h-12 rounded-2xl px-2 text-sm font-extrabold transition active:scale-[0.98] ${
                    order.status === btn.id
                      ? btn.className
                      : 'border border-line bg-ink text-mute hover:text-cream'
                  }`}
                >
                  {ORDER_STATUS_LABEL[btn.id]}
                </button>
              ))}
            </div>
          </div>

          {confirmDelete ? (
            <div className="rounded-2xl border border-pink/40 bg-ink p-4">
              <p className="font-bold text-cream">Delete this order? Can&apos;t undo.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void removeOrder(order.id)}
                  className="min-h-12 flex-1 rounded-xl bg-pink px-4 text-base font-extrabold text-white"
                >
                  Yes, delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-12 flex-1 rounded-xl border border-line bg-ink-2 px-4 text-base font-extrabold text-cream"
                >
                  No, keep it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-pink/40 bg-ink px-4 text-base font-extrabold text-pink sm:w-auto"
            >
              <Trash2 className="h-4 w-4" /> Delete order
            </button>
          )}
        </div>
      )}
    </li>
  )
}

export default function OrdersPanel() {
  const orders = useOrders((s) => s.orders)
  const syncState = useOrders((s) => s.syncState)
  const syncError = useOrders((s) => s.syncError)
  const hydrateFromApi = useOrders((s) => s.hydrateFromApi)
  const sorted = useMemo(() => ordersNewestFirst(orders), [orders])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    void hydrateFromApi()
  }, [hydrateFromApi])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base text-mute">
          Newest first. Tap an order to expand, change status, or delete.
        </p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${
            syncState === 'synced'
              ? 'bg-lime/15 text-lime'
              : syncState === 'error'
                ? 'bg-pink/15 text-pink'
                : syncState === 'loading'
                  ? 'bg-cyan/15 text-cyan'
                  : 'bg-ink text-mute'
          }`}
          title={syncError || undefined}
        >
          {syncState === 'synced' && 'Synced'}
          {syncState === 'loading' && 'Syncing…'}
          {syncState === 'error' && 'Offline / API error'}
          {syncState === 'idle' && 'Local cache'}
        </span>
        <button
          type="button"
          onClick={() => void hydrateFromApi()}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-line bg-ink px-2.5 text-xs font-extrabold text-mute transition hover:text-cream"
          title="Refresh from server"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncState === 'loading' ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {syncState === 'error' && (
        <p className="mt-2 text-sm text-pink">
          {syncError || 'Could not reach orders API'} — showing local cache. Phone and laptop share orders when the server on 4242 is up.
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-ink-2 px-6 py-16 text-center">
          <p className="font-display text-2xl text-cream">No orders yet — place a test checkout.</p>
          <p className="mt-2 text-sm text-mute">
            Add something to the cart, go through checkout, then come back here.
          </p>
          <Link to="/shop" className="btn-primary mt-6 inline-flex min-h-12">
            Go to shop
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {sorted.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() =>
                setExpandedId((id) => (id === order.id ? null : order.id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}
