import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Copy, Check, Lock, ShoppingBag, Loader2 } from 'lucide-react'
import { sanitizeCustomMeta, customPreviewSrc } from '../lib/uploadCustomArtwork'
import { formatCustomCartMeta } from '../lib/customCartMeta'
import { useCart } from '../store/cart'
import {
  FREE_SHIPPING_THRESHOLD,
  shippingDollarsForSubtotal,
  isFreeShipping,
} from '../data/shipping'
import { useOrders } from '../store/orders'
import ProductArt from '../components/ProductArt'
import LogoMark from '../components/LogoMark'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

function PaymentIcons() {
  const labels = ['Visa', 'MC', 'Amex', 'Discover', 'Cash App', 'GPay']
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Accepted payment methods">
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex h-8 min-w-[3rem] items-center justify-center rounded-md border border-line bg-ink px-2 text-[10px] font-extrabold uppercase tracking-wide text-mute"
        >
          {label}
        </span>
      ))}
      <svg
        viewBox="0 0 32 22"
        className="h-8 w-11 text-mute"
        fill="none"
        aria-hidden
      >
        <rect x="1" y="1" width="30" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 7h30" stroke="currentColor" strokeWidth="1.5" />
        <rect x="5" y="12" width="8" height="4" rx="1" fill="currentColor" opacity="0.35" />
      </svg>
    </div>
  )
}

function OrderSuccessPanel({
  orderId,
  stripePaid,
  onCopy,
  copied,
}: {
  orderId: string
  stripePaid: boolean
  onCopy: () => void
  copied: boolean
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center sm:px-6 sm:py-20">
      <div className="animate-fade-up flex w-full flex-col items-center gap-4">
        <LogoMark size="md" />
        <CheckCircle2 className="h-14 w-14 text-lime drop-shadow-[0_0_20px_rgba(200,245,66,0.35)]" />
        <p className="rounded-full border border-lime/40 bg-lime/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-lime">
          {stripePaid ? 'Paid via Stripe (test mode)' : 'Order confirmed (demo)'}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl">Order vibes received</h1>
        <p className="text-mute">
          {stripePaid
            ? 'Stripe test Checkout completed — no live charges with test keys. Keep this code handy if you email us.'
            : 'Demo order only — nothing charged. Keep this code handy if you email us about it.'}
        </p>

        <div className="mt-2 w-full rounded-2xl border border-cyan/30 bg-ink-2 p-5 text-left shadow-[0_0_40px_rgba(34,211,238,0.08)]">
          <p className="text-xs font-extrabold uppercase tracking-wider text-cyan">
            Save this code
          </p>
          <p className="mt-2 break-all font-mono text-sm font-bold text-cream sm:text-base">
            {orderId}
          </p>
          <button type="button" onClick={onCopy} className="btn-ghost mt-4 min-h-11 w-full text-sm">
            {copied ? (
              <>
                <Check className="h-4 w-4 text-lime" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy order code
              </>
            )}
          </button>
          <p className="mt-3 text-[11px] leading-snug text-mute">
            Orders are managed in the studio admin — customers don&apos;t get an online order page. Email{' '}
            <a className="text-cyan underline" href="mailto:inkcredible.pens@gmail.com">
              inkcredible.pens@gmail.com
            </a>{' '}
            with this code if you need help.
          </p>
        </div>

        <p className="text-sm text-mute">
          Real shop:{' '}
          <a
            className="text-cyan underline"
            href="https://www.inkcrediblepens.org"
            target="_blank"
            rel="noreferrer"
          >
            inkcrediblepens.org
          </a>
        </p>
        <Link to="/" className="btn-primary mt-1">
          Back to shop
        </Link>
      </div>
    </div>
  )
}

