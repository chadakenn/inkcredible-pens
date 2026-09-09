# Stripe Checkout (test mode)

Stub backend for Inkcredible Pens. Uses **Stripe Checkout Sessions** — no live charges until you switch to live keys.

## Setup

1. Create a [Stripe](https://dashboard.stripe.com/register) account → **Developers** → **API keys** → copy the **Secret key** (starts with `sk_test_...`).
2. Export the key and start the stub server:

```bash
export STRIPE_SECRET_KEY=sk_test_...
npm run stripe:server
```

Server listens on port **4242**. Vite proxies `/api` → `http://127.0.0.1:4242`.

3. In another terminal: `npm run dev` (port 5173), open Checkout, fill contact/shipping, click **Pay with Stripe**.

## Test card

- Number: `4242 4242 4242 4242`
- Expiry: any future date
- CVC: any 3 digits
- ZIP: any

## Notes

- Do **not** commit real keys. Prefer env vars; if you use a `.env` file, keep it gitignored.
- Without `STRIPE_SECRET_KEY`, Checkout still works via **Save demo order (no charge)**.
- Health check: `GET http://127.0.0.1:4242/api/health` → `{ ok: true, stripe: true|false }`.

## Custom artwork uploads

See [UPLOADS.md](./UPLOADS.md). Custom files are saved under `uploads/custom/` on the same Express app (4242).

## Shared orders

See [ORDERS.md](./ORDERS.md). Checkout posts orders to `/api/orders` on the same 4242 process.

## Production deploy

See [DEPLOY.md](./DEPLOY.md) — set `ORIGIN` to your real HTTPS domain before live Stripe.
