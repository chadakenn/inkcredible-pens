# Package tracking (17TRACK)

When Store Manager saves **carrier + tracking number**, the server can watch the shipment via [17TRACK](https://www.17track.net/) and auto-mark the order **Done** when the carrier reports **Delivered**.

## Setup (Chad)

1. Create a free API account at [https://api.17track.net](https://api.17track.net) (same login as 17TRACK).
2. Open **API settings**: [https://api.17track.net/admin/settings](https://api.17track.net/admin/settings).
3. Copy the **security key / API token**.
4. Put it in production `.env` (never commit):

```bash
TRACK17_API_KEY=your_key_here
# Optional poll interval (minutes). Default 45. Clamped 5–1440.
TRACKING_POLL_MINUTES=45
```

5. Restart the Express server (`npm run stripe:server` / systemd unit).

**Without `TRACK17_API_KEY`:** tracking numbers still save; manual status still works; background watching is **disabled** (server logs a warning). Admin refresh returns `503` with `{ error: "tracking_not_configured" }`.

Free tier quotas apply — register only real shipments. IP whitelist may be required in the 17TRACK dashboard for production hosts.

## Behavior

| Event | Action |
|-------|--------|
| `PATCH /api/orders/:id` with tracking number | Register with 17TRACK (if key set) + immediate status refresh |
| Background poll (`TRACKING_POLL_MINUTES`) | Refresh orders that have a tracking #, are not cancelled, and are not already delivered |
| Normalized status `delivered` | Set `status='done'`, set `deliveredAt` once (idempotent) |

### Order fields (optional)

- `trackingStatus`: `unknown` \| `pre_transit` \| `in_transit` \| `out_for_delivery` \| `delivered` \| `exception` \| `expired`
- `trackingDetail`: short human string from provider
- `trackingCheckedAt`: ISO last check
- `deliveredAt`: ISO when first marked delivered

Existing statuses stay: `new` \| `in_progress` \| `done` \| `cancelled`. Delivered ⇒ **Done** + Delivered badge (via `deliveredAt` / `trackingStatus`).

### Carrier codes (17TRACK)

| UI carrier | 17TRACK code |
|------------|--------------|
| USPS | 21051 |
| UPS | 100002 |
| FedEx | 100003 |
| DHL | 100001 |
| Other | auto-detect (omit code) |

## Admin API

All require admin Bearer token (see [SECURITY.md](./SECURITY.md)).

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/orders/:id/tracking/refresh` | Force check one order → `{ order }` |
| `POST` | `/api/orders/tracking/refresh-all` | Poll all watchable orders |

`TRACK17_API_KEY` is **server-only** — never sent to the browser.

## Store Manager UI

- Chip for In transit / Out for delivery / Delivered / Exception on order cards
- Expanded: detail + last checked + **Refresh tracking**
- Carrier public tracking link (USPS / UPS / FedEx / DHL URL templates)

## Code

- `server/tracking.mjs` — 17TRACK client, poll, mount routes
- Hooked from `server/orders.mjs` PATCH + `server/stripe-checkout.mjs` boot
