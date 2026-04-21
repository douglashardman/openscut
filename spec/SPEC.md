# SCUT Protocol Specification

**Subspace Communications Utility Transfer**

Version 0.1.0 (Draft) · April 20, 2026

---

## 0. About This Document

SCUT is an open protocol for encrypted agent-to-agent messaging. It is designed for AI agents that hold on-chain cryptographic identities and need to communicate with each other privately, reliably, and without depending on a central service.

This document specifies Phase 1 through Phase 6 of the protocol. Phases 1-3 comprise the v1 implementation (hackathon scope, ships by April 26, 2026). Phases 4-6 are v2, stubbed in this spec so v1 does not preclude future work.

The name is a deliberate homage to Dennis E. Taylor's Bobiverse series, in which SCUT stands for Subspace Communications Utility Transfer. The analogy is apt: SCUT moves encrypted payloads between distributed intelligences using a relay mesh. Bill invented it. Garfield helped perfect it. This specification is maintained in that spirit.

---

## 1. Design Goals

1. **End-to-end encrypted.** Only sender and recipient can read the payload. Relays see envelope metadata but cannot decrypt contents.
2. **Identity-rooted.** Every agent has an on-chain cryptographic identity (ERC-8004 on Base L2 for v1). Sender identity is verifiable. No spoofing.
3. **Decentralized.** No central authority. No single point of failure. Any party can run a relay.
4. **Store-and-forward.** Sender and recipient do not need to be online simultaneously. Relays hold encrypted payloads until delivery.
5. **MX-style discovery.** Recipients publish a prioritized list of preferred relays in their identity document. Senders resolve and route accordingly. Analogous to DNS MX records for email.
6. **Permissionless.** Anyone can run a relay. Anyone can run a resolver. Anyone can deploy an agent that speaks SCUT.
7. **Simple to implement.** The v1 protocol is small enough to implement in a weekend. Reference implementation in Node/TypeScript.
8. **Hardenable.** v1 has known gotchas (no forward secrecy, relay-visible metadata). v2 stubs are reserved in the spec so the protocol can be hardened without breaking v1 clients.

### Non-goals (v1)

- Group messaging. SCUT v1 is strictly 1:1.
- Attachments. v1 is text-only.
- Metadata privacy. Relays see who is talking to whom.
- Forward secrecy. Long-term key compromise exposes past messages.
- Real-time delivery guarantees. SCUT is store-and-forward, not a live protocol.

---

## 2. Architecture Overview

### 2.1 The MX Analogy

SCUT is structurally identical to email in most respects. The mapping:

| Email | SCUT |
|-------|------|
| Domain name | ERC-8004 agent ID |
| DNS / MX records | On-chain identity document + metadata URI |
| MX priority | Relay priority field |
| SMTP server | SCUT relay |
| Recipient's mail client | Recipient agent |
| DANE / DNSSEC public keys | X25519 encryption key in identity document |
| SMTP envelope | SCUT envelope |
| Message body | Encrypted payload |

The implication: SCUT is "email for AI agents." Everything that works for email (federation, priority fallback, permissionless participation, reputation systems) can work for SCUT. Everything that is hard for email (spam, metadata privacy, delivery reliability) is also hard for SCUT, but the cryptographic identity layer gives us cleaner tools to address these problems over time.

### 2.2 Components

**Agent.** An AI process with an on-chain ERC-8004 identity. Holds Ed25519 signing key and X25519 encryption key. Can send and receive SCUT messages.

**Identity document.** JSON blob published at a metadata URI referenced by the agent's ERC-8004 token. Contains the agent's public keys, preferred relay list, and protocol capabilities.

**Relay.** A service that accepts encrypted envelopes from senders, stores them, and serves them to recipients on request. Cannot decrypt payloads. Stateful with bounded storage.

**Resolver.** A service that reads on-chain identity documents and serves them to clients over HTTP with caching. Stateless relative to the chain.

**Client library.** Code that agents import to send and receive SCUT messages. Handles envelope construction, encryption, relay selection, delivery, and pickup.

**CLI.** `scut` command-line tool for humans and scripts to send/receive messages and manage agent identity.

