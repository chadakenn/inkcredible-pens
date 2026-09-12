#!/usr/bin/env bash
# Safely deploy origin/main when GitHub has a newer commit.
# Intended to run as root from inkcredible-auto-update.service.
set -Eeuo pipefail

APP_ROOT="${INKCREDIBLE_ROOT:-/opt/inkcredible-pens}"
APP_USER="${INKCREDIBLE_USER:-inkcredible}"
APP_GROUP="${INKCREDIBLE_GROUP:-inkcredible}"
BRANCH="${INKCREDIBLE_BRANCH:-main}"
LOCK_FILE="${INKCREDIBLE_UPDATE_LOCK:-/run/lock/inkcredible-auto-update.lock}"
STATE_DIR="${INKCREDIBLE_UPDATE_STATE_DIR:-/var/lib/inkcredible-auto-update}"
DEPLOYED_FILE="$STATE_DIR/deployed-sha"
NPM_CACHE="${INKCREDIBLE_NPM_CACHE:-/var/cache/inkcredible-npm}"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[auto-update] another update is already running; skipping"
  exit 0
fi

cd "$APP_ROOT"
[[ -d .git && -f package.json ]] || {
  echo "[auto-update] ERROR: $APP_ROOT is not an Inkcredible git checkout"
  exit 1
}

install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$NPM_CACHE"
install -d -o root -g root -m 0755 "$STATE_DIR"

echo "[auto-update] checking origin/$BRANCH"
git fetch --quiet origin "$BRANCH"

CURRENT_SHA="$(git rev-parse HEAD)"
TARGET_SHA="$(git rev-parse "origin/$BRANCH")"
DEPLOYED_SHA="$(cat "$DEPLOYED_FILE" 2>/dev/null || true)"
if [[ "$CURRENT_SHA" == "$TARGET_SHA" && "$DEPLOYED_SHA" == "$TARGET_SHA" ]]; then
  echo "[auto-update] already current at ${CURRENT_SHA:0:8}"
  exit 0
fi

if [[ "$CURRENT_SHA" != "$TARGET_SHA" ]] && ! git merge-base --is-ancestor "$CURRENT_SHA" "$TARGET_SHA"; then
  echo "[auto-update] ERROR: origin/$BRANCH is not a fast-forward; refusing"
  exit 1
fi

# Never overwrite hand-edited tracked files on the server.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "[auto-update] ERROR: tracked server files have local changes; refusing"
  git status --short --untracked-files=no
  exit 1
fi

STAGE_DIR="$(mktemp -d /opt/inkcredible-update.XXXXXX)"
cleanup() {
  git worktree remove --force "$STAGE_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[auto-update] preflight build ${TARGET_SHA:0:8} in staging"
git worktree add --quiet --detach "$STAGE_DIR" "$TARGET_SHA"
chown -R "$APP_USER:$APP_GROUP" "$STAGE_DIR"
sudo -u "$APP_USER" env NPM_CONFIG_CACHE="$NPM_CACHE" npm --prefix "$STAGE_DIR" ci --no-audit --no-fund
sudo -u "$APP_USER" env NPM_CONFIG_CACHE="$NPM_CACHE" npm --prefix "$STAGE_DIR" run build

echo "[auto-update] staging passed; advancing live checkout"
git merge --ff-only "$TARGET_SHA"

# Install exact dependencies only after the candidate has successfully built.
# A first manual install may have left node_modules owned by root.
if [[ -d node_modules ]]; then
  chown -R "$APP_USER:$APP_GROUP" node_modules
fi
sudo -u "$APP_USER" env NPM_CONFIG_CACHE="$NPM_CACHE" npm ci --no-audit --no-fund

# The staged dist is known-good. Swap it in without exposing a partial build.
NEXT_DIST="$APP_ROOT/.dist-next-$TARGET_SHA"
PREVIOUS_DIST="$APP_ROOT/.dist-previous"
rm -rf "$NEXT_DIST"
cp -a "$STAGE_DIR/dist" "$NEXT_DIST"
chown -R "$APP_USER:$APP_GROUP" "$NEXT_DIST"
rm -rf "$PREVIOUS_DIST"

printf '%s\n' "$TARGET_SHA" > "$DEPLOYED_FILE.tmp"
mv "$DEPLOYED_FILE.tmp" "$DEPLOYED_FILE"
if [[ -d dist ]]; then
  mv dist "$PREVIOUS_DIST"
fi
mv "$NEXT_DIST" dist

if ! systemctl restart inkcredible.service; then
  echo "[auto-update] ERROR: restart failed; restoring previous frontend"
  rm -rf dist
  if [[ -d "$PREVIOUS_DIST" ]]; then
    mv "$PREVIOUS_DIST" dist
  fi
  systemctl restart inkcredible.service || true
  exit 1
fi
rm -rf "$PREVIOUS_DIST"

# Caddyfile is normally symlinked into the repo; validate before reloading it.
if command -v caddy >/dev/null 2>&1 && systemctl is-active --quiet caddy.service; then
  if caddy validate --config /etc/caddy/Caddyfile >/dev/null; then
    systemctl reload caddy.service
  else
    echo "[auto-update] WARNING: Caddy config did not validate; not reloaded"
  fi
fi

echo "[auto-update] deployed ${TARGET_SHA:0:8} successfully"
