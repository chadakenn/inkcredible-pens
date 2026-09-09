# Security notes (Inkcredible Pens)

## Admin auth

- Store Manager unlocks via `POST /api/admin/login` with a PIN.
- Successful login returns an HMAC-signed session token; the browser stores it in **sessionStorage** and sends `Authorization: Bearer …` on protected API calls.
- Protected routes: all `/api/orders*`, catalog **mutations** (`POST/PATCH/DELETE` products + `/api/catalog/reset`), product photo upload (`POST /api/uploads/products`), customer artwork download (`GET /api/admin/uploads/custom/:name`), and `POST /api/admin/change-pin` (also accepts current PIN).
- Public: `GET /api/catalog*`, checkout session create, Stripe webhook, artwork **upload** (rate-limited), public product images under `/uploads/products/`, `GET /api/checkout/session/:id` (order id/status only).
- Initial PIN: `ADMIN_PIN` env (default `1234` for local). After **Change PIN**, the new value is stored in `data/admin/pin.json` (gitignored) so you do not need to edit `.env`.
- Session signing secret: `ADMIN_SESSION_SECRET` or auto-file `data/admin/session-secret.json`.

### Login rate limiting

`POST /api/admin/login` is rate-limited **per IP: 5 attempts / 15 minutes** (then `429`). Implementation is a simple **in-memory** map — fine for a single-node Proxmox guest; it resets on process restart and is not shared across multiple API instances. Failed and successful attempts use a short random delay; responses never reveal whether a PIN “exists.”

Browser-only PIN / localStorage unlock is **not** enough to call protected APIs.

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

## Orders

Paid orders are created by the Stripe webhook (`checkout.session.completed`) from a pending checkout saved under `data/checkouts/`. The success page only looks up order id/status by `session_id` — it does not invent orders from the cart.

See [STRIPE.md](./STRIPE.md) for local webhook forwarding.
