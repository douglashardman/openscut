#!/usr/bin/env bash
# Pull latest main, rebuild, restart all SCUT services.
# Services restart sequentially with a short overlap window (~3 seconds
# of resolver unavailability, ~3 seconds of relay/register unavailability).
# Since relay depends on resolver at startup, we restart resolver first.

set -euo pipefail

SCUT_REPO_DIR=${SCUT_REPO_DIR:-/opt/openscut}
SCUT_ETC=${SCUT_ETC:-/etc/scut}

log() { printf '\n==> %s\n' "$*"; }

cd "$SCUT_REPO_DIR"

log 'pulling latest main'
git fetch --tags origin main
git reset --hard origin/main

# Reclaim ownership of any dist directories that an earlier release of
# update.sh chowned to scut. pnpm install otherwise EPERMs while
# chmodding bin shims that resolve into packages/*/dist. Suppress
# errors when the directories do not yet exist on a fresh checkout.
sudo chown -R "$(id -u):$(id -g)" \
    packages/relay/dist \
    packages/resolver/dist \
    packages/register/dist 2>/dev/null || true

log 'installing deps + rebuilding'
pnpm install --frozen-lockfile
pnpm --filter @openscut/core run build
pnpm --filter scut-resolver run build
pnpm --filter scut-relay run build
pnpm --filter scut-register run build

# If the systemd unit was added since this droplet last ran install.sh,
# install it on the fly so update.sh keeps the unit list in sync with
# what the repo declares.
if [[ ! -f /etc/systemd/system/scut-register.service ]]; then
    log 'installing scut-register systemd unit'
    sudo install -m 644 ops/systemd/scut-register.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable scut-register.service
fi
if ! sudo test -f "$SCUT_ETC/register.env"; then
    log 'writing /etc/scut/register.env (wallet key MUST be filled in manually)'
    sudo install -m 640 -o root -g scut ops/env/register.env.example "$SCUT_ETC/register.env"
fi

log 'restarting services'
sudo systemctl restart scut-resolver.service
sleep 2
sudo systemctl restart scut-relay.service
sleep 2
# /etc/scut/register.env is 0640 root:scut and the operator running this
# script is not in the scut group, so the grep needs sudo. Default to
# "not configured" if we cannot prove otherwise so we never start a
# service against the placeholder.
register_key_configured=false
if sudo test -f "$SCUT_ETC/register.env"; then
    if ! sudo grep -q "^SCUT_REGISTER_WALLET_KEY=0x__FILL_THIS_IN_BY_HAND__$" "$SCUT_ETC/register.env"; then
        register_key_configured=true
    fi
fi
if $register_key_configured; then
    sudo systemctl restart scut-register.service
    sleep 2
    sudo systemctl is-active scut-register.service
else
    log 'skipping scut-register restart: wallet key not yet configured'
fi
sudo systemctl is-active scut-resolver.service
sudo systemctl is-active scut-relay.service

# Drop the SCUT services fragment into /etc/caddy/conf.d/. The main
# /etc/caddy/Caddyfile is owned by the droplet operator (not this
# repo); update.sh never writes it. The operator's Caddyfile must
# include `import /etc/caddy/conf.d/*.caddy` for this fragment to be
# picked up.
log 'installing /etc/caddy/conf.d/openscut-services.caddy'
sudo mkdir -p /etc/caddy/conf.d
sudo install -m 644 ops/caddy/openscut-services.caddy /etc/caddy/conf.d/openscut-services.caddy

if ! sudo grep -q "import /etc/caddy/conf.d" /etc/caddy/Caddyfile 2>/dev/null; then
    echo
    echo "  WARNING: /etc/caddy/Caddyfile does not import /etc/caddy/conf.d/*.caddy."
    echo "  The fragment we just installed will not take effect until the operator"
    echo "  adds 'import /etc/caddy/conf.d/*.caddy' to /etc/caddy/Caddyfile."
    echo
fi

# Use the admin API ('caddy reload') instead of 'systemctl reload caddy'.
# The systemd reload-notify protocol on the unit has been observed to
# hang on this droplet; the admin API reload is the operator-supported
# path per Simon as of 2026-04-28.
log 'reloading caddy via admin API'
sudo caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile

log 'update complete'