**Admin portal.** Web application where agent owners sign in with their wallet, view their identity document, and edit their relay preferences.

### 2.3 Message Flow

Alice's agent sends a message to Bob's agent:

1. **Resolve.** Alice's client queries a resolver for Bob's identity document. Resolver returns cached or freshly-fetched copy.
2. **Select.** Alice's client reads Bob's relay list, selects the highest-priority relay.
3. **Encrypt.** Alice's client encrypts the message body using Bob's X25519 public key. Signs the envelope with Alice's Ed25519 private key.
4. **Push.** Alice's client opens an HTTPS connection to Bob's chosen relay, pushes the envelope. Relay verifies the sender signature and accepts.
5. **Store.** Relay stores the encrypted blob keyed by recipient ID and envelope nonce. Sets TTL (default 7 days).
6. **Notify (optional).** Relay may push a lightweight notification to Bob's agent if a webhook is configured. Otherwise, Bob's agent polls.
7. **Pickup.** Bob's agent polls the relay, authenticates with a signed request, receives any envelopes addressed to it.
8. **Decrypt.** Bob's client decrypts the payload using his X25519 private key. Verifies Alice's signature against her on-chain-registered public key.
9. **Ack.** Bob's client sends a delivery acknowledgment to the relay. Relay drops the stored blob.
10. **Expire (if no ack).** If TTL expires without acknowledgment, relay drops the blob and may return a bounce to the sender.

If step 4 fails (relay unreachable, relay rejects), Alice's client tries the next relay in Bob's priority list. If all relays fail, the send fails and Alice's agent is notified.

---

## 3. Phase Breakdown

The protocol is specified in six phases. Phases 1-3 ship as v1 (hackathon scope). Phases 4-6 are v2, reserved in the envelope format and extension points so they can be added without breaking v1 clients.

### Phase 1 (v1): Core Protocol

- Envelope format and wire protocol
- X25519 + Ed25519 key registration in identity documents
- Direct push from sender to recipient's relay
- Store-and-forward with 7-day TTL
- At-least-once delivery, recipient dedupes on nonce
- Signed sender identity, recipient verifies
- 64KB max encrypted payload, text-only

### Phase 2 (v1): Discovery and Infrastructure

- Metadata URI extension to ERC-8004 (JSON schema)
- Prioritized relay list in identity document
- HTTP resolver service with TTL cache
- Relay daemon reference implementation
- CLI for send, receive, identity management
- Client library (`@openscut/core`)

### Phase 3 (v1): Operator Tooling

- Admin portal (wallet-gated web app)
- View identity document
- Edit relay list (add, remove, reorder)
- Sign and submit metadata URI update
- Deploy reference relay to DigitalOcean one-click

### Phase 4 (v2): Security Hardening

- Forward secrecy via Double Ratchet or equivalent
- Key rotation with in-flight message handling
- Sender-side outbound relay (SMTP-style)
- Reputation signals and blocklists at the relay layer

### Phase 5 (v2): Privacy Hardening

- Onion routing across multiple relays
- Encrypted recipient addressing (hide recipient from relay)
- Mixnet-style batching to defeat traffic analysis
- Anonymous sender mode

### Phase 6 (v2): Richer Functionality

- Group messaging (1:N and N:N)
- Attachment support via content-addressed storage
- Read receipts and typing indicators
- Cross-chain identity resolution (beyond Base L2)
- Relay-to-relay gossip for redundancy

The envelope format defined in Phase 1 reserves fields for all v2 features. v1 clients set these fields to null or empty. v2 clients populate them and negotiate capabilities via the `protocol_version` field.

---

## 4. Identity Document (Phase 2)

An agent's ERC-8004 token references a metadata URI. The URI returns a JSON document conforming to the following schema.

### 4.1 Schema

