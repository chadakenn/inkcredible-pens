# Custom artwork uploads

Customer logo / banner / canvas files are stored on disk (not only as base64 in the browser).

## Where files live

- Directory: `uploads/custom/` (under the project root on this host)
- Example: `/workspace/inkcredible-pens/uploads/custom/{timestamp}-{safeOriginalName}`
- On Proxmox / production: keep the same relative path, or mount a persistent volume at `uploads/`.

Uploaded binaries are gitignored; `uploads/custom/.gitkeep` keeps the folder in git.

## API (Express on port 4242)

Same process as Stripe (`npm run stripe:server`):

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/uploads/custom` | Multipart field `file` (png/jpeg/webp/svg, max ~15MB). Returns `{ id, fileName, url, size, mime }`. |
| `GET` | `/uploads/custom/:name` | Serves the file. Add `?download=1` for `Content-Disposition: attachment`. |
| `GET` | `/api/uploads/custom/:id` | Metadata lookup (`id` = stored filename). |

Vite proxies `/api` and `/uploads` → `http://127.0.0.1:4242`.

## Store Manager

Orders that include `custom.artworkUrl` show a thumbnail and a **Download print file** link in Store Manager → Orders.

## Shared orders

Orders are also stored on this Express server. See [ORDERS.md](./ORDERS.md) — persist `data/orders/` on Proxmox.
