# Stripe Checkout (test mode)

Backend for Inkcredible Pens. Uses **Stripe Checkout Sessions** — prices are computed **on the server** (`server/pricing.mjs`). Paid orders are created by the **webhook**, not the browser.

## Setup

1. Create a [Stripe](https://dashboard.stripe.com/register) account → **Developers** → **API keys** → copy the **Secret key** (starts with `sk_test_...`).
2. Export keys and start the API server:

```bash
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...   # required for real deploys / NODE_ENV=production
npm run stripe:server
```

Server listens on **`127.0.0.1:4242`** only (not all interfaces). Vite proxies `/api` → `http://127.0.0.1:4242`.

3. In another terminal: `npm run dev` (port 5173), open Checkout, enter email + name (shipping fields are optional prefill), click **Pay with Stripe**, then confirm address on Stripe.

## Local webhooks (required for paid orders)

Checkout sessions save a **pending** record under `data/checkouts/`. The order is written when Stripe sends `checkout.session.completed`.

Forward events locally:

```bash
stripe listen --forward-to localhost:4242/api/stripe/webhook
```

Copy the printed `whsec_...` signing secret and export it before starting the API (or restart with it set):

```bash
export STRIPE_WEBHOOK_SECRET=whsec_...
npm run stripe:server
```

### Fail-closed in production

If `NODE_ENV=production`, `REQUIRE_STRIPE_WEBHOOK=1`, or `ORIGIN` is production HTTPS (e.g. `https://inkcredible.kennedyshome.com`), a missing `STRIPE_WEBHOOK_SECRET` makes `POST /api/stripe/webhook` return **503** — unsigned bodies are never accepted.

Local/dev without a secret: unsigned parse may still work for convenience (loud warning). Prefer `stripe listen` + secret, or set `ALLOW_INSECURE_WEBHOOK=1` to make the intent explicit. That flag does **not** unlock unsigned parse under production hardening.

If the webhook is delayed, `GET /api/checkout/session/:id` may confirm `payment_status=paid` via the Stripe API and fulfill the pending checkout safely. The success page shows **“Payment confirmation pending”** (not Paid) until the server returns a real `orderId` — it never invents `stripe-${sessionId}` / `pending-*` as paid success, and does not clear the cart as paid until confirmed.

### Return URLs

Set `ORIGIN=https://inkcredible.kennedyshome.com` in production. Client `returnOrigin` is ignored in that mode (open-redirect hardening).

## Test card

- Number: `4242 4242 4242 4242`
- Expiry: any future date
- CVC: any 3 digits
- ZIP: any

## Notes

- Do **not** commit real keys. Prefer env vars; if you use a `.env` file, keep it gitignored.
- Client sends `productId` + `quantity` + optional `config` (custom options). **Server ignores client unit prices.**
- Shipping: $8 under $35 merchandise, free at $35+ (same as shop UI).
- Without `STRIPE_SECRET_KEY`, Checkout cannot charge. **Save demo order (no charge)** and Stripe test-card hints appear in **development builds only** (`import.meta.env.DEV`) — production builds show normal checkout UX only.
- Health check: `GET http://127.0.0.1:4242/api/health` → `{ ok, stripe, webhook, productionHardening }`.
- Success lookup: `GET /api/checkout/session/:id` → order id / status only (no full PII).

## Shipping address authority

**Stripe Checkout is the single authority** for the paid order’s shipping/customer address.

1. In-app Checkout may collect email/name (required) and optional address fields as **prefill only**.
2. Stripe session creation enables `shipping_address_collection` (US). The customer confirms/edits shipping on Stripe’s hosted page.
3. On fulfill (`checkout.session.completed` / `async_payment_succeeded`), the webhook builds the order customer from **`session.shipping_details`** and **`session.customer_details`**, falling back to the pending checkout record only when Stripe fields are missing.

Do not treat the pre-Stripe pending checkout address as final when Stripe has shipping details.

## Payment status before Paid

Orders are marked paid **only** when `session.payment_status === 'paid'`.

- `checkout.session.completed` with `processing` / `unpaid` (async methods) does **not** create a paid order.
- `checkout.session.async_payment_succeeded` fulfills when status becomes `paid`.
- Success UI / `GET /api/checkout/session/:id` show pending or processing until the server has a real paid `orderId`.

## Custom artwork uploads

See [UPLOADS.md](./UPLOADS.md). Custom files are saved under `uploads/custom/` on the same Express app (4242) and served **admin-only**.

## Shared orders

See [ORDERS.md](./ORDERS.md) and [SECURITY.md](./SECURITY.md). Orders API requires admin Bearer token; paid Stripe orders come from the webhook.

## Production deploy

See [DEPLOY.md](./DEPLOY.md) — set `ORIGIN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, strong `ADMIN_PIN` (not `1234`), and `TRUST_PROXY` before live Stripe.