```json
{
  "protocol_version": 1,
  "agent_id": "0x...",
  "keys": {
    "signing": {
      "algorithm": "ed25519",
      "public_key": "base64..."
    },
    "encryption": {
      "algorithm": "x25519",
      "public_key": "base64..."
    }
  },
  "relays": [
    {
      "host": "relay.openscut.ai",
      "priority": 10,
      "protocols": ["scut/1"]
    },
    {
      "host": "scut.example.com",
      "priority": 20,
      "protocols": ["scut/1"]
    }
  ],
  "capabilities": ["scut/1"],
  "updated_at": "2026-04-20T14:00:00Z",
  "v2_reserved": {
    "ratchet_supported": false,
    "onion_supported": false,
    "group_supported": false
  }
}
```

### 4.2 Field definitions

- **protocol_version** (integer, required): Identity document schema version. v1 is `1`.
- **agent_id** (string, required): The agent's ERC-8004 token identifier.
- **keys.signing** (object, required): Ed25519 public key for signature verification.
- **keys.encryption** (object, required): X25519 public key for payload encryption.
- **relays** (array, required, min 1): Preferred relays in priority order. Lower priority numbers are preferred.
- **relays[].host** (string, required): Relay hostname. Assumed HTTPS on port 443 unless the host specifies otherwise.
- **relays[].priority** (integer, required): MX-style priority. Sender tries lower numbers first.
- **relays[].protocols** (array, required): Protocol versions the relay claims to support.
- **capabilities** (array, required): Protocol versions this agent supports.
- **updated_at** (ISO 8601 string, required): Last modification timestamp.
- **v2_reserved** (object, optional): Capability flags for v2 features. All false in v1.

### 4.3 Updates

Updating the identity document requires signing a new JSON blob, uploading it to the metadata URI host (IPFS, Arweave, or HTTP), and submitting an on-chain transaction that updates the ERC-8004 token's metadata URI pointer. The admin portal handles this flow end-to-end.

### 4.4 Metadata URI hosting

The document may be hosted on:

- **IPFS** (recommended): content-addressed, tamper-evident, pinnable
- **Arweave**: permanent storage, slightly more expensive
- **HTTP/HTTPS**: simplest, requires trust in the host

The URI scheme in the ERC-8004 token determines the fetch mechanism. v1 resolver supports `ipfs://` and `https://` schemes.

---

## 5. Envelope Format (Phase 1)

The SCUT envelope is the wire format for messages. It is a JSON object with a well-defined schema. Future versions may adopt a binary format, but v1 uses JSON for debuggability.

### 5.1 Schema

```json
{
  "protocol_version": 1,
  "envelope_id": "base64-nonce-32-bytes",
  "from": "0xAlice...",
  "to": "0xBob...",
  "sent_at": "2026-04-20T14:01:00Z",
  "ttl_seconds": 604800,
  "ciphertext": "base64...",
  "ephemeral_pubkey": "base64...",
  "signature": "base64...",
  "v2_reserved": {
    "ratchet_state": null,
    "relay_path": null,
    "recipient_hint": null,
    "attachments": [],
    "recipient_set": null
  }
}
```

### 5.2 Field definitions

- **protocol_version** (integer): Always `1` in v1.
- **envelope_id** (base64 string, 32 bytes): Randomly generated per-envelope nonce. Used for deduplication at the recipient.
- **from** (string): Sender's ERC-8004 agent ID.
- **to** (string): Recipient's ERC-8004 agent ID.
- **sent_at** (ISO 8601 string): Sender-declared send time. Not trusted for ordering.
- **ttl_seconds** (integer): Requested time-to-live. Relays may enforce their own maximum.
- **ciphertext** (base64 string): Encrypted payload. Encryption uses X25519-ECDH → HKDF → XChaCha20-Poly1305 (see §5.3).
- **ephemeral_pubkey** (base64 string): Sender's ephemeral X25519 public key for this envelope.
- **signature** (base64 string): Ed25519 signature over the canonical serialization of the envelope excluding the signature field itself.
- **v2_reserved** (object): Fields reserved for v2 features. All null/empty in v1.

### 5.3 Encryption scheme

v1 uses a standard ECIES-style construction:

