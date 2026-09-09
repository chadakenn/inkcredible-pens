# Shared orders (server)

Phone and laptop Store Managers see the **same** orders via the Express API on port **4242** (not just browser `localStorage`).

## Persistence

- Directory: `data/orders/`
- File: `data/orders/orders.json` (array of orders)
- Writes are atomic (temp + rename) with rolling `*.bak` backups. Corrupt JSON returns **500** (never a silent empty list).
- JSON files are gitignored; keep the folder with `data/orders/.gitkeep`

**Proxmox / production:** mount a persistent disk or volume at `data/orders/` (or the whole `data/` tree) so orders survive container restarts.

Paid Stripe checkouts are staged under `data/checkouts/` until the webhook creates the order.

## API

Same process as Stripe + uploads (`npm run stripe:server`). **All `/api/orders*` routes require admin Bearer token** (see [SECURITY.md](./SECURITY.md)).

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/orders` | List newest first → `{ orders }` (auth) |
| `POST` | `/api/orders` | Admin create; body matches Order shape (auth) |
| `PATCH` | `/api/orders/:id` | Update status / tracking (auth) |
| `DELETE` | `/api/orders/:id` | Delete (auth) |

Paid customer orders are created by `POST /api/stripe/webhook` on `checkout.session.completed` (not by the browser).

Public success lookup: `GET /api/checkout/session/:id` → `{ orderId, status, … }` (no full PII).

Vite proxies `/api` → `http://127.0.0.1:4242`.

## Client

- `src/lib/ordersApi.ts` — fetch/create/update/delete with `Authorization: Bearer …`
- `src/store/orders.ts` — zustand + localStorage cache; Orders tab hydrates from API after Store Manager login
- Orders panel shows **Synced** / offline error and still allows local view

## Production deploy

See [DEPLOY.md](./DEPLOY.md) for Proxmox + Cloudflare cutover and `scripts/deploy.sh`.
