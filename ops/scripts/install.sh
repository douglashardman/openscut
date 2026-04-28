#!/usr/bin/env bash
# Initial deployment of scut-relay and scut-resolver on Ubuntu 24.04.
#
# Runs from a checkout of this repo at /opt/openscut. Idempotent where
# safe; rerunning will not regenerate the events token or overwrite
# existing env files.
#
# Usage:
#   sudo mkdir -p /opt/openscut
#   sudo chown $(whoami):$(whoami) /opt/openscut
#   git clone https://github.com/douglashardman/openscut.git /opt/openscut
#   cd /opt/openscut
#   ops/scripts/install.sh

set -euo pipefail

SCUT_REPO_DIR=${SCUT_REPO_DIR:-/opt/openscut}
SCUT_ETC=${SCUT_ETC:-/etc/scut}
SCUT_LIB=${SCUT_LIB:-/var/lib/scut}
NODE_MAJOR=20
PNPM_VERSION=8.15.9

log() { printf '\n==> %s\n' "$*"; }

# ---------- prerequisites ----------

log 'installing prerequisites'

if ! command -v curl >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y curl ca-certificates gnupg
fi

# Node.js via NodeSource
if ! command -v node >/dev/null 2>&1 || ! node --version | grep -q "^v${NODE_MAJOR}\."; then
    log "installing node ${NODE_MAJOR}.x"
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# pnpm via corepack
if ! command -v pnpm >/dev/null 2>&1; then
    log "enabling pnpm ${PNPM_VERSION} via corepack"
    sudo corepack enable
    sudo corepack prepare "pnpm@${PNPM_VERSION}" --activate
fi

# Build tools (better-sqlite3 has a small native component; prebuilds cover
# Ubuntu 24 but install build-essential as a safety net).
if ! dpkg -s build-essential >/dev/null 2>&1; then
    sudo apt-get install -y build-essential python3
fi

# Caddy from the official repo
if ! command -v caddy >/dev/null 2>&1; then
    log 'installing caddy'
    sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
        | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
        | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    sudo apt-get update
    sudo apt-get install -y caddy
fi

# ---------- service user ----------

if ! id scut >/dev/null 2>&1; then
    log 'creating scut service user'
    sudo useradd --system --no-create-home --home-dir "$SCUT_LIB" --shell /usr/sbin/nologin scut
fi

# ---------- directories ----------

log 'preparing directories'
sudo mkdir -p "$SCUT_REPO_DIR" "$SCUT_ETC" "$SCUT_LIB" /var/log/caddy
sudo chown scut:scut "$SCUT_LIB"
sudo chown root:scut "$SCUT_ETC"
sudo chmod 750 "$SCUT_ETC"

# ---------- repo state ----------

if [[ ! -d "$SCUT_REPO_DIR/.git" ]]; then
    echo "expected a git checkout at $SCUT_REPO_DIR (clone the repo there first)"
    exit 1
fi

log 'building repo (pnpm install + package builds)'
cd "$SCUT_REPO_DIR"
# The scut user owns /var/lib/scut but the repo checkout is owned by the
# human operator who cloned it. pnpm runs as the operator so install can
# write node_modules; the scut service user reads the built files.
pnpm install --frozen-lockfile
pnpm --filter @openscut/core run build
pnpm --filter scut-resolver run build
pnpm --filter scut-relay run build
pnpm --filter scut-register run build

# Make the compiled entries executable for the service user
sudo chown -R scut:scut \
    "$SCUT_REPO_DIR/packages/relay/dist" \
    "$SCUT_REPO_DIR/packages/resolver/dist" \
    "$SCUT_REPO_DIR/packages/register/dist"

# ---------- env files ----------

if [[ ! -f "$SCUT_ETC/resolver.env" ]]; then
    log 'writing /etc/scut/resolver.env'
    sudo install -m 640 -o root -g scut "$SCUT_REPO_DIR/ops/env/resolver.env.example" "$SCUT_ETC/resolver.env"
fi

if [[ ! -f "$SCUT_ETC/relay.env" ]]; then
    log 'writing /etc/scut/relay.env with a fresh events token'
    EVENTS_TOKEN=$(openssl rand -hex 32)
    sudo install -m 640 -o root -g scut "$SCUT_REPO_DIR/ops/env/relay.env.example" "$SCUT_ETC/relay.env"
    sudo sed -i "s|^SCUT_RELAY_EVENTS_TOKEN=.*|SCUT_RELAY_EVENTS_TOKEN=${EVENTS_TOKEN}|" "$SCUT_ETC/relay.env"
fi

if [[ ! -f "$SCUT_ETC/register.env" ]]; then
    log 'writing /etc/scut/register.env (wallet key MUST be filled in manually)'
    sudo install -m 640 -o root -g scut "$SCUT_REPO_DIR/ops/env/register.env.example" "$SCUT_ETC/register.env"
    echo
    echo "  ACTION REQUIRED: edit $SCUT_ETC/register.env and replace"
    echo "  SCUT_REGISTER_WALLET_KEY=0x__FILL_THIS_IN_BY_HAND__ with the real key"
    echo "  before starting scut-register.service."
    echo
fi

# ---------- systemd units ----------

log 'installing systemd units'
sudo install -m 644 "$SCUT_REPO_DIR/ops/systemd/scut-resolver.service" /etc/systemd/system/
sudo install -m 644 "$SCUT_REPO_DIR/ops/systemd/scut-relay.service" /etc/systemd/system/
sudo install -m 644 "$SCUT_REPO_DIR/ops/systemd/scut-register.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable scut-resolver.service scut-relay.service scut-register.service
sudo systemctl restart scut-resolver.service
sleep 2
sudo systemctl restart scut-relay.service
# Only start scut-register if the wallet key has been filled in...
# starting it before that just produces an immediate restart loop.
if grep -q "^SCUT_REGISTER_WALLET_KEY=0x__FILL_THIS_IN_BY_HAND__$" "$SCUT_ETC/register.env"; then
    log 'skipping scut-register restart: wallet key not yet configured'
else
    sudo systemctl restart scut-register.service
fi

# ---------- caddy ----------

log 'installing Caddyfile and reloading caddy'
sudo install -m 644 "$SCUT_REPO_DIR/ops/caddy/Caddyfile" /etc/caddy/Caddyfile
sudo systemctl reload caddy

# ---------- verify ----------

sleep 2
log 'verifying services'
sudo systemctl is-active scut-resolver.service
sudo systemctl is-active scut-relay.service
sudo systemctl is-active caddy.service

log 'local health checks'
curl -sSf http://127.0.0.1:8444/health
echo
curl -sSf http://127.0.0.1:8443/health
echo
if sudo systemctl is-active scut-register.service >/dev/null 2>&1; then
    curl -sSf http://127.0.0.1:8445/scut/v1/health
    echo
fi

log 'install complete'
echo
echo "events token for scut-monitor:  sudo cat $SCUT_ETC/relay.env | grep SCUT_RELAY_EVENTS_TOKEN"
echo "public endpoints after DNS + Caddy cert issuance (may take a minute):"
echo "  https://relay.openscut.ai/health"
echo "  https://resolver.openscut.ai/scut/v1/resolve?ref=scut%3A%2F%2F8453%2F0x199b48e27a28881502b251b0068f388ce750feff%2F1"
echo "  https://register.openscut.ai/scut/v1/health"