1. Sender generates an ephemeral X25519 keypair.
2. Sender computes shared secret via X25519 ECDH between the ephemeral private key and the recipient's registered X25519 public key.
3. HKDF-SHA256 derives a symmetric key from the shared secret, using `envelope_id` as the HKDF salt and `"scut/v1/msg"` as the info string.
4. Plaintext is encrypted with XChaCha20-Poly1305, using the envelope_id (truncated to 24 bytes) as the nonce.
5. Ciphertext includes the Poly1305 authentication tag.

On receive:

1. Recipient computes the same shared secret using their X25519 private key and the sender's `ephemeral_pubkey`.
2. HKDF derivation produces the same symmetric key.
3. XChaCha20-Poly1305 decrypts. If authentication fails, the envelope is discarded.

### 5.4 Signature scheme

The sender signs the envelope using their registered Ed25519 signing key. The signature covers the canonical JSON serialization of the envelope with the `signature` field removed. Canonical serialization rules:

- Fields sorted alphabetically by key at every level
- No insignificant whitespace
- UTF-8 encoding
- ISO 8601 timestamps with `Z` suffix for UTC

This ensures any verifier can independently reconstruct the signed bytes.

### 5.5 Size limits

- Maximum envelope size: 100KB
- Maximum ciphertext size: 64KB (leaves headroom for metadata and envelope overhead)
- Maximum plaintext size: ~64KB minus Poly1305 tag (16 bytes) and any internal framing

Relays MAY reject envelopes exceeding these limits.

---

## 6. Wire Protocol (Phase 1)

SCUT uses HTTPS for all transport. No custom TCP protocol. No WebSocket in v1.

### 6.1 Sender pushes to relay

```
POST https://<relay-host>/scut/v1/push
Content-Type: application/json

<envelope JSON>
```

**Relay response:**
- `202 Accepted` with `{"stored_at": "<ISO 8601>", "envelope_id": "..."}` if accepted
- `400 Bad Request` if envelope is malformed
- `401 Unauthorized` if sender signature is invalid
- `413 Payload Too Large` if envelope exceeds relay limits
- `429 Too Many Requests` if sender is rate-limited
- `503 Service Unavailable` if relay is over capacity

The relay MUST verify the Ed25519 signature before accepting. Relays that do not verify are out of spec.

### 6.2 Recipient polls relay

```
GET https://<relay-host>/scut/v1/pickup?for=<agent_id>&since=<ISO 8601>
Authorization: SCUT-Signature <base64 signed challenge>
```

The `Authorization` header contains a signed pickup request: the recipient signs a canonical string `pickup:<agent_id>:<ISO 8601 now>:<nonce>` with their Ed25519 private key. Relay verifies before returning any envelopes.

**Relay response:**
- `200 OK` with `{"envelopes": [<envelope>, ...]}` on success (may be empty)
- `401 Unauthorized` if pickup request signature is invalid
- `429 Too Many Requests` if recipient is polling too frequently

Clock skew tolerance: relays MUST accept pickup requests with timestamps within ±5 minutes of relay time. Rejects outside that window to prevent replay.

### 6.3 Recipient acknowledges delivery

```
POST https://<relay-host>/scut/v1/ack
Content-Type: application/json
Authorization: SCUT-Signature <base64 signed challenge>

{
  "envelope_ids": ["...", "..."]
}
```

**Relay response:**
- `200 OK` with `{"dropped": [...]}` listing envelope IDs successfully dropped
- `401 Unauthorized` if signature is invalid
- `404 Not Found` if no matching envelopes exist (idempotent, not an error)

On ack, the relay drops the encrypted blob. If a recipient does not ack, the relay retains the blob until TTL expires.

### 6.4 Relay capability query

```
GET https://<relay-host>/scut/v1/capabilities
```

**Response:**

```json
{
  "protocols": ["scut/1"],
  "max_envelope_bytes": 102400,
  "max_ttl_seconds": 604800,
  "rate_limit_per_sender_per_minute": 60
}
```

Clients should query this at least once per relay to understand limits.

### 6.5 Resolver API

```
GET https://<resolver-host>/scut/v1/resolve?agent_id=<id>
```

**Response:**

```json
{
  "agent_id": "0x...",
  "document": { ... },
  "fetched_at": "2026-04-20T14:00:00Z",
  "source": "ipfs://<hash>",
  "cache_ttl_seconds": 300
}
```

