#!/usr/bin/env bash
# Run on the Proxmox guest from the app root (e.g. /opt/inkcredible-pens).
# Sacred (never delete/replace these): data/  uploads/  .env
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "==> App root: $ROOT"

# Refuse to run if someone pointed us at a weird path
if [[ ! -f package.json ]]; then
  echo "ERROR: no package.json here — aborting."
  exit 1
fi

# Snapshot sacred paths exist before pull/build
mkdir -p data/orders data/catalog uploads/custom
if [[ -f .env ]]; then
  echo "==> .env present (will not overwrite)"
else
  echo "==> WARNING: no .env yet — create one before Stripe"
fi

echo "==> Pull application code (sacred dirs untouched by git if gitignored)"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  # Safety: never use clean -fdx that could sweep untracked data/
  git pull --ff-only
else
  echo "    (no git repo — skipped pull)"
fi

# Re-assert sacred dirs after pull
mkdir -p data/orders data/catalog uploads/custom

echo "==> Install + build (replaces node_modules + dist only)"
npm ci
npm run build

echo "==> Restart API"
if systemctl list-unit-files inkcredible.service >/dev/null 2>&1 && \
   systemctl is-enabled inkcredible >/dev/null 2>&1; then
  sudo systemctl restart inkcredible
  sudo systemctl --no-pager --full status inkcredible | head -20
else
  echo "    systemd unit 'inkcredible' not found — start Node manually with .env loaded"
fi

echo "==> Sacred paths still present:"
ls -ld data data/orders data/catalog uploads uploads/custom 2>/dev/null || true
[[ -f .env ]] && echo "    .env OK" || echo "    .env MISSING"

echo "==> Done. Spot-check https://YOUR_DOMAIN , Orders, and uploads."
