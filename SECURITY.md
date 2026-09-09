# Security notes (Inkcredible Pens)

## Admin auth

- Store Manager unlocks via `POST /api/admin/login` with a PIN.
- Successful login returns an HMAC-signed session token; the browser stores it in **sessionStorage** and sends `Authorization: Bearer …` on protected API calls.
- Protected routes: all `/api/orders*`, catalog **mutations** (`POST/PATCH/DELETE` products + `/api/catalog/reset`), scents **mutations** (`POST/PATCH/DELETE` `/api/scents*` + clear/reset), product photo upload (`POST /api/uploads/products`), customer artwork download (`GET /api/admin/uploads/custom/:name`), and **`POST /api/admin/change-pin` (Bearer session required — current PIN alone is not enough)**.
- Public: `GET /api/catalog*`, `GET /api/scents`, checkout session create (rate-limited), Stripe webhook, artwork **upload** (rate-limited), public product images under `/uploads/products/`, `GET /api/checkout/session/:id` (order id/status only).
- Initial PIN: `ADMIN_PIN` env. After **Change PIN**, the new value is stored in `data/admin/pin.json` (gitignored).
- **Production hardening** (`NODE_ENV=production` / prod `ORIGIN` / `REQUIRE_…`): the API **refuses to start** if the effective PIN is missing or still the default `1234`. Set a strong `ADMIN_PIN` (or Change PIN so `pin.json` is not `1234`) before enabling production signals.
- **Dev**: may default to `1234` with a loud startup warning.
- Session signing secret: `ADMIN_SESSION_SECRET` or auto-file `data/admin/session-secret.json`.

### Login / change-pin rate limiting

`POST /api/admin/login` and `POST /api/admin/change-pin` are rate-limited **per trusted IP: 5 attempts / 15 minutes** (then `429`). Implementation is a simple **in-memory** map — fine for a single-node Proxmox guest; it resets on process restart and is not shared across multiple API instances. Failed and successful login attempts use a short random delay; responses never reveal whether a PIN “exists.”

Browser-only PIN / localStorage unlock is **not** enough to call protected APIs.

## Trust proxy + rate-limit IPs

Node binds **`127.0.0.1` only** — Cloudflare Tunnel / Caddy is the external face.

Behind a reverse proxy, configure Express `trust proxy` so `req.ip` is the real client:

| Layout | Recommended `TRUST_PROXY` |
|--------|---------------------------|
| Cloudflare Tunnel → Node | `1` (default under production hardening) |
| Caddy/nginx → Node | `1` |
| Cloudflare → Caddy → Node | `2` |

All rate limiters use **trusted `req.ip`** after `trust proxy` — they **never** take the first raw `X-Forwarded-For` entry (spoofable). See [DEPLOY.md](./DEPLOY.md).

## Stripe webhook (fail-closed)

Production hardening is on when any of:

- `NODE_ENV=production`
- `REQUIRE_STRIPE_WEBHOOK=1`
- `ORIGIN` looks like production HTTPS (e.g. contains `inkcrediblepens.org`, or any non-localhost `https://…`)

In that mode **`STRIPE_WEBHOOK_SECRET` is required**. Missing secret → webhook returns **503** and the body is **not** parsed unsigned.

Local/dev (no production signals): unsigned parse is allowed for convenience when the secret is unset (loud warning). Prefer setting `STRIPE_WEBHOOK_SECRET` from `stripe listen`, or set `ALLOW_INSECURE_WEBHOOK=1` explicitly to document intent. `ALLOW_INSECURE_WEBHOOK` **never** unlocks unsigned parse under production hardening.

## Checkout return URLs (`returnOrigin`)

Under production hardening (or when `ORIGIN` is a non-localhost HTTPS URL), Stripe success/cancel URLs **always** use configured `ORIGIN` (Chad’s prod target: `https://inkcrediblepens.org`). Client-supplied `returnOrigin` is ignored.

In local/dev: prefer env `ORIGIN` when set; otherwise localhost (or tunnel) origins from the client are accepted.

## Checkout success page (no invented paid orders)

Paid orders are created by the Stripe webhook (`checkout.session.completed` / `async_payment_succeeded`) only when `payment_status === 'paid'`, from a pending checkout under `data/checkouts/`, **or** by a server-side Stripe API confirm on `GET /api/checkout/session/:id` when `payment_status=paid` and a pending checkout exists (webhook lag recovery). Fulfill prefers Stripe `shipping_details` / `customer_details` over the pending checkout contact.

The success page:

- Shows **Paid / Confirmed** only when the server returns a real `orderId` with `paymentConfirmed` / `status=paid`.
- If confirmation is delayed: shows **“Payment confirmation pending”** with the Stripe `session_id` and a refresh action — **never** invents `stripe-${sessionId}` or `pending-*` as a paid success, and does **not** clear the cart as paid until confirmed.

See [STRIPE.md](./STRIPE.md).

## Public checkout abuse protection

- `POST /api/create-checkout-session` is rate-limited per trusted IP.
- Cart caps: max line count, max quantity per line, max custom string/dimension lengths (see `CART_LIMITS` in `server/security.mjs`).
- Customer artwork: size cap + retention cleanup of abandoned uploads / pending checkout JSON (default **7 days**, configurable via `UPLOAD_RETENTION_DAYS` / `CHECKOUT_RETENTION_DAYS`). Unreferenced custom files are kept if still cited by open checkouts/orders. Orphan **product** photos under `uploads/products/` are deleted when the catalog no longer references them (on product image change/delete + retention sweep). See [UPLOADS.md](./UPLOADS.md).

## Customer artwork

- SVG is **not** accepted. Files are verified by **magic bytes** (JPEG/PNG/WebP/GIF only), stored as **UUID** filenames under `uploads/custom/`.
- Upload POSTs are rate-limited per IP.
- Files are **not** world-readable at `/uploads/custom/…` (returns 401). Store Manager downloads via authenticated `GET /api/admin/uploads/custom/:name`.
- Cart/checkout previews use a client-side data URL; durable print files stay on disk for admin fetch after order.

## Product photos

Admin multipart upload → `uploads/products/<uuid>.{webp,jpg,png,gif}`; catalog stores the **URL path string** only (never base64). Public read at `/uploads/products/…` is intentional (storefront assets).

## JSON persistence

Orders, catalog, and checkout records use **temp + rename** writes plus rolling backups (`*.bak`). Corrupt JSON **fails loudly** (HTTP 500 / thrown error) — never silently returns `[]`.

## Stripe pricing

Checkout ignores client unit prices. The server resolves catalog prices by product id and recomputes custom product prices with the same formulas as the shop configurators (`server/pricing.mjs`). Shipping is recomputed from the server merchandise subtotal ($8 under $35, free at $35+).

## Off-host backups (PII + artwork)

`data/` (orders, checkouts, admin pin/session, catalog, scents) and `uploads/` (customer artwork + product photos) contain **PII and customer print files**. Proxmox VM/LXC snapshots help with host failure but are not a substitute for:

- **Encrypted** backups copied **off-host** (another machine, object storage, or encrypted USB) on a regular schedule
- Verified restore drills (can you recreate `orders.json` + a sample `uploads/custom` file?)

Never commit live `data/*` JSON or upload binaries to git. See [DEPLOY.md](./DEPLOY.md).
