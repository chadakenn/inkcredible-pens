# Proxmox + Cloudflare deploy checklist

## Target layout

```
/opt/inkcredible-pens/
├── dist/                 # vite build (replaceable)
├── server/               # Express API (replaceable)
├── scripts/deploy.sh
├── data/                 # SACRED — persistent volume (owner: inkcredible)
│   ├── orders/
│   ├── catalog/          # products.json + scents.json (server-side)
│   ├── admin/            # PIN + session secret (gitignored; mode 750)
│   ├── checkouts/        # pending Stripe checkouts (gitignored)
│   └── customer-files/   # paid-order artwork fallback; dedicated mount recommended
├── uploads/              # SACRED (owner: inkcredible)
│   ├── custom/           # customer print files (admin-only serve)
│   ├── products/         # public storefront photos
│   └── social/           # public, expiring social-post staging images
├── .env                  # SACRED — never in git (mode 640, group inkcredible)
└── package.json
```

**Sacred ground** (deploy may bulldoze app code; never wipe these): `data/`, `uploads/`, `.env`.

Product catalog is **server JSON** under `data/catalog/` (not browser localStorage). Details: [CATALOG.md](./CATALOG.md).

## Progression

1. **Prototype** (now) — tunnel preview, mixed localStorage + server orders/uploads  
2. **Proxmox persistent deploy** — this doc  
3. **Real-domain Stripe testing** — `ORIGIN=https://…`, test keys, then webhook “paid”  
4. **Server-side catalog** — ✅ JSON under `data/catalog/` (see [CATALOG.md](./CATALOG.md); localStorage is cache only)  
5. **Protected admin APIs** — ✅ PIN login + Bearer token on orders + catalog mutations (see [SECURITY.md](./SECURITY.md))  
6. **PostgreSQL** — only if/when JSON/SQLite outgrows the store  

Stripe hardening: ✅ Express accepts product IDs/options → loads **server** prices → pending checkout → Stripe session → **webhook** (or Stripe API confirm) creates paid order in `data/orders/`. Browser never has final say on price. See [STRIPE.md](./STRIPE.md).

---

## A. One-time: Proxmox guest

1. Create an **LXC or VM** (Debian/Ubuntu 22.04+ is fine). Give it a static LAN IP.
2. Install **Node 24 LTS** (deploy standard; `package.json` engines require `>=22.12` for Vite 8):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs git
node -v   # expect v24.x
```

3. Create a dedicated **`inkcredible`** system user/group and app directory:

```bash
groupadd --system inkcredible
useradd --system --gid inkcredible --home-dir /opt/inkcredible-pens \
  --shell /usr/sbin/nologin inkcredible
