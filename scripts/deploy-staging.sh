#!/usr/bin/env bash
# Manual deploy-staging script. Useful when GitHub Actions deploy-staging.yml is
# unavailable (token expired, CI hiccup) or for a one-off rebuild.
#
# Runs as the ghs user (sudo -n -u ghs). Pulls staging branch, installs deps,
# regenerates Prisma client, restarts PM2-managed staging process.
#
# Usage:  bash scripts/deploy-staging.sh

set -euo pipefail

STAGING_DIR="/home/ghs/giohomestudio-staging"

if [[ "$EUID" -ne 0 && "$(whoami)" != "ghs" ]]; then
  echo "[deploy-staging] re-execing as ghs user..."
  exec sudo -n -u ghs bash "$0" "$@"
fi

cd "$STAGING_DIR"

echo "[deploy-staging] fetching staging branch..."
git fetch origin staging:refs/remotes/origin/staging 2>/dev/null || git fetch origin
git reset --hard origin/staging

echo "[deploy-staging] installing deps..."
pnpm install --frozen-lockfile

echo "[deploy-staging] generating prisma client..."
# Sourcery flagged that '|| true' here would hide schema / migration errors.
# Let it fail loud — a broken Prisma client is a deploy-killing problem we
# want surfaced immediately, not silenced. If you genuinely need to skip it
# (e.g. dev environment without a DB), set SKIP_PRISMA_GENERATE=1 explicitly.
if [[ "${SKIP_PRISMA_GENERATE:-0}" == "1" ]]; then
  echo "[deploy-staging] SKIP_PRISMA_GENERATE=1 set — skipping"
else
  pnpm prisma generate
fi

echo "[deploy-staging] restarting via PM2..."
if pm2 describe ghs-staging >/dev/null 2>&1; then
  pm2 restart ghs-staging --update-env
else
  pm2 start scripts/ecosystem.staging.config.cjs
fi

sleep 8

if curl -sf -m 10 -o /dev/null http://localhost:3201/unlock; then
  echo "[deploy-staging] OK — port 3201 responding"
  pm2 save
else
  echo "[deploy-staging] WARN — port 3201 not responding"
  pm2 logs ghs-staging --lines 30 --nostream || true
  exit 1
fi
