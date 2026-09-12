import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, CheckCircle2, ChevronDown, ChevronUp, Download, ExternalLink, FileDown, Printer, RefreshCw, RotateCcw, Save, Search, Send, ShoppingCart, Trash2, Truck, X } from 'lucide-react'
import { formatBannerCartMeta } from '../../data/banners'
import { formatBusinessCardsCartMeta } from '../../data/businessCards'
import { formatThankYouCardsCartMeta } from '../../data/thankYouCards'
import { formatCanvasCartMeta } from '../../data/canvasPrints'
import { formatLogoCartMeta } from '../../data/logoStickers'
import type { Category, CustomLogoMeta, Product } from '../../data/products'
import { patchOrder, requestOrderProof } from '../../lib/ordersApi'
import { customPreviewSrc, downloadAdminArtwork, fetchAdminArtworkObjectUrl } from '../../lib/uploadCustomArtwork'
import { paidSalesSummary } from '../../lib/salesSummary'
import { buildPackingSlipHtml } from '../../lib/packingSlip'
import {
  ORDER_STATUS_LABEL,
  TRACKING_STATUS_LABEL,
  carrierTrackingUrl,
  ordersNewestFirst,
  useOrders,
  type Order,
  type OrderStatus,
  type TrackingStatus,
} from '../../store/orders'
import { useCart } from '../../store/cart'

const STATUS_BTNS: { id: OrderStatus; className: string }[] = [
  { id: 'new', className: 'bg-cyan text-ink' },
  { id: 'making', className: 'bg-lavender text-ink' },
  { id: 'ready', className: 'bg-amber-300 text-ink' },
  { id: 'shipped', className: 'bg-lime text-ink' },
  { id: 'cancelled', className: 'bg-pink text-white' },
]

const CARRIERS = ['USPS', 'UPS', 'FedEx', 'DHL', 'Other'] as const

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


function trackingChipClass(status?: TrackingStatus): string {
  switch (status) {
    case 'delivered':
      return 'bg-lime/15 text-lime'
    case 'out_for_delivery':
      return 'bg-cyan/15 text-cyan'
    case 'in_transit':
    case 'pre_transit':
      return 'bg-lavender/20 text-lavender'
    case 'exception':
    case 'expired':
      return 'bg-pink/20 text-pink'
    default:
      return 'bg-ink text-mute'
  }
}