mkdir -p /opt/inkcredible-pens
chown inkcredible:inkcredible /opt/inkcredible-pens
```

4. Clone or copy the project there as that user (or clone as root then `chown -R inkcredible:inkcredible`).
5. Install deps and build:

```bash
cd /opt/inkcredible-pens
sudo -u inkcredible npm ci
sudo -u inkcredible npm run build
```

6. Create `/opt/inkcredible-pens/.env` (never commit this):

```bash
STRIPE_SECRET_KEY=sk_live_...   # or sk_test_ until ready
STRIPE_WEBHOOK_SECRET=whsec_... # REQUIRED — missing secret → webhook 503 in production
ORIGIN=https://inkcredible.kennedyshome.com
NODE_ENV=production
PORT=4242
TRUST_PROXY=2                   # Inkcredible uses Cloudflare → Caddy → Node
ADMIN_PIN=....                  # REQUIRED strong PIN — NOT 1234 (boot refuses default)
# ADMIN_SESSION_SECRET=...      # optional; auto-generated under data/admin/ if omitted
# UPLOAD_RETENTION_DAYS=7
# TRACK17_API_KEY=...          # optional — package watch; see TRACKING.md
# TRACKING_POLL_MINUTES=45
# CHECKOUT_RETENTION_DAYS=7
# CUSTOMER_FILES_DIR=/mnt/customer-files # dedicated paid-order artwork mount
# AUTH0_ISSUER_BASE_URL=https://YOUR-TENANT.us.auth0.com # optional ChatGPT listings
# AUTH0_AUDIENCE=https://inkcredible.kennedyshome.com/mcp
# LISTING_ALLOWED_EMAILS=chadakennedy86@gmail.com,kelliekennedy81@gmail.com
```

```bash
chown inkcredible:inkcredible /opt/inkcredible-pens/.env
chmod 640 /opt/inkcredible-pens/.env
```

7. Ensure data dirs exist with correct ownership (systemd runs as `inkcredible` — mismatched `www-data` causes EACCES on first order/upload):

```bash
mkdir -p data/orders data/catalog data/admin data/checkouts uploads/custom uploads/products uploads/social
chown -R inkcredible:inkcredible data uploads
chmod 750 data data/orders data/catalog data/admin data/checkouts uploads/custom
chmod 755 uploads uploads/products uploads/social # public assets; still owned by inkcredible
# Optional: bind-mount these from a Proxmox volume/dataset
```

For a dedicated paid-order artwork mount, attach Proxmox storage to the LXC at
`/mnt/customer-files`, enable backup for that mount point, and run inside the guest:

```bash
mkdir -p /mnt/customer-files
chown inkcredible:inkcredible /mnt/customer-files
chmod 750 /mnt/customer-files
```

Set `CUSTOMER_FILES_DIR=/mnt/customer-files` in `.env`. Paid artwork is copied into
`YYYY/MM/Customer-Name_IP-order-code/` folders and remains downloadable only through authenticated Store
Manager order records. Abandoned pre-checkout uploads continue to expire separately.

**Disk quota guidance:** customer artwork under `uploads/custom/` can grow. Plan volume size for peak concurrent carts × ~12MB + headroom (e.g. 5–20 GB). Retention jobs (startup + daily) delete abandoned custom uploads / checkout JSON older than 7 days by default, and remove unreferenced product photos.

### Encrypted off-host backups (required for PII)

Proxmox snapshots protect the guest disk, but **orders + customer artwork** should also be copied **off-host** with encryption (restic, borg, age-encrypted tarball to object storage, etc.):

```bash
# Example shape only — pick your tool and keys
# Backup: data/ (orders, checkouts, catalog, scents, admin) + uploads/
# Store encrypted copies off the Proxmox host; test restore quarterly.
```

Checklist item: encrypted off-host backup of `data/` + `uploads/` is configured and a restore has been tested.

8. Run the API under **systemd** as **`inkcredible`** (example unit below).
9. Put a reverse proxy in front (Caddy or nginx) on the guest **or** use Cloudflare Tunnel — see section C.

### Example systemd unit

`/etc/systemd/system/inkcredible.service`:

```ini
[Unit]
Description=Inkcredible Pens API
After=network.target

[Service]
Type=simple
User=inkcredible
Group=inkcredible
WorkingDirectory=/opt/inkcredible-pens
EnvironmentFile=/opt/inkcredible-pens/.env
ExecStart=/usr/bin/node server/stripe-checkout.mjs
Restart=on-failure
# Node binds 127.0.0.1 only — proxy/tunnel is the public face

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now inkcredible
```

Confirm listen address:

```bash
ss -ltnp | grep 4242
# expect 127.0.0.1:4242 — not 0.0.0.0
```

---

## B. Serve the website (frontend)

**Option 1 — Caddy serves `dist/` and proxies API** (recommended):

Production config lives at [`deploy/Caddyfile`](./deploy/Caddyfile):

- `https://inkcredible.kennedyshome.com/` → static SPA from `/opt/inkcredible-pens/dist` (fallback to `index.html`)
- `www.` → permanent redirect to apex
- `/api/*` → `reverse_proxy` → `127.0.0.1:4242`
- `/uploads/*` → `reverse_proxy` → `127.0.0.1:4242` (keeps custom-art admin auth on Node; do not file_server uploads)

