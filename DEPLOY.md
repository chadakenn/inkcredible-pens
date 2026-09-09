# Proxmox + Cloudflare deploy checklist

## Target layout

```
/opt/inkcredible-pens/
├── dist/                 # vite build (replaceable)
├── server/               # Express API (replaceable)
├── scripts/deploy.sh
├── data/                 # SACRED — persistent volume
│   ├── orders/
│   └── catalog/          # server-side product catalog (products.json)
├── uploads/              # SACRED
│   └── custom/
├── .env                  # SACRED — never in git
└── package.json
```

**Sacred ground** (deploy may bulldoze app code; never wipe these): `data/`, `uploads/`, `.env`.

Product catalog is **server JSON** under `data/catalog/` (not browser localStorage). Details: [CATALOG.md](./CATALOG.md).

## Progression

1. **Prototype** (now) — tunnel preview, mixed localStorage + server orders/uploads  
2. **Proxmox persistent deploy** — this doc  
3. **Real-domain Stripe testing** — `ORIGIN=https://…`, test keys, then webhook “paid”  
4. **Server-side catalog** — ✅ JSON under `data/catalog/` (see [CATALOG.md](./CATALOG.md); localStorage is cache only)  
5. **Protected admin product APIs** — `GET/POST/PATCH /api/admin/products` (+ images/publish) for remote add/edit  
6. **PostgreSQL** — only if/when JSON/SQLite outgrows the store  

Stripe hardening (before live charges): Express accepts product IDs/options → loads **server** prices → creates Checkout → **webhook** marks order paid → write `data/orders/`. Browser never has final say on price.

---

## A. One-time: Proxmox guest

1. Create an **LXC or VM** (Debian/Ubuntu 22.04+ is fine). Give it a static LAN IP.
2. Install Node 20+:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git
```

3. Create an app user and directory, e.g. `/opt/inkcredible-pens`.
4. Clone or copy the project there (git remote recommended so updates are `git pull`).
5. Install deps and build:

```bash
cd /opt/inkcredible-pens
npm ci
npm run build
```

6. Create `/opt/inkcredible-pens/.env` (never commit this):

```bash
STRIPE_SECRET_KEY=sk_test_...   # switch to sk_live_ only when ready
ORIGIN=https://YOUR_DOMAIN
PORT=4242
```

7. Ensure data dirs exist and survive:

```bash
mkdir -p data/orders data/catalog uploads/custom
# Optional: bind-mount these from a Proxmox volume/dataset
```

8. Run the API under **systemd** (example unit below) so it restarts on reboot.
9. Put a reverse proxy in front (Caddy or nginx) on the guest **or** use Cloudflare Tunnel — see section C.

### Example systemd unit

`/etc/systemd/system/inkcredible.service`:

```ini
[Unit]
Description=Inkcredible Pens API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/inkcredible-pens
EnvironmentFile=/opt/inkcredible-pens/.env
ExecStart=/usr/bin/node server/stripe-checkout.mjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now inkcredible
```

---

## B. Serve the website (frontend)

**Option 1 — Caddy/nginx serves `dist/` and proxies API** (recommended):

- `https://YOUR_DOMAIN/` → static files from `dist/`
- `https://YOUR_DOMAIN/api/*` → `http://127.0.0.1:4242`
- `https://YOUR_DOMAIN/uploads/*` → `http://127.0.0.1:4242` (or alias to disk)

**Option 2 — Cloudflare Tunnel** from the LXC to Cloudflare (no open ports on your router). Point the tunnel public hostname to `http://127.0.0.1:80` (Caddy) or directly to the Node stack if you add static serving later.

SPA note: configure the web server so unknown paths fall back to `index.html` (React Router).

---

## C. Cloudflare DNS

1. Add your domain to Cloudflare; set nameservers at the registrar.
2. Create an **A** or **AAAA** record to the public IP that reaches Proxmox/the tunnel, **or** use a Cloudflare Tunnel hostname.
3. SSL/TLS mode: **Full (strict)** if the origin has a real cert (Caddy); **Full** if Tunnel terminates TLS at Cloudflare.
4. After the domain works, set:

```bash
ORIGIN=https://YOUR_DOMAIN
```

and restart `inkcredible` so Stripe success/cancel URLs use the real host (not `127.0.0.1` or the old trycloudflare URL).

5. In Stripe Dashboard → Settings / Branding / Customer emails as you like; for live mode, switch keys only when ready.

---

## D. Every update (after I make changes)

From the guest:

```bash
cd /opt/inkcredible-pens
./scripts/deploy.sh
```

Or manually:

```bash
git pull
npm ci
npm run build
systemctl restart inkcredible
# reload caddy/nginx if config changed
```

Confirm:

- Shop loads on `https://YOUR_DOMAIN`
- Checkout → Pay with Stripe returns to your domain
- Store Manager Orders still shows old orders (`data/orders/` intact)
- Shop / Store Manager products come from `data/catalog/products.json` (see CATALOG.md)
- Artwork downloads still work (`uploads/custom/` intact)

---

## E. Pre-launch checklist

- [ ] Change Store Manager access code (no longer demo `1234`)
- [ ] `ORIGIN` = production HTTPS URL
- [ ] Stripe **test** works end-to-end on the real domain
- [ ] Persistent mounts for `data/orders` + `data/catalog` + `uploads/custom`
- [ ] systemd enabled
- [ ] Cloudflare SSL + DNS correct
- [ ] Only then: Stripe **live** keys

---

## F. How you + I keep shipping features

1. You ask for a change (same as now).
2. I edit the codebase / we commit to git.
3. On Proxmox you run `./scripts/deploy.sh` (or we automate later).
4. No DNS change for normal app updates.

Tunnel preview can stay for experiments; production is the Proxmox + Cloudflare URL.
