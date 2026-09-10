#!/usr/bin/env bash
# Run on the Proxmox guest from the app root (e.g. /opt/inkcredible-pens).
# Sacred (never delete/replace these): data/  uploads/  .env
# App runs as system user `inkcredible` — keep data/uploads owned by that user.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

APP_USER="${INKCREDIBLE_USER:-inkcredible}"
APP_GROUP="${INKCREDIBLE_GROUP:-inkcredible}"

echo "==> App root: $ROOT"

# Refuse to run if someone pointed us at a weird path
if [[ ! -f package.json ]]; then
  echo "ERROR: no package.json here — aborting."
  exit 1
fi

ensure_sacred_dirs() {
  mkdir -p data/orders data/catalog data/admin data/checkouts uploads/custom uploads/products uploads/social
  if id "$APP_USER" >/dev/null 2>&1; then
    chown -R "$APP_USER:$APP_GROUP" data uploads 2>/dev/null || \
      sudo chown -R "$APP_USER:$APP_GROUP" data uploads
    chmod 750 data data/orders data/catalog data/admin data/checkouts uploads/custom 2>/dev/null || true
    chmod 755 uploads uploads/products uploads/social 2>/dev/null || true
    if [[ -f .env ]]; then
      chown "$APP_USER:$APP_GROUP" .env 2>/dev/null || sudo chown "$APP_USER:$APP_GROUP" .env || true
      chmod 640 .env 2>/dev/null || true
    fi
  else
    echo "==> WARNING: user '$APP_USER' not found — create it before production (see DEPLOY.md)"
  fi
}

# Snapshot sacred paths exist before pull/build
ensure_sacred_dirs
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

# Re-assert sacred dirs after pull (ownership so first order/upload does not EACCES)
ensure_sacred_dirs

run_as_app() {
  if [[ "$(id -un)" == "$APP_USER" ]]; then
    "$@"
  elif id "$APP_USER" >/dev/null 2>&1; then
    sudo -u "$APP_USER" "$@"
  else
    "$@"
  fi
}

echo "==> Install + build (replaces node_modules + dist only)"
run_as_app npm ci
run_as_app npm run build

echo "==> Restart API"
if systemctl list-unit-files inkcredible.service >/dev/null 2>&1 && \
   systemctl is-enabled inkcredible >/dev/null 2>&1; then
  sudo systemctl restart inkcredible
  sudo systemctl --no-pager --full status inkcredible | head -20
else
  echo "    systemd unit 'inkcredible' not found — start Node manually with .env loaded"
fi

echo "==> Sacred paths still present:"
ls -ld data data/orders data/catalog data/admin data/checkouts uploads uploads/custom uploads/products uploads/social 2>/dev/null || true
[[ -f .env ]] && echo "    .env OK" || echo "    .env MISSING"

echo "==> Done. Spot-check https://YOUR_DOMAIN , Orders, and uploads."
