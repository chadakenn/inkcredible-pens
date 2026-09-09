# Stripe Checkout (test mode)

Backend for Inkcredible Pens. Uses **Stripe Checkout Sessions** — prices are computed **on the server** (`server/pricing.mjs`). Paid orders are created by the **webhook**, not the browser.

## Setup

1. Create a [Stripe](https://dashboard.stripe.com/register) account → **Developers** → **API keys** → copy the **Secret key** (starts with `sk_test_...`).
2. Export keys and start the API server:

```bash
export STRIPE_SECRET_KEY=sk_test_...
# Optional until you run stripe listen:
# export STRIPE_WEBHOOK_SECRET=whsec_...
npm run stripe:server
```

Server listens on port **4242**. Vite proxies `/api` → `http://127.0.0.1:4242`.

3. In another terminal: `npm run dev` (port 5173), open Checkout, fill contact/shipping, click **Pay with Stripe**.

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

Without a webhook, the success page may show a session-based code while waiting; Store Manager will not see a paid order until the event is delivered.

## Test card

- Number: `4242 4242 4242 4242`
- Expiry: any future date
- CVC: any 3 digits
- ZIP: any

## Notes

- Do **not** commit real keys. Prefer env vars; if you use a `.env` file, keep it gitignored.
- Client sends `productId` + `quantity` + optional `config` (custom options). **Server ignores client unit prices.**
- Shipping: $8 under $35 merchandise, free at $35+ (same as shop UI).
- Without `STRIPE_SECRET_KEY`, Checkout still works via **Save demo order (no charge)** (local only unless admin-authenticated).
- Health check: `GET http://127.0.0.1:4242/api/health` → `{ ok, stripe, webhook }`.
- Success lookup: `GET /api/checkout/session/:id` → order id / status only (no full PII).

## Custom artwork uploads

See [UPLOADS.md](./UPLOADS.md). Custom files are saved under `uploads/custom/` on the same Express app (4242).

## Shared orders

See [ORDERS.md](./ORDERS.md) and [SECURITY.md](./SECURITY.md). Orders API requires admin Bearer token; paid Stripe orders come from the webhook.

## Production deploy

See [DEPLOY.md](./DEPLOY.md) — set `ORIGIN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and admin env vars before live Stripe.
