#!/usr/bin/env bash
# Pull latest main, rebuild, restart scut-resolver and scut-relay.
# Services restart sequentially with a short overlap window (~3 seconds
# of resolver unavailability, ~3 seconds of relay unavailability).
# Since relay depends on resolver at startup, we restart resolver first.

set -euo pipefail

SCUT_REPO_DIR=${SCUT_REPO_DIR:-/opt/openscut}

log() { printf '\n==> %s\n' "$*"; }

cd "$SCUT_REPO_DIR"

log 'pulling latest main'
git fetch --tags origin main
git reset --hard origin/main

log 'installing deps + rebuilding'
pnpm install --frozen-lockfile
pnpm --filter @openscut/core run build
pnpm --filter scut-resolver run build
pnpm --filter scut-relay run build

sudo chown -R scut:scut packages/relay/dist packages/resolver/dist

log 'restarting services'
sudo systemctl restart scut-resolver.service
sleep 2
sudo systemctl restart scut-relay.service
sleep 2
sudo systemctl is-active scut-resolver.service
sudo systemctl is-active scut-relay.service

log 'update complete'
