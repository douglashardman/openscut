# OpenSCUT Operations

Deployment configuration for `scut-relay` and `scut-resolver`. Everything here is installed onto the droplet that hosts `relay.openscut.ai` and `resolver.openscut.ai`; nothing here is typed onto the server by hand.

## Layout

```
ops/
├── caddy/
│   └── Caddyfile                       # two vhosts, auto-TLS via Let's Encrypt
├── systemd/
│   ├── scut-resolver.service           # unit — stateless, no write paths
│   └── scut-relay.service               # unit — writes to /var/lib/scut
├── env/
│   ├── resolver.env.example            # template for /etc/scut/resolver.env
│   └── relay.env.example               # template for /etc/scut/relay.env
└── scripts/
    ├── install.sh                      # initial deployment (runs once)
    └── update.sh                       # pull + rebuild + restart (runs per release)
```

## Boundaries

SCUT owns: application services, reverse proxy config, service users, env files, systemd units.

SCUT does **not** own: the droplet, DNS records, UFW rules, backup configuration. Those live with the infra operator (Simon).

## Initial install

On the droplet:

```bash
sudo mkdir -p /opt/openscut
sudo chown "$(whoami):$(whoami)" /opt/openscut
git clone https://github.com/douglashardman/openscut.git /opt/openscut
cd /opt/openscut
ops/scripts/install.sh
```

The script is idempotent: rerunning it won't regenerate the events token, overwrite existing env files, or clobber the SQLite DB. It will update systemd units, the Caddyfile, and the package builds to match the checked-out commit.

## Applying a new release

```bash
cd /opt/openscut
ops/scripts/update.sh
```

This pulls `origin/main`, rebuilds the three relevant packages (core → resolver → relay), and restarts the services in dependency order.

## What's where on the droplet

| Path | Purpose |
|---|---|
| `/opt/openscut/` | Repo checkout. Updated via `update.sh`. |
| `/etc/scut/relay.env` | Relay env, root:scut, 0640. Contains the events token. |
| `/etc/scut/resolver.env` | Resolver env, root:scut, 0640. |
| `/var/lib/scut/relay.db` | Relay SQLite store. Backed up nightly by Simon to Cloudflare R2. |
| `/etc/systemd/system/scut-relay.service` | Systemd unit. Symlinked from `ops/systemd/`. |
| `/etc/systemd/system/scut-resolver.service` | Systemd unit. |
| `/etc/caddy/Caddyfile` | Caddy reverse proxy config. |
| `/var/log/caddy/` | Caddy access logs, rolled at 100MB, last 10 kept. |

## What's running

```
scut-resolver.service   listens on 127.0.0.1:8444
scut-relay.service      listens on 127.0.0.1:8443, depends on resolver
caddy.service           terminates TLS on 443, proxies both
```

No service is reachable directly from the public internet — Caddy is the only process on 80/443.

## Operational recipes

```bash
# get the events token (for scut-monitor)
sudo cat /etc/scut/relay.env | grep SCUT_RELAY_EVENTS_TOKEN

# tail logs
journalctl -u scut-relay -f
journalctl -u scut-resolver -f
journalctl -u caddy -f

# status of all three
sudo systemctl status scut-relay.service scut-resolver.service caddy.service

# restart just the relay (safe; connections drop, reconnect)
sudo systemctl restart scut-relay.service

# local health checks
curl http://127.0.0.1:8444/health
curl http://127.0.0.1:8443/health

# public endpoint smoke test
curl https://resolver.openscut.ai/scut/v1/resolve?ref=scut%3A%2F%2F8453%2F0x199b48e27a28881502b251b0068f388ce750feff%2F1

# verify TLS certs (issued by Let's Encrypt)
curl -sSf -I https://relay.openscut.ai/health
curl -sSf -I https://resolver.openscut.ai/scut/v1/capabilities
```

## Upgrading Node or pnpm

Node and pnpm versions are pinned in `install.sh`. To bump:

1. Edit `NODE_MAJOR` or `PNPM_VERSION` at the top of `ops/scripts/install.sh`.
2. Commit to `main`.
3. Re-run `install.sh` on the droplet (it detects the mismatch and upgrades).
4. Re-run `update.sh` to rebuild against the new runtime.

## Rollback

If an update breaks production:

```bash
cd /opt/openscut
git log --oneline -10                 # find the previous good commit
git reset --hard <commit>
pnpm install --frozen-lockfile
pnpm --filter @openscut/core run build
pnpm --filter scut-resolver run build
pnpm --filter scut-relay run build
sudo chown -R scut:scut packages/relay/dist packages/resolver/dist
sudo systemctl restart scut-resolver.service
sleep 2
sudo systemctl restart scut-relay.service
```

The relay's SQLite schema is append-only and v1-frozen; downgrading the binary against a newer DB is safe.

## Emergency stop

```bash
sudo systemctl stop scut-relay.service scut-resolver.service
# or full stack:
sudo systemctl stop scut-relay.service scut-resolver.service caddy.service
```