TLS is automatic with Caddy when DNS points at this host (see comments in the Caddyfile).

Install / symlink on the guest:

```bash
# After cloning to /opt/inkcredible-pens
apt-get install -y caddy   # or use Caddy's official package
# Prefer a symlink so git pulls pick up Caddyfile changes:
ln -sf /opt/inkcredible-pens/deploy/Caddyfile /etc/caddy/Caddyfile
# Or copy once if you manage the file outside the repo:
# cp /opt/inkcredible-pens/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy
```

Forward the real client IP (Caddy does this by default with `reverse_proxy`). Inkcredible's Cloudflare → Caddy → Node path uses `TRUST_PROXY=2`.

**Option 2 — Cloudflare Tunnel** from the LXC to Cloudflare (no open ports on your router). Point the tunnel public hostname to `http://127.0.0.1:80` (Caddy) or directly to `http://127.0.0.1:4242` if you terminate TLS at Cloudflare and proxy API+static appropriately. Use `TRUST_PROXY=2` for Cloudflare → Caddy → Node, or `1` for Tunnel → Node directly.

SPA note: the shipped Caddyfile uses `try_files` so unknown paths fall back to `index.html` (React Router).

---

## C. Cloudflare DNS

1. Add your domain to Cloudflare; set nameservers at the registrar.
2. Create an **A** or **AAAA** record to the public IP that reaches Proxmox/the tunnel, **or** use a Cloudflare Tunnel hostname.
3. SSL/TLS mode: **Full (strict)** if the origin has a real cert (Caddy); **Full** if Tunnel terminates TLS at Cloudflare.
4. After the domain works, set:

```bash
ORIGIN=https://YOUR_DOMAIN
TRUST_PROXY=2   # Cloudflare orange-cloud → Caddy → Node
```

and restart `inkcredible` so Stripe success/cancel URLs use the real host and rate limits key on real client IPs (not `127.0.0.1`).

5. In Stripe Dashboard → Settings / Branding / Customer emails as you like; for live mode, switch keys only when ready.

---

## D. Every update (after I make changes)

From the guest:

```bash
cd /opt/inkcredible-pens
./scripts/deploy.sh
```

Or manually (as a user that can `sudo -u inkcredible`):

```bash
git pull
sudo -u inkcredible npm ci
sudo -u inkcredible npm run build
systemctl restart inkcredible
# reload caddy/nginx if config changed
```

Confirm:

- Shop loads on `https://YOUR_DOMAIN`
- Checkout → Pay with Stripe returns to your domain
- Store Manager Orders still shows old orders (`data/orders/` intact)
- Shop / Store Manager products come from `data/catalog/products.json` (see CATALOG.md)
- Artwork downloads still work (`uploads/custom/` intact)
- `data/` + `uploads/` still owned by `inkcredible`

---

## E. Pre-launch checklist

- [ ] Strong Store Manager PIN (not `1234`) — production boot refuses default
- [ ] `ORIGIN` = production HTTPS URL
- [ ] `TRUST_PROXY` matches proxy hop count
- [ ] Stripe **test** works end-to-end on the real domain
- [ ] Persistent mounts for `data/orders` + `data/catalog` + `uploads/custom`
- [ ] systemd `User=inkcredible` + correct dir ownership
- [ ] Node listens on `127.0.0.1` only
- [ ] Cloudflare SSL + DNS correct
- [ ] Encrypted off-host backups of `data/` + `uploads/` (not only Proxmox snapshots)
- [ ] Only then: Stripe **live** keys

---

## F. How you + I keep shipping features

1. You ask for a change (same as now).
2. I edit the codebase / we commit to git.
3. On Proxmox you run `./scripts/deploy.sh` (or we automate later).
4. No DNS change for normal app updates.

Tunnel preview can stay for experiments; production is the Proxmox + Cloudflare URL.
