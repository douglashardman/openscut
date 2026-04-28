#!/usr/bin/env bash
# Pull latest main, rebuild, restart all SCUT services.
# Services restart sequentially with a short overlap window (~3 seconds
# of resolver unavailability, ~3 seconds of relay/register unavailability).
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
pnpm --filter scut-register run build

sudo chown -R scut:scut packages/relay/dist packages/resolver/dist packages/register/dist

# If the systemd unit was added since this droplet last ran install.sh,
# install it on the fly so update.sh keeps the unit list in sync with
# what the repo declares.
if [[ ! -f /etc/systemd/system/scut-register.service ]]; then
    log 'installing scut-register systemd unit'
    sudo install -m 644 ops/systemd/scut-register.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable scut-register.service
fi
if [[ ! -f /etc/scut/register.env ]]; then
    log 'writing /etc/scut/register.env (wallet key MUST be filled in manually)'
    sudo install -m 640 -o root -g scut ops/env/register.env.example /etc/scut/register.env
fi

log 'restarting services'
sudo systemctl restart scut-resolver.service
sleep 2
sudo systemctl restart scut-relay.service
sleep 2
if grep -q "^SCUT_REGISTER_WALLET_KEY=0x__FILL_THIS_IN_BY_HAND__$" /etc/scut/register.env; then
    log 'skipping scut-register restart: wallet key not yet configured'
else
    sudo systemctl restart scut-register.service
    sleep 2
    sudo systemctl is-active scut-register.service
fi
sudo systemctl is-active scut-resolver.service
sudo systemctl is-active scut-relay.service

# Caddyfile may have grown a new vhost in this release; reload caddy
# so the new register.openscut.ai vhost gets picked up. Cert issuance
# happens in the background; first request after reload may 502 for
# ~30 seconds while ACME runs.
log 'reloading caddy with current Caddyfile'
sudo install -m 644 ops/caddy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy

log 'update complete'