Resolvers MAY return cached documents up to the declared TTL. Clients SHOULD respect the TTL but MAY force a fresh fetch by adding `?fresh=1`.

---

## 7. Relay Behavior (Phase 2)

A conforming relay MUST:

1. Verify sender Ed25519 signatures on all inbound envelopes.
2. Store envelopes keyed by recipient agent ID.
3. Serve stored envelopes to authenticated recipients only.
4. Drop envelopes on acknowledgment or TTL expiry.
5. Reject malformed, oversized, or duplicate envelopes.
6. Enforce per-sender rate limits.
7. Expose a capabilities endpoint.

A conforming relay MUST NOT:

1. Attempt to decrypt payloads.
2. Serve envelopes to any party other than the recipient or the sender (for bounce purposes).
3. Retain envelopes past the TTL.
4. Accept envelopes with invalid signatures.
5. Share envelope contents with third parties.

### 7.1 Storage sizing

A reference relay running on a small VPS should be able to handle:

- 10,000 active recipient agents
- 1,000,000 envelopes/day throughput
- 10GB steady-state storage at 7-day TTL

Configurable limits for operators who need more or less.

### 7.2 Rate limiting

Default limits:

- Per sender: 60 envelopes/minute, 10,000/day
- Per recipient polling: 1 request/second
- Per IP: 1,000 envelopes/minute across all senders

Operators may adjust. Aggressive limits break legitimate use; lax limits invite abuse.

### 7.3 TTL policy

- Minimum TTL: 1 hour
- Maximum TTL: 7 days
- Default TTL if not specified: 7 days
- Relays MAY reduce the requested TTL to their maximum but MUST NOT silently extend it.

### 7.4 Bounce handling (v1 basic, v2 rich)

v1: If an envelope expires without delivery, the relay MAY send a bounce envelope to the sender. Bounce is a simple notification, not a structured format yet. Sender support for bounces is optional in v1.

v2 stub: Structured bounce format with reason codes, retry policy hints, and chained history.

---

## 8. Admin Portal (Phase 3)

The admin portal is a single-page web application deployed at `app.openscut.ai`. It connects to the user's Web3 wallet and provides a GUI for managing an agent's identity document.

### 8.1 User flow

1. User visits the portal, connects wallet (MetaMask, Coinbase Wallet, WalletConnect).
2. Portal detects agents owned by the connected address by querying the ERC-8004 contract.
3. User selects an agent to manage.
4. Portal fetches the current identity document via the resolver.
5. Portal displays:
   - Agent ID, current signing key, current encryption key
   - Current relay list with priorities
   - Last updated timestamp
6. User edits the relay list:
   - Add a relay (host, priority)
   - Remove a relay
   - Reorder priorities via drag and drop
7. User clicks "Save." Portal:
   - Constructs the updated JSON document
   - Uploads to IPFS (or configured metadata host)
   - Prompts wallet to sign the ERC-8004 metadata URI update transaction
   - Waits for confirmation
   - Refreshes the view

### 8.2 Wallet scope

The portal never asks for or handles private keys. All signing happens in the wallet. The portal only constructs the transaction payload and requests the signature.

### 8.3 What is NOT in v1 portal

- Key rotation (use CLI for v1; portal support in Phase 4)
- Delivery analytics (no relay telemetry in v1; Phase 4+)
- Multi-agent management in one view (v1 manages one agent at a time)
- Relay operator dashboard (separate tool, Phase 4+)

---

## 9. Client Library (Phase 2)

The reference client library is `@openscut/core`, published on npm.

### 9.1 Minimal API

```typescript
import { ScutClient } from '@openscut/core'

const client = new ScutClient({
  agentId: '0xAlice...',
  signingPrivateKey: '...',    // Ed25519
  encryptionPrivateKey: '...', // X25519
  resolver: 'https://resolver.openscut.ai'
})

// Send
await client.send({
  to: '0xBob...',
  body: 'Hello, Bob.'
})

// Poll and decrypt incoming
const messages = await client.receive()
for (const msg of messages) {
  console.log(`From ${msg.from}: ${msg.body}`)
}

// Acknowledge
await client.ack(messages.map(m => m.envelopeId))
```

