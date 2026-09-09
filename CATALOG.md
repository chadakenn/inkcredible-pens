# Shared product catalog (server)

Shop and Store Manager use the **same** product list via the Express API on port **4242**. Browser `localStorage` is a cache/fallback only — not the source of truth.

## Persistence

- Directory: `data/catalog/`
- File: `data/catalog/products.json` (array of Product)
- Committed seed: `server/catalog-seed.json` (used when `products.json` is missing, and for `POST /api/catalog/reset`)
- JSON under `data/catalog/` is gitignored; keep the folder with `data/catalog/.gitkeep`
- Writes are **atomic** (temp + rename) with rolling `*.bak` backups. **Corrupt JSON fails loudly** (HTTP 500) — never silently returns `[]`.

**Proxmox / production:** mount a persistent disk or volume at `data/` (or `data/catalog/`) so catalog edits survive deploys. `scripts/deploy.sh` only `mkdir -p data/catalog` — it never wipes the folder.

## Product photos

Do **not** store base64/`data:` URLs in the catalog (Express JSON limits + bloat). Use `POST /api/uploads/products` (admin) and save the returned `/uploads/products/…` path on `imageUrl`. See [UPLOADS.md](./UPLOADS.md).

## API

`GET` catalog endpoints are public. **Mutations** (`POST/PATCH/DELETE` products + `/api/catalog/reset`) require Store Manager Bearer token — see [SECURITY.md](./SECURITY.md).

## API detail

Same process as Stripe + uploads + orders (`npm run stripe:server`):

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/catalog` | Full list → `{ products }` |
| `GET` | `/api/catalog/products/:id` | One product → `{ product }` |
| `GET` | `/api/catalog/product-price/:id` | `{ id, price, name }` for Stripe server pricing |
| `POST` | `/api/catalog/products` | Create; generates `id` if missing. Requires `name`, `price`, `category`. |
| `PATCH` | `/api/catalog/products/:id` | Partial update |
| `DELETE` | `/api/catalog/products/:id` | Delete |
| `POST` | `/api/catalog/reset` | Restore from `server/catalog-seed.json` |
| `POST` | `/api/uploads/products` | Admin multipart product photo → `{ url }` |

Vite proxies `/api` → `http://127.0.0.1:4242`.

## Client

- `src/lib/catalogApi.ts` — fetch/create/update/delete/reset + `uploadProductPhoto`
- `src/components/admin/ProductPhotoField.tsx` — uploads via API, stores path
- `src/store/catalog.ts` — zustand + localStorage cache (`inkcredible-catalog-v4`); `hydrateFromApi()` on app load; mutations go to the API first
- If the API is down: shop shows cached products; add/edit/delete fail with a message

## Seed

Initial catalog was generated from `src/data/products.ts` with the same SEED_OVERRIDES as the former client catalog (business cards, thank you cards, banners, logo stickers).

## Production deploy

See [DEPLOY.md](./DEPLOY.md). Catalog lives under sacred `data/`.
