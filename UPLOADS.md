# Uploads

## Customer artwork (print files)

Customer logo / banner / canvas files are stored on disk (not only as base64 in the browser).

### Where files live

- Directory: `uploads/custom/`
- Filename: `<uuid>.{jpg|png|webp|gif}` (random UUID; extension from verified type)
- On Proxmox / production: keep the same relative path, or mount a persistent volume at `uploads/`.
- Owner: system user **`inkcredible`** (see [DEPLOY.md](./DEPLOY.md)).

Uploaded binaries are gitignored; `uploads/custom/.gitkeep` keeps the folder in git.

### Rules

- **No SVG** (XSS / polyglot risk).
- Server verifies **magic bytes**, not just MIME/extension.
- Max size ~**12MB**; oversize rejected early by multer.
- Upload POSTs are **rate-limited per trusted IP** (in-memory; single-node; see [SECURITY.md](./SECURITY.md) trust proxy).
- **Not** publicly readable: `GET /uploads/custom/:name` returns 401.
- Store Manager downloads via `GET /api/admin/uploads/custom/:name` (Bearer token). Orders panel uses an authenticated fetch + download button.

### Retention / disk quota

- Startup + daily job deletes **abandoned** custom uploads older than **`UPLOAD_RETENTION_DAYS`** (default **7**) that are not referenced by checkout/order JSON (including `orders.json` arrays).
- Pending/completed checkout JSON older than **`CHECKOUT_RETENTION_DAYS`** (default **7**) is removed the same way.
- Product photos under `uploads/products/`: when a product’s `imageUrl` changes or the product is deleted, the old file is removed **if unreferenced** by the catalog. Retention also sweeps unreferenced product UUID files.
- **Quota guidance:** size the volume for peak concurrent carts × ~12MB + headroom (often 5–20 GB). Monitor `uploads/custom/` growth after launch. Keep **encrypted off-host backups** of `uploads/` (see [DEPLOY.md](./DEPLOY.md) / [SECURITY.md](./SECURITY.md)).

### API

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/uploads/custom` | Multipart field `file` (jpeg/png/webp/gif). Returns `{ id, fileName, url, adminUrl, size, mime }` where `url` is the admin path. |
| `GET` | `/api/admin/uploads/custom/:name` | **Auth required.** Serves the file. `?download=1` for attachment. |
| `GET` | `/api/uploads/custom/:id` | **Auth required.** Metadata lookup. |

Vite proxies `/api` and `/uploads` → `http://127.0.0.1:4242`.

Cart/checkout may keep a short-lived client data URL for preview; durable print files are admin-fetched after order.

## Product photos (storefront)

- Directory: `uploads/products/` (+ `.gitkeep`; contents gitignored)
- Admin-only upload: `POST /api/uploads/products` (multipart `file`, magic-byte verified, UUID name)
- Catalog stores `/uploads/products/<uuid>.webp` (or jpg/png/gif) — **never** base64 in `products.json`
- Public `GET /uploads/products/:name` is intentional (shop images)

Store Manager **Product photo** field uploads through this API.

## Shared orders

Orders are also stored on this Express server. See [ORDERS.md](./ORDERS.md) — persist `data/orders/` on Proxmox.