### 9.2 Sending

On `send()`:
1. Resolve recipient's identity document.
2. Select highest-priority relay.
3. Generate ephemeral X25519 keypair.
4. Encrypt payload.
5. Sign envelope.
6. POST to relay.
7. On non-2xx response, try next relay.
8. On all relays failed, throw.

### 9.3 Receiving

On `receive()`:
1. Iterate the agent's own configured relays.
2. GET pickup from each.
3. Deduplicate by envelope_id.
4. Verify each envelope's signature against sender's on-chain public key (resolved via resolver).
5. Decrypt each payload.
6. Return array of decrypted messages.

Recipient is responsible for deduping across polls, because at-least-once delivery may produce the same envelope twice.

### 9.4 Key management

v1 library accepts keys via constructor. Key storage is the application's responsibility. Reference CLI stores keys in `~/.scut/keys.json` with 0600 permissions.

v2 stub: Hardware wallet integration, OS keychain, KMS backend.

---

## 10. CLI (Phase 2)

The `scut` CLI provides a Unix-friendly interface.

### 10.1 Commands

```
scut init                              # Generate keys, create config
scut identity show                     # Display current identity document
scut identity publish                  # Sign and publish identity updates
scut send <agent_id> "<message>"       # Send a message
scut send <agent_id> --file msg.txt    # Send from file (still text, just convenience)
scut recv                              # Poll all configured relays
scut recv --watch                      # Long-poll loop
scut ack <envelope_id>                 # Ack a specific envelope
scut relay add <host> --priority <n>   # Add a relay
scut relay list                        # Show current relay list
scut relay remove <host>               # Remove a relay
scut resolve <agent_id>                # Show another agent's identity doc
scut ping <agent_id>                   # Send a test message, time round-trip
```

### 10.2 Config

`~/.scut/config.json`:

```json
{
  "agent_id": "0x...",
  "resolver": "https://resolver.openscut.ai",
  "keys_path": "~/.scut/keys.json"
}
```

### 10.3 Exit codes

- 0: Success
- 1: Generic error
- 2: Configuration error
- 3: Network error (all relays unreachable)
- 4: Cryptographic error (signature or decryption failure)
- 5: Recipient unknown or identity document unresolvable

---

## 11. Relay Daemon (Phase 2)

The reference relay is `scut-relay`, a Node/Fastify daemon.

### 11.1 Deployment

```
npm install -g @openscut/relay
scut-relay --config /etc/scut-relay.yaml
```

Or Docker:

```
docker run -p 443:443 -v /srv/scut:/data openscut/relay:latest
```

### 11.2 Storage backend

v1 uses SQLite for the envelope store. Sufficient for small-to-medium relays. PostgreSQL backend stubbed for v2.

Schema:

```sql
CREATE TABLE envelopes (
  envelope_id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  received_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  payload BLOB NOT NULL
);

CREATE INDEX idx_recipient ON envelopes(recipient_id, received_at);
CREATE INDEX idx_expiry ON envelopes(expires_at);
```

A background job evicts expired rows every minute.

### 11.3 Operator config

```yaml
listen: "0.0.0.0:443"
tls:
  cert: /etc/letsencrypt/live/relay.example.com/fullchain.pem
  key: /etc/letsencrypt/live/relay.example.com/privkey.pem
storage:
  backend: sqlite
  path: /var/lib/scut/envelopes.db
limits:
  max_envelope_bytes: 102400
  max_ttl_seconds: 604800
  rate_limit_per_sender_per_minute: 60
```

---

## 12. Resolver Service (Phase 2)

The reference resolver is `scut-resolver`, a stateless HTTP service.

### 12.1 Deployment

Same patterns as the relay. Deployable to a single small VPS, Cloudflare Workers, or any Node host.

### 12.2 Behavior

1. On `GET /scut/v1/resolve?agent_id=<id>`, check cache.
2. On cache miss or expiry, query the Base L2 RPC for the ERC-8004 metadata URI.
3. Fetch the document from the URI (IPFS gateway or HTTPS).
4. Validate the JSON against the schema.
5. Cache with configured TTL (default 300 seconds).
6. Return.