export default function Checkout() {
  useDocumentTitle('Checkout')
  const [searchParams, setSearchParams] = useSearchParams()
  const { items, subtotal, clear } = useCart()
  const placeOrder = useOrders((s) => s.placeOrder)
  const placeOrderFromStripe = useOrders((s) => s.placeOrderFromStripe)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [stripePaid, setStripePaid] = useState(false)
  const [copied, setCopied] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [canceledBanner, setCanceledBanner] = useState(false)
  const [stripeReady, setStripeReady] = useState<boolean | null>(null)
  const [cartHydrated, setCartHydrated] = useState(() => useCart.persist.hasHydrated())
  const total = subtotal()
  const shippingEstimate = shippingDollarsForSubtotal(total)
  const freeShip = isFreeShipping(total)
  const grandTotal = total + shippingEstimate

  const successFlag = searchParams.get('success') === '1'
  const canceledFlag = searchParams.get('canceled') === '1'
  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    let cancelled = false
    fetch('/api/health')
      .then((r) => r.json())
      .then((data: { stripe?: boolean }) => {
        if (!cancelled) setStripeReady(Boolean(data.stripe))
      })
      .catch(() => {
        if (!cancelled) setStripeReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const unsub = useCart.persist.onFinishHydration(() => setCartHydrated(true))
    if (useCart.persist.hasHydrated()) setCartHydrated(true)
    return unsub
  }, [])

  useEffect(() => {
    if (canceledFlag) {
      setCanceledBanner(true)
      setSearchParams({}, { replace: true })
    }
  }, [canceledFlag, setSearchParams])

  useEffect(() => {
    if (!successFlag || orderId || !cartHydrated) return

    let cancelled = false

    type Draft = {
      email: string
      fullName: string
      address: string
      city: string
      state: string
      zip: string
      cartSnapshot?: { name: string; price: number; qty: number; custom?: import('../data/products').CustomLogoMeta }[]
    }

    let draft: Draft = {
      email: email.trim(),
      fullName: fullName.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
    }

    try {
      const raw = sessionStorage.getItem('inkcredible-checkout-draft')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Draft>
        draft = {
          email: String(parsed.email || draft.email),
          fullName: String(parsed.fullName || draft.fullName),
          address: String(parsed.address || draft.address),
          city: String(parsed.city || draft.city),
          state: String(parsed.state || draft.state),
          zip: String(parsed.zip || draft.zip),
          cartSnapshot: Array.isArray(parsed.cartSnapshot)
            ? parsed.cartSnapshot.map((row) => ({
                name: String(row.name || 'Item'),
                price: Number(row.price) || 0,
                qty: Math.max(1, Math.round(Number(row.qty) || 1)),
                custom: row.custom ? sanitizeCustomMeta(row.custom) : undefined,
              }))
            : undefined,
        }
        sessionStorage.removeItem('inkcredible-checkout-draft')
      }
    } catch {
      /* ignore */
    }

    const customerFrom = (d: Draft, emailFallback?: string | null) => ({
      email: d.email || emailFallback || 'stripe-checkout@unknown',
      name: d.fullName || 'Stripe customer',
      address: d.address,
      city: d.city,
      state: d.state,
      zip: d.zip,
    })

    const finish = (id: string) => {
      if (cancelled) return
      setOrderId(id)
      setStripePaid(true)
      clear()
      setSearchParams({}, { replace: true })
    }

    const placeFromItems = async (
      orderItems: {
        name: string
        price: number
        qty: number
        custom?: import('../data/products').CustomLogoMeta
      }[],
      orderTotal: number,
      cust: ReturnType<typeof customerFrom>,
    ) => {
      if (sessionId) {
        return placeOrderFromStripe({
          sessionId,
          customer: cust,
          items: orderItems,
          total: orderTotal,
        })
      }
      return placeOrder({
        customer: cust,
        items: orderItems,
        total: orderTotal,
      })
    }

    ;(async () => {
      try {
        // 1) Prefer live cart
        if (items.length > 0) {
          const orderItems = items.map(({ product, qty }) => ({
            name: product.name,
            price: product.price,
            qty,
            custom: sanitizeCustomMeta(product.custom),
          }))
          const order = await placeFromItems(
            orderItems,
            total + shippingDollarsForSubtotal(total),
            customerFrom(draft),
          )
          finish(order.id)
          return
        }

        // 2) sessionStorage cartSnapshot
        if (draft.cartSnapshot && draft.cartSnapshot.length > 0) {
          const snapSubtotal = draft.cartSnapshot.reduce(
            (sum, row) => sum + row.price * row.qty,
            0,
          )
          const snapTotal = snapSubtotal + shippingDollarsForSubtotal(snapSubtotal)
          const order = await placeFromItems(draft.cartSnapshot, snapTotal, customerFrom(draft))
          finish(order.id)
          return
        }

        // 3) Rebuild from Stripe session
        if (sessionId) {
          const res = await fetch(`/api/checkout-session/${encodeURIComponent(sessionId)}`)
          const data = (await res.json().catch(() => ({}))) as {
            payment_status?: string
            customer_email?: string | null
            amount_total?: number | null
            metadata?: Record<string, string>
            line_items?: {
              description?: string
              quantity?: number
              unit_amount?: number | null
              amount_total?: number | null
            }[]
            error?: string
          }
          if (!res.ok) {
            console.warn('[checkout] session retrieve failed', data.error || res.status)
          } else {
            let metaShipping = {
              address: draft.address,
              city: draft.city,
              state: draft.state,
              zip: draft.zip,
            }
            try {
              if (data.metadata?.shipping) {
                metaShipping = {
                  ...metaShipping,
                  ...(JSON.parse(data.metadata.shipping) as typeof metaShipping),
                }
              }
            } catch {
              /* ignore */
            }

            let metaItems: { name: string; price: number; qty: number }[] | null = null
            try {
              if (data.metadata?.cartJson) {
                const parsed = JSON.parse(data.metadata.cartJson) as {
                  name?: string
                  price?: number
                  qty?: number
                }[]
                if (Array.isArray(parsed) && parsed.length > 0) {
                  metaItems = parsed.map((row) => ({
                    name: String(row.name || 'Item'),
                    price: Number(row.price) || 0,
                    qty: Math.max(1, Math.round(Number(row.qty) || 1)),
                  }))
                }
              }
            } catch {
              /* ignore */
            }

            const lineItems =
              metaItems ??
              (data.line_items ?? []).map((li) => {
                const qty = Math.max(1, Math.round(Number(li.quantity) || 1))
                const unit =
                  li.unit_amount != null
                    ? li.unit_amount / 100
                    : li.amount_total != null
                      ? li.amount_total / 100 / qty
                      : 0
                return {
                  name: String(li.description || 'Item'),
                  price: unit,
                  qty,
                }
              })

            const cust = customerFrom(
              {
                ...draft,
                email: draft.email || String(data.metadata?.email || ''),
                fullName: draft.fullName || String(data.metadata?.fullName || ''),
                address: String(metaShipping.address || draft.address),
                city: String(metaShipping.city || draft.city),
                state: String(metaShipping.state || draft.state),
                zip: String(metaShipping.zip || draft.zip),
              },
              data.customer_email,
            )

            const orderTotal =
              data.amount_total != null
                ? data.amount_total / 100
                : lineItems.reduce((sum, row) => sum + row.price * row.qty, 0)

            if (lineItems.length > 0 || data.payment_status === 'paid') {
              const order = await placeFromItems(
                lineItems.length > 0
                  ? lineItems
                  : [{ name: 'Stripe payment', price: orderTotal, qty: 1 }],
                orderTotal,
                cust,
              )
              finish(order.id)
              return
            }
          }
        }

        // Fallback: still show success code so UI isn't stuck
        finish(sessionId ? `stripe-${sessionId}` : `stripe-${Date.now().toString(36)}`)
      } catch (err) {
        console.warn('[checkout] success rebuild failed', err)
        if (!cancelled) {
          finish(sessionId ? `stripe-${sessionId}` : `stripe-${Date.now().toString(36)}`)
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on success return after hydrate
  }, [successFlag, cartHydrated])

  const contactValid = useMemo(() => {
    return (
      email.trim().length > 3 &&
      fullName.trim().length > 0 &&
      address.trim().length > 0 &&
      city.trim().length > 0 &&
      state.trim().length > 0 &&
      zip.trim().length > 0
    )
  }, [email, fullName, address, city, state, zip])

  const buildLocalOrder = async () => {
    return placeOrder({
      customer: {
        email: email.trim(),
        name: fullName.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
      },
      items: items.map(({ product, qty }) => ({
        name: product.name,
        price: product.price,
        qty,
        custom: sanitizeCustomMeta(product.custom),
      })),
      total: grandTotal,
      shippingCents: Math.round(shippingEstimate * 100),
    })
  }

  const onDemoSubmit = (e: FormEvent) => {
    e.preventDefault()
    void (async () => {
      const order = await buildLocalOrder()
      setStripePaid(false)
      setOrderId(order.id)
      clear()
    })()
  }

  const onPayWithStripe = async () => {
    setPayError(null)
    if (!contactValid) {
      setPayError('Fill in contact and shipping before paying with Stripe.')
      return
    }
    setPaying(true)
    try {
      try {
        const cartSnapshot = items.map(({ product, qty }) => ({
          name: product.name,
          price: product.price,
          qty,
          custom: sanitizeCustomMeta(product.custom),
        }))
        sessionStorage.setItem(
          'inkcredible-checkout-draft',
          JSON.stringify({
            email: email.trim(),
            fullName: fullName.trim(),
            address: address.trim(),
            city: city.trim(),
            state: state.trim(),
            zip: zip.trim(),
            cartSnapshot,
          }),
        )
      } catch {
        /* ignore */
      }
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          fullName: fullName.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          zip: zip.trim(),
          returnOrigin: window.location.origin,
          cartSnapshot: items.map(({ product, qty }) => ({
            name: product.name,
            price: product.price,
            qty,
            custom: sanitizeCustomMeta(product.custom),
          })),
          shippingCents: Math.round(shippingEstimate * 100),
          items: items.map(({ product, qty }) => ({
            name: product.name,
            amountCents: Math.round(product.price * 100),
            quantity: qty,
            productId: product.id,
          })),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        url?: string
        error?: string
      }
      if (res.status === 503 || data.error === 'missing_stripe_key') {
        setPayError(
          'Stripe key not configured. Export STRIPE_SECRET_KEY=sk_test_... and run npm run stripe:server. See STRIPE.md.',
        )
        return
      }
      if (!res.ok || !data.url) {
        setPayError(data.error || `Checkout failed (${res.status})`)
        return
      }
      window.location.href = data.url
    } catch {
      setPayError(
        'Could not reach Stripe server. Start it with npm run stripe:server (port 4242).',
      )
    } finally {
      setPaying(false)
    }
  }

  const copyOrderId = async () => {
    if (!orderId) return
    try {
      await navigator.clipboard.writeText(orderId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  if (orderId) {
    return (
      <OrderSuccessPanel
        orderId={orderId}
        stripePaid={stripePaid}
        onCopy={copyOrderId}
        copied={copied}
      />
    )
  }

  if (items.length === 0 && !successFlag) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
        <ShoppingBag className="h-12 w-12 text-mute" />
        <h1 className="font-display text-3xl">Nothing in the cart</h1>
        <p className="text-mute">Grab a Fresh Out of Fks Pen and come back.</p>
        <Link to="/" className="btn-primary">
          Shop now
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Checkout</h1>
        <p className="mt-1 text-sm text-mute">
          Stripe <span className="font-bold text-cyan">test mode</span> — no live charges until you use
          live keys. See <code className="text-cream">STRIPE.md</code>.
        </p>

        {canceledBanner && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-pink/40 bg-pink/10 px-4 py-3 text-sm text-cream"
          >
            Payment canceled — try again.
          </div>
        )}

        {stripeReady === false && (
          <div className="mt-4 rounded-xl border border-lavender/40 bg-lavender/10 px-4 py-3 text-sm text-cream">
            Stripe server key not detected. Run{' '}
            <code className="text-cyan">export STRIPE_SECRET_KEY=sk_test_...</code> then{' '}
            <code className="text-cyan">npm run stripe:server</code>, or use the demo order button
            below.
          </div>
        )}

        <form onSubmit={onDemoSubmit} className="mt-8 space-y-4">
          <fieldset className="space-y-3 rounded-2xl border border-line bg-ink-2 p-5">
            <legend className="px-1 font-display text-lg">Contact</legend>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-cyan"
            />
            <input
              required
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-cyan"
            />
          </fieldset>

          <fieldset className="space-y-3 rounded-2xl border border-line bg-ink-2 p-5">
            <legend className="px-1 font-display text-lg">Shipping</legend>
            <input
              required
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address"
              className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-cyan"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                required
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-cyan"
              />
              <input
                required
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-cyan"
              />
              <input
                required
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="ZIP"
                className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none focus:border-cyan"
              />
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-2xl border border-line bg-ink-2 p-5">
            <legend className="px-1 font-display text-lg">Payment</legend>
            <div className="rounded-xl border border-cyan/30 bg-ink px-4 py-4">
              <p className="text-sm font-bold text-cream">Pay with Stripe Checkout</p>
              <p className="mt-1 text-xs text-mute">
                You&apos;ll be redirected to Stripe&apos;s hosted page (test mode). Card fields live
                there — not on this site.
              </p>
              <div className="mt-3 flex items-start gap-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan" />
                <div className="space-y-2">
                  <p className="text-xs text-mute">
                    Test card: 4242 4242 4242 4242 · any future expiry · any CVC
                  </p>
                  <PaymentIcons />
                </div>
              </div>
            </div>
            {payError && (
              <p role="alert" className="text-sm text-pink">
                {payError}
              </p>
            )}
          </fieldset>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={onPayWithStripe}
              disabled={paying}
              className="btn-primary min-h-11 w-full sm:w-auto disabled:opacity-60"
            >
              {paying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
                </>
              ) : (
                <>Pay with Stripe · ${grandTotal.toFixed(2)}</>
              )}
            </button>
            <button type="submit" className="btn-ghost min-h-11 w-full sm:w-auto">
              Save demo order (no charge)
            </button>
          </div>
        </form>
      </div>

      <aside className="h-fit rounded-2xl border border-line bg-ink-2 p-5 shadow-[0_0_40px_rgba(34,211,238,0.06)] lg:sticky lg:top-24 lg:self-start">
        <h2 className="font-display text-xl">Order summary</h2>
        <p className="mt-1 text-xs text-mute">
          {items.reduce((n, i) => n + i.qty, 0)} item
          {items.reduce((n, i) => n + i.qty, 0) === 1 ? '' : 's'}
        </p>
        <ul className="mt-4 space-y-3">
          {items.map(({ product, qty }) => (
            <li key={product.id} className="flex gap-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-3">
                {customPreviewSrc(product.custom) ? (
                  <img
                    src={customPreviewSrc(product.custom)}
                    alt=""
                    className="h-full w-full object-contain bg-ink p-1"
                  />
                ) : (
                  <ProductArt product={product} className="h-full w-full" />
                )}
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-extrabold text-white">
                  {qty}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-words text-sm font-bold leading-snug">{product.name}</p>
                <p className="text-xs text-mute">
                  {formatCustomCartMeta(product.custom) ??
                    `${product.category} · $${product.price.toFixed(2)} each`}
                </p>
                {product.custom?.bannerSides && (
                  <p className="text-[11px] text-mute">
                    {product.custom.bannerSides === 'double' ? 'Double-sided' : 'Single-sided'}
                    {product.custom.bannerWidthFt && product.custom.bannerHeightFt
                      ? ` · ${product.custom.bannerWidthFt}×${product.custom.bannerHeightFt} ft`
                      : ''}
                  </p>
                )}
                {product.custom?.bannerNotes && (
                  <p className="line-clamp-2 text-[11px] text-mute">
                    Notes: {product.custom.bannerNotes}
                  </p>
                )}
                {product.custom?.canvasFinish && product.custom.type === 'canvas' && (
                  <p className="text-[11px] text-mute">
                    {product.custom.canvasFinish === 'framed' ? 'Framed' : 'Stretched'}
                    {product.custom.canvasSizeLabel
                      ? ` · ${product.custom.canvasSizeLabel}`
                      : ''}
                  </p>
                )}
                {product.custom?.canvasNotes && (
                  <p className="line-clamp-2 text-[11px] text-mute">
                    Notes: {product.custom.canvasNotes}
                  </p>
                )}
                {product.custom?.cardNotes && (
                  <p className="line-clamp-2 text-[11px] text-mute">
                    Notes: {product.custom.cardNotes}
                  </p>
                )}
                {product.custom?.estimateOnly && (
                  <p className="text-[11px] font-bold text-lavender">
                    Estimate — final quote by email
                  </p>
                )}
                {product.custom?.freshieScent && (
                  <p className="text-[11px] font-bold text-cyan">
                    Scent: {product.custom.freshieScent}
                  </p>
                )}
                {product.custom?.freshieNote && (
                  <p className="line-clamp-2 text-[11px] text-mute">
                    Note: {product.custom.freshieNote}
                  </p>
                )}
                {product.custom?.logoComingByEmail && (
                  <p className="text-[11px] font-bold text-lavender">
                    {product.custom.type === 'banner' || product.custom.type === 'canvas' || product.custom.type === 'business-cards' || product.custom.type === 'thank-you-cards'
                      ? 'Artwork coming by email'
                      : 'Logo coming by email'}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-sm font-bold text-lime">
                ${(product.price * qty).toFixed(2)}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-mute">Subtotal</span>
            <span className="font-bold">${total.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-mute">Shipping</span>
            <span className="text-right font-bold text-cream">
              {freeShip ? (
                <span className="text-lime">$0.00 · free</span>
              ) : (
                <span>${shippingEstimate.toFixed(2)}</span>
              )}
            </span>
          </div>
          <p className="text-[11px] text-mute">
            {freeShip
              ? `Free shipping on orders $${FREE_SHIPPING_THRESHOLD}+`
              : `Flat $8 shipping · free at $${FREE_SHIPPING_THRESHOLD}+`}
          </p>
          <div className="flex items-center justify-between border-t border-line pt-3">
            <span className="font-display text-lg">Total</span>
            <span className="font-display text-xl text-lime">
              ${grandTotal.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-ink/60 px-3 py-2.5">
          <Lock className="h-3.5 w-3.5 shrink-0 text-cyan" />
          <p className="text-[11px] leading-snug text-mute">
            Test mode via Stripe Checkout — no live charges until live keys are configured.
          </p>
        </div>
      </aside>
    </div>
  )
}
