# Shared orders (server)

Phone and laptop Store Managers see the **same** orders via the Express API on port **4242** (not just browser `localStorage`).

## Persistence

- Directory: `data/orders/`
- File: `data/orders/orders.json` (array of orders)
- JSON files are gitignored; keep the folder with `data/orders/.gitkeep`

**Proxmox / production:** mount a persistent disk or volume at `data/orders/` (or the whole `data/` tree) so orders survive container restarts.

## API

Same process as Stripe + uploads (`npm run stripe:server`):

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/orders` | List newest first → `{ orders }` |
| `POST` | `/api/orders` | Create; body matches Order shape. Assigns `id` if missing. Rejects duplicate `stripeSessionId` (409). |
| `PATCH` | `/api/orders/:id` | Update `{ status }` |
| `DELETE` | `/api/orders/:id` | Delete |

Vite proxies `/api` → `http://127.0.0.1:4242`.

## Client

- `src/lib/ordersApi.ts` — fetch/create/update/delete
- `src/store/orders.ts` — zustand + localStorage cache; checkout POSTs to API; Orders tab hydrates from API
- Orders panel shows **Synced** / offline error and still allows local view

No auth beyond the Store Manager PIN (LAN / tunnel prototype).

## Production deploy

See [DEPLOY.md](./DEPLOY.md) for Proxmox + Cloudflare cutover and `scripts/deploy.sh`.