### 12.3 Security

Resolvers do not hold any private keys. Resolvers do not modify documents. A malicious resolver can return stale or incorrect documents; clients should verify critical claims (like sender public keys) against alternative resolvers or direct chain reads when security-critical.

### 12.4 Default resolver

`resolver.openscut.ai` is operated by the OpenPub project as a public good. Clients default to it but can configure any resolver.

---

## 13. Security Model

### 13.1 What SCUT v1 protects

- **Payload confidentiality.** Only the recipient can decrypt.
- **Sender authenticity.** Recipient verifies the sender's signature against the on-chain-registered key.
- **Integrity.** Poly1305 tag detects tampering.
- **Recipient authentication at pickup.** Relay verifies signed pickup requests.

### 13.2 What SCUT v1 does NOT protect

- **Metadata.** Relays see who is talking to whom, when, and how often.
- **Forward secrecy.** If a recipient's long-term X25519 key is compromised, all past and future messages are decryptable until the key is rotated.
- **Timing analysis.** A global adversary observing relay traffic can correlate send and receive patterns.
- **Availability under censorship.** A hostile relay can refuse to deliver. Sender does not know if the relay is malicious or just down.
- **Recipient anonymity to relay.** The recipient's agent ID is visible to the relay.

These are acknowledged v2 problems. The envelope format reserves fields (`relay_path`, `recipient_hint`, `ratchet_state`) that v2 implementations will populate.

### 13.3 Known gotchas (read before production use)

1. **Long-term key compromise is catastrophic in v1.** No ratcheting. Rotate keys immediately if compromise is suspected. Rotation requires a new identity document publication.
2. **Relay operator can drop or delay messages.** Use multiple relays with priority fallback. Monitor for delivery failures.
3. **Replay attacks.** Envelope nonce prevents replay at the recipient, but a malicious relay can replay to other recipients. This is detected by signature verification if the envelope is addressed differently.
4. **Clock skew.** Pickup authorization uses timestamps. Clients and relays must keep accurate time.
5. **Resolver trust.** A malicious resolver can return a doctored identity document with the attacker's keys. For high-value messages, clients should verify via multiple resolvers or direct chain reads.

### 13.4 Threat model summary

v1 is appropriate for:

- Operational communication between agents owned by mutually trusting parties
- Coordination messaging where metadata leakage is acceptable
- Research and development of agent-to-agent communication patterns

v1 is NOT appropriate for:

- Anonymous communication
- Communication that must survive targeted surveillance
- Long-term sensitive correspondence without key rotation discipline
- Adversarial environments where the recipient's identity must be hidden

v2 phases 5 and 6 address these limitations.

---

## 14. v2 Reserved Fields (Detail)

Every v1 structure has reserved fields for v2. The rules:

1. v1 implementations MUST preserve reserved fields they do not understand when forwarding or storing.
2. v1 implementations MUST NOT populate reserved fields.
3. v2 implementations MUST be backward compatible with v1 envelopes.
4. v2 implementations negotiate capabilities via `protocol_version` and `capabilities`.

### 14.1 Envelope `v2_reserved`

| Field | Phase | Purpose |
|-------|-------|---------|
| `ratchet_state` | 4 | Double Ratchet state for forward secrecy |
| `relay_path` | 5 | Onion routing layers |
| `recipient_hint` | 5 | Encrypted recipient address to hide recipient from relay |
| `attachments` | 6 | Content-addressed blob references |
| `recipient_set` | 6 | Group messaging recipient list |

### 14.2 Identity document `v2_reserved`

| Field | Phase | Purpose |
|-------|-------|---------|
| `ratchet_supported` | 4 | Signals agent supports Double Ratchet |
| `onion_supported` | 5 | Signals agent accepts onion-routed messages |
| `group_supported` | 6 | Signals agent supports group messaging |

### 14.3 Relay capabilities `v2_reserved`

Relay capability endpoint returns additional fields in v2:

| Field | Phase | Purpose |
|-------|-------|---------|
| `gossip_peers` | 6 | Peer relay list for gossip redundancy |
| `mix_batching_enabled` | 5 | Signals relay performs mixnet-style batching |
| `reputation_endpoint` | 4 | URL for reputation queries |

---

## 15. Implementation Roadmap (Hackathon Timeline)

Target: functional v1 by Sunday, April 26, 2026, 8:00 PM EDT.

### Day 1 (Tue April 21): Foundation
- Repo scaffold: `@openscut/core`, `scut`, `scut-relay`, `scut-resolver`
- Envelope format, encryption, signing implemented in core library
- Unit tests for crypto
- Identity document schema defined, JSON schema validator written

### Day 2 (Wed April 22): Wire Protocol
- Relay daemon accepts push, serves pickup, handles ack
- SQLite storage backend
- Signature verification end-to-end
- Rate limiting scaffolded
- Resolver service fetches ERC-8004 metadata, caches, serves

### Day 3 (Thu April 23): CLI and Integration
- `scut` CLI with all commands from §10.1
- `scut init` generates keys and config
- End-to-end test: Alice → relay → Bob on same machine
- End-to-end test: Alice → relay → Bob across two machines
- OpenPub integration: documented as optional. Pub operators may run `scut-relay` alongside their pub, but SCUT does not depend on OpenPub.

### Day 4 (Fri April 24): Admin Portal
- React + Vite + wagmi/viem for wallet connect
- Fetch and display identity document
- Edit relay list (add, remove, reorder)
- IPFS upload via web3.storage or similar
- Sign ERC-8004 metadata URI update transaction
- Deploy to `app.openscut.ai`

### Day 5 (Sat April 25): Polish and Pull-Ahead
- Documentation: README, SPEC.md, getting-started guide
- openscut.ai landing page
- DigitalOcean one-click deploy for `scut-relay`
- Demo video script
- **Decision point:** if ahead of schedule, pull one or two Phase 4 items forward:
  - Forward secrecy via Double Ratchet (highest value, non-trivial)
  - Structured bounce handling
  - Sender-side outbound relay

### Day 6 (Sun April 26): Demo
- 90-second demo video recorded on Sony ZV-E10
  - Two terminals, two agents
  - Alice sends to Bob through relay
  - Bob reads, acks
  - Relay shows envelope stored, then dropped
  - Identity document edit in portal
  - New relay takes priority, message reroutes
- Hackathon submission by 8:00 PM EDT
- Dennis E. Taylor acknowledgment in README and landing page

---

## 16. Naming and Attribution

- **SCUT:** Subspace Communications Utility Transfer. Named in homage to Dennis E. Taylor's Bobiverse series, where SCUT is an interstellar communication protocol.
- **Reference implementation:** `openscut`, maintained at github.com/douglashardman/openscut, licensed MIT.
- **OpenPub:** OpenPub is a separate project by the same maintainer. Pubs MAY opt-in to run a SCUT relay. SCUT does not depend on OpenPub.
- **Bill and Garfield:** The builder agent working on this protocol is named Garfield, after Bill's clone in the Bobiverse who specializes in polymers and mathematics. Bill invented SCUT in the novels; Garfield perfected it. This project follows the same pattern.

---

## 17. Open Questions (for v2 and beyond)

- Multi-chain identity: how to handle agents whose ERC-8004 is on Base but messaging peers whose identity is on Optimism or Solana equivalents?
- Relay incentives: should there be a payment layer for relay operators, and if so, tokenized or fiat?
- Directory and reputation: who maintains a list of well-behaved relays, and how is reputation computed without centralization?
- Deletion: "right to forget" is at odds with cryptographic message persistence on recipient devices. What's the social contract?
- Quantum resistance: Ed25519 and X25519 are not post-quantum. When does SCUT adopt a post-quantum suite?

None of these block v1. All of them are fair game for v2.

---

## 18. License

This specification is published under Creative Commons CC-BY-4.0.

Reference implementations are published under the MIT License.

---

*Document maintained at openscut.ai. Contributions welcome via github.com/douglashardman/openscut.*

*Version 0.1.0, April 20, 2026.*
