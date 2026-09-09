# Security notes (Inkcredible Pens)

## Admin auth

- Store Manager unlocks via `POST /api/admin/login` with a PIN.
- Successful login returns an HMAC-signed session token; the browser stores it in **sessionStorage** and sends `Authorization: Bearer …` on protected API calls.
- Protected routes: all `/api/orders*`, catalog **mutations** (`POST/PATCH/DELETE` products + `/api/catalog/reset`), and `POST /api/admin/change-pin` (also accepts current PIN).
- Public: `GET /api/catalog*`, checkout session create, Stripe webhook, artwork upload, `GET /api/checkout/session/:id` (order id/status only).
- Initial PIN: `ADMIN_PIN` env (default `1234` for local). After **Change PIN**, the new value is stored in `data/admin/pin.json` (gitignored) so you do not need to edit `.env`.
- Session signing secret: `ADMIN_SESSION_SECRET` or auto-file `data/admin/session-secret.json`.

Browser-only PIN / localStorage unlock is **not** enough to call protected APIs.

## Stripe pricing

Checkout ignores client unit prices. The server resolves catalog prices by product id and recomputes custom product prices with the same formulas as the shop configurators (`server/pricing.mjs`). Shipping is recomputed from the server merchandise subtotal ($8 under $35, free at $35+).

## Orders

Paid orders are created by the Stripe webhook (`checkout.session.completed`) from a pending checkout saved under `data/checkouts/`. The success page only looks up order id/status by `session_id` — it does not invent orders from the cart.

See [STRIPE.md](./STRIPE.md) for local webhook forwarding.
