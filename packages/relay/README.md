# `scut-relay`

> Relay daemon for the SCUT protocol. Signature-verified store-and-forward with an SSE event stream.

`scut-relay` accepts signed encrypted envelopes from senders, stores them keyed by recipient, serves them to authenticated recipients, and drops them on acknowledgment or TTL expiry. Relays see envelope metadata but cannot decrypt payloads.

## Install

As a global npm binary:

```
npm install -g scut-relay
scut-relay --config /etc/scut-relay.yaml
```

Or run via Docker (the recommended deployment for `relay.openscut.ai`):

```
docker run -p 443:443 \
  -v /srv/scut:/data \
  -e SCUT_RELAY_RESOLVER_URL=https://resolver.openscut.ai \
  -e SCUT_RELAY_EVENTS_TOKEN=<your-secret> \
  openscut/relay:latest
```

Node 22 or newer. SQLite (via [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3)) is the v1 storage backend; PostgreSQL is stubbed for v2.

## Endpoints

All per SPEC §6.

| Method + path | Purpose |
|---|---|
| `POST /scut/v1/push` | Sender pushes a signed, encrypted envelope. Relay verifies signature, checks idempotency, stores. 202 / 400 / 401 / 409 / 413 / 429 / 503. |
| `GET /scut/v1/pickup?for=<scut_uri>&since=<iso>` | Authenticated recipient polls for envelopes. `SCUT-Signature` header required. 200 / 400 / 401 / 429. |
| `POST /scut/v1/ack` | Authenticated recipient acknowledges receipt so the relay can drop the envelope(s). |
| `GET /scut/v1/capabilities` | Static config snapshot (protocols, limits). |
| `GET /scut/v1/events` | Server-Sent Events stream of `envelope_received` / `envelope_acked` / `envelope_expired`. Gated by a Bearer token set at boot. |
| `GET /health` | Liveness. |

### Idempotency and integrity

Push is idempotent on `envelope_id`:

- **New id** → store, emit event, respond `202 {idempotent: false}`.
- **Duplicate id + same signature** → do not re-store, respond `202 {idempotent: true}` with the original `stored_at`.
- **Duplicate id + different signature** → `409 Conflict`. The relay does not overwrite; this indicates a client bug or forgery attempt.

The `SCUT-Signature` header format (pickup / ack) is `agent_id=<scut_uri>,ts=<iso>,nonce=<b64>,sig=<b64>`. Nonces are tracked in a per-agent anti-replay cache covering at least the clock-skew window (±5 minutes in the reference implementation).

## Configuration

Environment variables take precedence; `--config path.yaml` merges a file for deployments.

| Variable | Default | Purpose |
|---|---|---|
| `SCUT_RELAY_HOST` | `0.0.0.0` | Listen host |
| `SCUT_RELAY_PORT` | `8443` | Listen port |
| `SCUT_RELAY_DB` | `:memory:` | SQLite path (use a persistent path in prod) |
| `SCUT_RELAY_RESOLVER_URL` | (required) | URL of a `scut-resolver` the relay uses to fetch sender signing keys |
| `SCUT_RELAY_EVENTS_TOKEN` | (required) | Bearer token required on `/scut/v1/events` |
| `SCUT_RELAY_MAX_ENVELOPE_BYTES` | `102400` | Reject pushes larger than this |
| `SCUT_RELAY_MAX_TTL_SECONDS` | `604800` | Cap requested TTL to this value |
| `SCUT_RELAY_RATE_PER_SENDER_PER_MINUTE` | `60` | Per-sender push rate limit |
| `SCUT_RELAY_RATE_GLOBAL_PER_MINUTE` | `60000` | Total push rate limit |
| `SCUT_RELAY_LOG` | (unset) | Set to `silent` for quiet logging (tests) |

## The `/scut/v1/events` SSE stream

Designed for observability tools like [`scut-monitor`](../monitor/README.md) and for operators inspecting live traffic. Events:

```
event: envelope_received
data: {"kind":"envelope_received","at":"...","envelope":{...},"received_at":"...","expires_at":"..."}

event: envelope_acked
data: {"kind":"envelope_acked","at":"...","envelope_ids":[...],"by":"<scut_uri>"}

event: envelope_expired
data: {"kind":"envelope_expired","at":"...","envelope_id":"...","recipient_id":"<scut_uri>"}
```

The `envelope` payload in `envelope_received` is the full envelope (ciphertext + signature). Decryption still requires the recipient's private key; the stream does not leak plaintext. However, it does expose the relay's traffic graph — **set a strong `SCUT_RELAY_EVENTS_TOKEN` and treat the stream as privileged observability data**.

v1 authenticates all subscribers with a single relay-wide token. v2 will add per-subscriber revocable tokens with agent-scoped filters.

## Storage and eviction

SQLite schema per SPEC §11.2:

```sql
CREATE TABLE envelopes (
  envelope_id   TEXT PRIMARY KEY,
  recipient_id  TEXT NOT NULL,
  sender_id     TEXT NOT NULL,
  signature     TEXT NOT NULL,
  received_at   INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL,
  payload       BLOB NOT NULL
);
```

A background job evicts expired rows every 60 seconds and emits `envelope_expired` events for the monitor. Recommended sizing on a small VPS: 10,000 active recipients, 1M envelopes/day, 10GB steady-state at 7-day TTL.

## Security model

- **The relay never sees plaintext.** Payloads are XChaCha20-Poly1305 ciphertexts encrypted to the recipient's long-term X25519 key; the relay has no material that can decrypt them.
- **The relay verifies every incoming signature** against the sender's on-chain-registered Ed25519 key, fetched via the configured resolver. A bad signature gets `401` without ever parsing the ciphertext.
- **Rate limiting** is per-sender and global (configurable). Per-IP is future work.
- **TLS termination** is operator-provided (Caddy, nginx, Cloudflare). `scut-relay` itself speaks plain HTTP on its listen port.

Threat model summary: a malicious relay can drop or delay messages and can observe the traffic graph, but cannot read payloads or forge sender identity. SPEC §13 is the full version.

## Related

- Spec: [`spec/SPEC.md`](../../spec/SPEC.md) §6, §7, §11
- `scut-resolver`: [../resolver/README.md](../resolver/README.md)
- `scut-monitor`: [../monitor/README.md](../monitor/README.md) (consumes the events stream)

## License

MIT.