function TrackingStatusChip({ order }: { order: Order }) {
  if (!order.trackingNumber) return null
  if (order.deliveredAt || order.trackingStatus === 'delivered') {
    return (
      <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-lime">
        Delivered
      </span>
    )
  }
  if (order.trackingStatus && order.trackingStatus !== 'unknown') {
    return (
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide ${trackingChipClass(order.trackingStatus)}`}
      >
        {TRACKING_STATUS_LABEL[order.trackingStatus]}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-lime">
      Tracked
    </span>
  )
}

function itemMetaLine(custom?: CustomLogoMeta): string | null {
  if (!custom) return null
  if (custom.type === 'photo-freshie') {
    return `${custom.photoFreshieSize || '3-inch round'} · Scent: ${custom.freshieScent || 'Not selected'}`
  }
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

function AdminArtThumb({
  preview,
  artUrl,
}: {
  preview?: string
  artUrl?: string
}) {
  const [src, setSrc] = useState(preview || '')
  const [large, setLarge] = useState(false)
  const [hoverPreview, setHoverPreview] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false
    setSrc(preview || '')
    // Paid-order artwork is moved into protected customer storage. Even when an
    // older cart preview is present, prefer the durable file fetched with the
    // Store Manager token so a stale preview URL cannot leave a broken image.
    if (!artUrl) return
    void fetchAdminArtworkObjectUrl(artUrl)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        revoked = url
        setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc('')
      })
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [preview, artUrl])
  if (!src) return null
  return (
    <>
    <button
      type="button"
      onClick={() => { setHoverPreview(null); setLarge(true) }}
      onMouseEnter={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        const width = 340
        const left = Math.min(window.innerWidth - width - 16, Math.max(16, box.right + 12))
        const top = Math.min(window.innerHeight - 380, Math.max(16, box.top - 90))
        setHoverPreview({ top, left })
      }}
      onMouseLeave={() => setHoverPreview(null)}
      onFocus={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        setHoverPreview({
          top: Math.min(window.innerHeight - 380, Math.max(16, box.top - 90)),
          left: Math.min(window.innerWidth - 356, Math.max(16, box.right + 12)),
        })
      }}
      onBlur={() => setHoverPreview(null)}
      title="Hover for preview · click to open full screen"
      className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line bg-ink-2 p-1 transition hover:border-cyan hover:shadow-[0_0_18px_rgba(34,211,238,0.35)]"
    >
      <img
        src={src}
        alt="Customer artwork preview"
        className="h-full w-full object-contain"
        onError={() => setSrc('')}
      />
    </button>
    {hoverPreview && createPortal(
      <div
        style={{ top: hoverPreview.top, left: hoverPreview.left }}
        className="pointer-events-none fixed z-[110] hidden w-[340px] rounded-2xl border border-cyan/50 bg-ink-2 p-3 shadow-2xl shadow-black/70 md:block"
      >
        <img src={src} alt="Larger customer artwork preview" className="max-h-[340px] w-full rounded-xl bg-white object-contain" />
        <p className="mt-2 text-center text-xs font-bold text-cyan">Click the thumbnail for full screen</p>
      </div>,
      document.body,
    )}
    {large && <div role="dialog" aria-modal="true" aria-label="Artwork preview" onClick={() => setLarge(false)} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
      <button type="button" onClick={() => setLarge(false)} className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-full bg-ink-2 text-cream"><X className="h-6 w-6" /></button>
      <img src={src} alt="Large customer artwork preview" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] max-w-[95vw] rounded-2xl bg-white object-contain" />
    </div>}
    </>
  )
}

function reorderProduct(order: Order, item: Order['items'][number], index: number): Product {
  const customType = item.custom?.type
  const category: Category = customType === 'canvas' ? 'Canvas' : customType === 'photo-freshie' ? 'Car Freshies' : customType ? 'Custom' : 'Pens'
  const art: Product['art'] = customType === 'canvas' ? 'pack' : customType === 'photo-freshie' ? 'freshie' : customType ? 'sticker' : 'pen'
  return {
    id: `${item.productId || `reorder-${order.id}-${index}`}__reorder__${Date.now()}-${index}`,
    name: item.name,
    category,
    price: item.price,
    tagline: `Reorder from ${order.displayCode || order.id}`,
    description: `Reorder using the saved details and artwork from ${order.displayCode || order.id}.`,
    accent: '#26d9ff',
    art,
    custom: item.custom ? { ...item.custom } : undefined,
  }
}

function OrderCard({
  order,
  expanded,
  onToggle,
  archived,
}: {
  order: Order
  expanded: boolean
  onToggle: () => void
  archived: boolean
}) {
  const setStatus = useOrders((s) => s.setStatus)
  const setTracking = useOrders((s) => s.setTracking)
  const markShipped = useOrders((s) => s.markShipped)
  const refreshTracking = useOrders((s) => s.refreshTracking)
  const removeOrder = useOrders((s) => s.removeOrder)
  const setArchived = useOrders((s) => s.setArchived)
  const patchLocalOrder = useOrders((s) => s.patchLocalOrder)
  const addCartItem = useCart((s) => s.addItem)
  const openCart = useCart((s) => s.openCart)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [carrier, setCarrier] = useState(order.trackingCarrier || 'USPS')
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '')
  const [trackingSaving, setTrackingSaving] = useState(false)
  const [trackingRefreshing, setTrackingRefreshing] = useState(false)
  const [trackingMsg, setTrackingMsg] = useState<string | null>(null)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [productionNotes, setProductionNotes] = useState(order.productionNotes || '')
  const [proofMessage, setProofMessage] = useState(order.proofMessage || '')
  const [workflowBusy, setWorkflowBusy] = useState(false)

  const printPackingSlip = () => {
    const popup = window.open('', '_blank', 'width=900,height=760')
    if (!popup) {
      window.alert('Your browser blocked the packing slip window. Allow pop-ups for this site and try again.')
      return
    }
    popup.opener = null
    popup.document.open()
    popup.document.write(buildPackingSlipHtml(order, itemMetaLine))
    popup.document.close()
    popup.focus()
  }

  useEffect(() => {
    setCarrier(order.trackingCarrier || 'USPS')
    setTrackingNumber(order.trackingNumber || '')
  }, [order.id, order.trackingCarrier, order.trackingNumber])

  useEffect(() => {
    setProductionNotes(order.productionNotes || '')
    setProofMessage(order.proofMessage || '')
  }, [order.id, order.productionNotes, order.proofMessage])

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
                  : order.status === 'making'
                    ? 'bg-lavender/20 text-lavender'
                    : order.status === 'ready'
                      ? 'bg-amber-300/20 text-amber-200'
                      : order.status === 'shipped'
                      ? 'bg-lime/20 text-lime'
                      : 'bg-pink/20 text-pink'
              }`}
            >
              {ORDER_STATUS_LABEL[order.status]}
            </span>
            <span className="text-xs text-mute">{formatWhen(order.createdAt)} ET</span>
            <TrackingStatusChip order={order} />
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
            <p className="mt-2 text-[11px] text-mute">Order code: {order.displayCode || order.id}</p>
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
                      {(preview || artUrl) && (
                        <AdminArtThumb preview={preview} artUrl={artUrl} />
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
                          <button
                            type="button"
                            onClick={() => {
                              void downloadAdminArtwork(artUrl, downloadName).catch((err) => {
                                window.alert(err instanceof Error ? err.message : 'Download failed')
                              })
                            }}
                            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan/40 bg-cyan/10 px-3 text-xs font-extrabold text-cyan transition hover:bg-cyan/20"
                          >
                            <Download className="h-3.5 w-3.5" /> Download print file
                          </button>
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

          <div className="rounded-2xl border border-lavender/35 bg-ink p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-lavender">Artwork &amp; production</p>
                <p className="mt-1 text-sm text-mute">Save shop notes, send a proof, or rebuild this job in the cart.</p>
              </div>
              {order.proofStatus === 'approved' ? <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/15 px-3 py-1 text-xs font-extrabold text-lime"><CheckCircle2 className="h-4 w-4" /> Approved {order.proofApprovedAt ? formatWhen(order.proofApprovedAt) : ''}</span> : order.proofStatus === 'pending' ? <span className="rounded-full bg-lavender/20 px-3 py-1 text-xs font-extrabold text-lavender">Proof emailed · waiting</span> : null}
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-bold text-mute">Production notes (manager only)</span>
              <textarea value={productionNotes} onChange={(event) => setProductionNotes(event.target.value)} maxLength={4000} placeholder="Material, dimensions, print settings, finishing, scent, or special instructions…" className="min-h-24 w-full rounded-xl border border-line bg-ink-2 p-3 text-sm text-cream outline-none placeholder:text-mute focus:border-cyan" />
            </label>
            <button type="button" disabled={workflowBusy} onClick={() => {
              setWorkflowBusy(true); setTrackingMsg(null)
              void patchOrder(order.id, { productionNotes }).then((updated) => { patchLocalOrder(updated); setTrackingMsg('Production notes saved.') }).catch((error) => setTrackingMsg(error instanceof Error ? error.message : 'Could not save notes.')).finally(() => setWorkflowBusy(false))
            }} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan/40 bg-cyan/10 px-3 text-sm font-extrabold text-cyan disabled:opacity-50"><Save className="h-4 w-4" /> Save production notes</button>

            {(order.items || []).some((item) => item.custom?.archivedArtworkPath || item.custom?.logoDataUrl) && <div className="mt-4 border-t border-line pt-4">
              <label className="block"><span className="mb-1.5 block text-xs font-bold text-mute">Message with proof email (optional)</span><textarea value={proofMessage} onChange={(event) => setProofMessage(event.target.value)} maxLength={1000} placeholder="Please check the spelling and layout…" className="min-h-20 w-full rounded-xl border border-line bg-ink-2 p-3 text-sm text-cream outline-none placeholder:text-mute focus:border-lavender" /></label>
              <button type="button" disabled={workflowBusy || order.proofStatus === 'approved'} onClick={() => {
                if (!window.confirm(order.proofStatus === 'pending' ? 'Send this proof email again?' : 'Email this artwork proof to the customer?')) return
                setWorkflowBusy(true); setTrackingMsg(null)
                void requestOrderProof(order.id, proofMessage).then(({ order: updated }) => { patchLocalOrder(updated); setTrackingMsg('Proof email queued for the customer.') }).catch((error) => setTrackingMsg(error instanceof Error ? error.message : 'Could not send proof.')).finally(() => setWorkflowBusy(false))
              }} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-lavender px-4 text-sm font-extrabold text-ink disabled:opacity-40"><Send className="h-4 w-4" /> {order.proofStatus === 'pending' ? 'Resend proof email' : order.proofStatus === 'approved' ? 'Artwork approved' : 'Email proof for approval'}</button>
            </div>}

            <button type="button" onClick={() => {
              order.items.forEach((item, index) => addCartItem(reorderProduct(order, item, index), item.qty))
              openCart()
              setTrackingMsg('Reorder added to the cart with saved details and artwork.')
            }} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-lime/40 bg-lime/10 px-4 text-sm font-extrabold text-lime"><ShoppingCart className="h-4 w-4" /> Reorder this job</button>
          </div>

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
                  })
                    .then(() => {
                      setTrackingMsg('Tracking saved — customer has not been emailed yet')
                      window.setTimeout(() => setTrackingMsg(null), 2500)
                    })
                    .catch((error) => {
                      setTrackingMsg(error instanceof Error ? error.message : 'Could not save tracking')
                    })
                    .finally(() => setTrackingSaving(false))
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-lime px-4 text-sm font-extrabold text-ink transition hover:bg-lime-hot disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save tracking only
              </button>
              <button
                type="button"
                disabled={trackingSaving || !trackingNumber.trim()}
                onClick={() => {
                  setTrackingSaving(true)
                  setTrackingMsg(null)
                  void markShipped(order.id, {
                    carrier: carrier.trim() || 'Other',
                    trackingNumber: trackingNumber.trim(),
                  })
                    .then(() => {
                      setTrackingMsg('Marked shipped — customer email queued')
                      window.setTimeout(() => setTrackingMsg(null), 3500)
                    })
                    .catch((error) => {
                      setTrackingMsg(error instanceof Error ? error.message : 'Could not mark shipped')
                    })
                    .finally(() => setTrackingSaving(false))
                }}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan px-4 text-sm font-extrabold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Truck className="h-4 w-4" />
                Mark shipped &amp; email customer
              </button>
              {order.trackingNumber ? (
                <>
                  <button
                    type="button"
                    disabled={trackingRefreshing}
                    onClick={() => {
                      setTrackingRefreshing(true)
                      setTrackingMsg(null)
                      void refreshTracking(order.id)
                        .then((updated) => {
                          const label =
                            updated.trackingStatus === 'delivered' || updated.deliveredAt
                              ? 'Delivered'
                              : updated.trackingStatus
                                ? TRACKING_STATUS_LABEL[updated.trackingStatus]
                                : 'Updated'
                          setTrackingMsg(label)
                          window.setTimeout(() => setTrackingMsg(null), 2500)
                        })
                        .catch((err) => {
                          const code =
                            err && typeof err === 'object' && 'code' in err
                              ? String((err as { code: string }).code)
                              : ''
                          setTrackingMsg(
                            code === 'tracking_not_configured'
                              ? 'Tracking not configured (set TRACK17_API_KEY)'
                              : err instanceof Error
                                ? err.message
                                : 'Refresh failed',
                          )
                        })
                        .finally(() => setTrackingRefreshing(false))
                    }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-ink-2 px-3 text-xs font-extrabold text-cream transition hover:border-cyan disabled:opacity-40"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${trackingRefreshing ? 'animate-spin' : ''}`}
                    />
                    Refresh tracking
                  </button>
                  <a
                    href={carrierTrackingUrl(order.trackingCarrier, order.trackingNumber)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan/40 bg-cyan/10 px-3 text-xs font-extrabold text-cyan transition hover:bg-cyan/20"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Track package
                  </a>
                </>
              ) : null}
              {trackingMsg && (
                <span className="text-xs font-bold text-lime">{trackingMsg}</span>
              )}
            </div>
            {(order.trackingStatus || order.trackingDetail || order.trackingCheckedAt) && (
              <div className="mt-3 rounded-xl border border-line/80 bg-ink-2 px-3 py-2 text-[11px] text-mute">
                <p className="flex flex-wrap items-center gap-2 font-bold text-cream">
                  Status:{' '}
                  {order.trackingStatus
                    ? TRACKING_STATUS_LABEL[order.trackingStatus]
                    : 'Pending'}
                  {(order.deliveredAt || order.trackingStatus === 'delivered') && (
                    <span className="rounded-full bg-lime/20 px-2 py-0.5 text-[10px] font-extrabold uppercase text-lime">
                      Delivered
                    </span>
                  )}
                </p>
                {order.trackingDetail && (
                  <p className="mt-1 text-mute">{order.trackingDetail}</p>
                )}
                {order.trackingCheckedAt && (
                  <p className="mt-1 text-mute">
                    Last checked {formatWhen(order.trackingCheckedAt)} ET
                  </p>
                )}
                {order.deliveredAt && (
                  <p className="mt-1 text-lime">
                    Delivered {formatWhen(order.deliveredAt)} ET
                  </p>
                )}
              </div>
            )}
            {order.shippedAt && (
              <p className="mt-2 text-[11px] text-mute">
                Shipped {formatWhen(order.shippedAt)} ET
                {order.trackingCarrier ? ` · ${order.trackingCarrier}` : ''}
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-mute">
              Order progress
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {STATUS_BTNS.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => {
                    if (btn.id === 'shipped') {
                      if (!trackingNumber.trim()) {
                        setTrackingMsg('Add a tracking number before marking this shipped.')
                        return
                      }
                      setTrackingSaving(true)
                      setTrackingMsg(null)
                      void markShipped(order.id, {
                        carrier: carrier.trim() || 'Other',
                        trackingNumber: trackingNumber.trim(),
                      })
                        .then(() => setTrackingMsg('Marked shipped — customer email queued'))
                        .catch((error) => setTrackingMsg(error instanceof Error ? error.message : 'Could not mark shipped'))
                        .finally(() => setTrackingSaving(false))
                      return
                    }
                    setTrackingSaving(true)
                    setTrackingMsg(null)
                    void setStatus(order.id, btn.id)
                      .then(() => {
                        setTrackingMsg(`Order marked ${ORDER_STATUS_LABEL[btn.id].toLowerCase()}`)
                        window.setTimeout(() => setTrackingMsg(null), 2500)
                      })
                      .catch((error) => {
                        setTrackingMsg(error instanceof Error ? error.message : 'Could not save status')
                      })
                      .finally(() => setTrackingSaving(false))
                  }}
                  disabled={trackingSaving}
                  className={`min-h-12 rounded-2xl px-2 text-sm font-extrabold transition active:scale-[0.98] ${
                    order.status === btn.id
                      ? btn.className
                      : 'border border-line bg-ink text-mute hover:text-cream disabled:opacity-40'
                  }`}
                >
                  {ORDER_STATUS_LABEL[btn.id]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={printPackingSlip} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-cyan/40 bg-cyan/10 px-4 text-base font-extrabold text-cyan sm:w-auto">
              <Printer className="h-4 w-4" /> Print packing slip
            </button>
            <button
              type="button"
              disabled={archiveBusy}
              onClick={() => {
                setArchiveBusy(true)
                setTrackingMsg(null)
                void setArchived(order.id, !archived)
                  .catch((error) => setTrackingMsg(error instanceof Error ? error.message : 'Could not update archive'))
                  .finally(() => setArchiveBusy(false))
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-lime px-4 text-base font-extrabold text-ink disabled:opacity-50 sm:w-auto"
            >
              {archived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {archived ? 'Restore to active orders' : 'Complete & archive'}
            </button>
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
  const [searchParams] = useSearchParams()
  const requestedOrder = searchParams.get('order')
  const orders = useOrders((s) => s.orders)
  const syncState = useOrders((s) => s.syncState)
  const syncError = useOrders((s) => s.syncError)
  const hydrateFromApi = useOrders((s) => s.hydrateFromApi)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [view, setView] = useState<'active' | 'archive'>('active')
  const [query, setQuery] = useState('')
  const [month, setMonth] = useState('')

  const activeCount = orders.filter((order) => !order.archivedAt).length
  const archiveCount = orders.length - activeCount
  const sales = useMemo(() => paidSalesSummary(orders), [orders])
  const sorted = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return ordersNewestFirst(orders).filter((order) => {
      if (view === 'archive' ? !order.archivedAt : Boolean(order.archivedAt)) return false
      if (month && !String(order.createdAt).startsWith(month)) return false
      if (!needle) return true
      const haystack = [
        order.id,
        order.displayCode,
        order.customer.name,
        order.customer.email,
        order.trackingNumber,
        ...order.items.flatMap((item) => [item.name, JSON.stringify(item.custom || {})]),
      ].join(' ').toLowerCase()
      return haystack.includes(needle)
    })
  }, [orders, view, query, month])

  const exportArchive = () => {
    const rows = ordersNewestFirst(orders.filter((order) => order.archivedAt))
    const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
    const lines = [
      ['Order', 'Ordered', 'Completed', 'Customer', 'Email', 'Items', 'Total', 'Carrier', 'Tracking'],
      ...rows.map((order) => [
        order.displayCode || order.id,
        order.createdAt,
        order.archivedAt || '',
        order.customer.name,
        order.customer.email,
        order.items.map((item) => `${item.name} x${item.qty}`).join('; '),
        order.total.toFixed(2),
        order.trackingCarrier || '',
        order.trackingNumber || '',
      ]),
    ]
    const blob = new Blob([lines.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `inkcredible-completed-orders-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    void hydrateFromApi()
  }, [hydrateFromApi])

  useEffect(() => {
    if (!requestedOrder) return
    const requested = orders.find((order) => order.id === requestedOrder)
    if (!requested) return
    setView(requested.archivedAt ? 'archive' : 'active')
    setExpandedId(requested.id)
  }, [orders, requestedOrder])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base text-mute">
          Newest first from the <span className="font-bold text-cream">server</span>. Tap an order to expand, change status, or delete.
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
          {syncState === 'synced' && 'Synced (server)'}
          {syncState === 'loading' && 'Syncing…'}
          {syncState === 'error' && 'Offline — cache only'}
          {syncState === 'idle' && 'Not synced'}
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
          {syncError || 'Could not reach orders API'} — showing temporary local cache only. When Synced, Store Manager shows server orders only (no laptop demo ghosts).
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-lime/40 bg-lime/10 p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-lime">Total paid sales</p>
          <p className="mt-1 font-display text-3xl text-cream">
            {sales.total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </p>
          <p className="mt-1 text-xs text-mute">All paid Stripe orders · includes shipping</p>
        </div>
        <div className="rounded-2xl border border-cyan/40 bg-cyan/10 p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-cyan">Paid orders</p>
          <p className="mt-1 font-display text-3xl text-cream">{sales.paidOrders}</p>
          <p className="mt-1 text-xs text-mute">Active and completed</p>
        </div>
        <div className="rounded-2xl border border-lavender/40 bg-lavender/10 p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-lavender">Completed</p>
          <p className="mt-1 font-display text-3xl text-cream">{sales.archivedOrders}</p>
          <p className="mt-1 text-xs text-mute">Orders in the archive</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-ink p-1.5">
        <button type="button" onClick={() => { setView('active'); setExpandedId(null) }} className={`min-h-12 rounded-xl text-sm font-extrabold ${view === 'active' ? 'bg-cyan text-ink' : 'text-mute'}`}>
          Active orders ({activeCount})
        </button>
        <button type="button" onClick={() => { setView('archive'); setExpandedId(null) }} className={`min-h-12 rounded-xl text-sm font-extrabold ${view === 'archive' ? 'bg-lime text-ink' : 'text-mute'}`}>
          Completed archive ({archiveCount})
        </button>
      </div>

      <div className="mt-3 grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <label>
          <span className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-mute">Search orders</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer, order, item, or tracking…" className="min-h-12 w-full rounded-xl border border-line bg-ink pl-10 pr-3 text-sm text-cream outline-none focus:border-cyan" />
          </span>
        </label>
        <label>
          <span className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-mute">Order month</span>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="min-h-12 min-w-44 rounded-xl border border-line bg-ink px-3 text-sm text-cream [color-scheme:dark] outline-none focus:border-cyan" />
        </label>
        {(query || month) && (
          <button type="button" onClick={() => { setQuery(''); setMonth('') }} className="min-h-12 rounded-xl border border-line bg-ink px-4 text-sm font-extrabold text-cream hover:border-cyan">
            Clear filters
          </button>
        )}
        {view === 'archive' && <button type="button" onClick={exportArchive} disabled={archiveCount === 0} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-lime/40 bg-lime/10 px-4 text-sm font-extrabold text-lime disabled:opacity-40"><FileDown className="h-4 w-4" /> Export CSV</button>}
      </div>

      {(query || month) && <p className="mt-2 text-sm text-mute">Showing {sorted.length} matching order{sorted.length === 1 ? '' : 's'}.</p>}

      {sorted.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-ink-2 px-6 py-16 text-center">
          <p className="font-display text-2xl text-cream">{view === 'archive' ? 'No completed orders found.' : 'No active orders found.'}</p>
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
              archived={view === 'archive'}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
