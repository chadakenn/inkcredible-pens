# Paid-order email notifications

Inkcredible Pens can send two emails after a paid Stripe order is persisted:

1. A shop-owner notification with customer, shipping, item/customization, totals, and a Store Manager link.
2. A customer confirmation with the order code, items, total paid, and shipping address.

Email delivery runs in a separate Node worker (`server/email-worker.mjs`). The Stripe webhook and order write do not wait on Resend, so an email outage cannot prevent a paid order from being saved.

## Resend setup

1. Create a Resend account.
2. In Resend, add and verify the sending domain `inkcredible.kennedyshome.com`.
3. Add the DNS records Resend provides to the DNS provider that manages `kennedyshome.com`.
4. Wait until Resend shows the domain as verified.
5. Create a Resend API key with permission to send email.
6. Never commit that API key. Put it only in `/opt/inkcredible-pens/.env` on the server.

Recommended production values:

```dotenv
RESEND_API_KEY=re_your_real_key_here
ORDER_FROM_EMAIL=Inkcredible Pens <orders@inkcredible.kennedyshome.com>
ORDER_NOTIFICATION_EMAIL=inkcredible.pens@gmail.com
ORDER_REPLY_TO=inkcredible.pens@gmail.com
EMAIL_POLL_SECONDS=15
EMAIL_SEND_EXISTING_ORDERS=0
```

### Do I need to create an orders mailbox?

No. You do **not** need to create an inbox or email account for `orders@inkcredible.kennedyshome.com`. It is the From address that Resend uses after the domain is verified.

Customer replies are directed to `ORDER_REPLY_TO`, which is set to `inkcredible.pens@gmail.com`. That existing Gmail inbox receives the replies.

`ORDER_FROM_EMAIL` must use the domain accepted by Resend. During initial testing, use the sender Resend permits. After `inkcredible.kennedyshome.com` is verified, use `Inkcredible Pens <orders@inkcredible.kennedyshome.com>`.

## First deployment on Proxmox

The application lives at `/opt/inkcredible-pens` and runs as the dedicated `inkcredible` user.

Pull and validate the new code:

```bash
cd /opt/inkcredible-pens
git pull
npm ci
npm run lint
npm run build
node --check server/email-worker.mjs
```

Create the persistent email state directory:

```bash
mkdir -p /opt/inkcredible-pens/data/email
chown -R inkcredible:inkcredible /opt/inkcredible-pens/data/email
chmod 750 /opt/inkcredible-pens/data/email
```

Edit the server environment file and add the Resend variables:

```bash
nano /opt/inkcredible-pens/.env
```

Keep the existing Stripe/admin values. Do not paste secrets into chat, GitHub, documentation, or screenshots.

Install the worker service:

```bash
cp /opt/inkcredible-pens/deploy/inkcredible-email.service /etc/systemd/system/inkcredible-email.service
systemctl daemon-reload
systemctl enable --now inkcredible-email
systemctl status inkcredible-email --no-pager -l
```

View worker logs:

```bash
journalctl -u inkcredible-email -n 100 --no-pager
journalctl -u inkcredible-email -f
```

## Existing orders on first startup

By default, the first configured worker startup records already-existing paid Stripe orders as `preexisting_order` and does not email them. This prevents a new email feature from blasting confirmations for historical/test orders.

If you intentionally want to backfill existing paid Stripe orders, set:

```dotenv
EMAIL_SEND_EXISTING_ORDERS=1
```

Do that only before the state file is first initialized. Return it to `0` afterward.

## Delivery state and duplicate protection

The worker stores delivery state in:

```text
data/email/email-state.json
```

Owner and customer delivery are tracked independently. Failed sends are retried with exponential backoff, beginning at roughly 30 seconds and capped around one hour.

Each Resend request also uses a stable idempotency key based on the order ID and recipient type, for example:

```text
paid-order/owner/<order-id>
paid-order/customer/<order-id>
```

The worker never edits `data/orders/orders.json` just to record email state.

## What is eligible for email

Only records that have all of the following are processed:

- `paid === true`
- an order `id`
- a `stripeSessionId`

Manual/unpaid orders are not mailed by this worker.

## Safe test

After the worker is configured and running:

1. Place a Stripe test-mode order through the public test site.
2. Confirm Stripe shows `checkout.session.completed` delivered with HTTP 200.
3. Confirm the order appears in Store Manager / `data/orders/orders.json`.
4. Watch `journalctl -u inkcredible-email -f` for owner/customer send results.
5. Verify the owner and customer inboxes receive the expected messages.

Do not claim Resend delivery succeeded unless the worker logs and/or Resend dashboard confirm it.

## Troubleshooting

If the worker says email is disabled, check that `RESEND_API_KEY` and `ORDER_FROM_EMAIL` are present in `/opt/inkcredible-pens/.env`, then restart:

```bash
systemctl restart inkcredible-email
```

If Resend rejects the sender, verify `inkcredible.kennedyshome.com` in Resend and make sure `ORDER_FROM_EMAIL` exactly matches an allowed sender.

If a customer email is skipped, verify the paid order contains a valid `customer.email`.

If a send fails temporarily, leave the worker running. It will retry automatically. Delivery state and the latest error are recorded in `data/email/email-state.json`.
