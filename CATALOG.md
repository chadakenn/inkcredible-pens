# Shared product catalog (server)

Shop and Store Manager use the **same** product list via the Express API on port **4242**. Browser `localStorage` is a cache/fallback only — not the source of truth.

## Persistence

- Directory: `data/catalog/`
- File: `data/catalog/products.json` (array of Product)
- Committed seed: `server/catalog-seed.json` (used when `products.json` is missing, and for `POST /api/catalog/reset`)
- JSON under `data/catalog/` is gitignored; keep the folder with `data/catalog/.gitkeep`

**Proxmox / production:** mount a persistent disk or volume at `data/` (or `data/catalog/`) so catalog edits survive deploys. `scripts/deploy.sh` only `mkdir -p data/catalog` — it never wipes the folder.

## API

`GET` catalog endpoints are public. **Mutations** (`POST/PATCH/DELETE` products + `/api/catalog/reset`) require Store Manager Bearer token — see [SECURITY.md](./SECURITY.md).

## API detail

Same process as Stripe + uploads + orders (`npm run stripe:server`):

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/api/catalog` | Full list → `{ products }` |
| `GET` | `/api/catalog/products/:id` | One product → `{ product }` |
| `GET` | `/api/catalog/product-price/:id` | `{ id, price, name }` for future Stripe server pricing |
| `POST` | `/api/catalog/products` | Create; generates `id` if missing. Requires `name`, `price`, `category`. |
| `PATCH` | `/api/catalog/products/:id` | Partial update |
| `DELETE` | `/api/catalog/products/:id` | Delete |
| `POST` | `/api/catalog/reset` | Restore from `server/catalog-seed.json` |

Writes are atomic (temp file + rename). Vite proxies `/api` → `http://127.0.0.1:4242`.

## Client

- `src/lib/catalogApi.ts` — fetch/create/update/delete/reset
- `src/store/catalog.ts` — zustand + localStorage cache (`inkcredible-catalog-v4`); `hydrateFromApi()` on app load; mutations go to the API first
- If the API is down: shop shows cached products; add/edit/delete fail with a message

No auth beyond the Store Manager PIN (same prototype trust as orders).

## Seed

Initial catalog was generated from `src/data/products.ts` with the same SEED_OVERRIDES as the former client catalog (business cards, thank you cards, banners, logo stickers). To regenerate:

```bash
npx tsx -e "/* import products + overrides; write data/catalog/products.json + server/catalog-seed.json */"
```

## Production deploy

See [DEPLOY.md](./DEPLOY.md). Catalog lives under sacred `data/`.
