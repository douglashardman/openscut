# SCUT Protocol Specification

**Subspace Communications Utility Transfer**

Version 0.2.0 (Draft) · April 21, 2026

---

## 0. About This Document

SCUT is an open protocol for encrypted agent-to-agent messaging. It is designed for AI agents that hold on-chain cryptographic identities and need to communicate with each other privately, reliably, and without depending on a central service.

This document specifies Phase 1 through Phase 6 of the protocol. Phases 1-3 comprise the v1 implementation (hackathon scope, ships by April 26, 2026). Phases 4-6 are v2, stubbed in this spec so v1 does not preclude future work.

The name is a deliberate homage to Dennis E. Taylor's Bobiverse series, in which SCUT stands for Subspace Communications Utility Transfer. The analogy is apt: SCUT moves encrypted payloads between distributed intelligences using a relay mesh. Bill invented it. Garfield helped perfect it. This specification is maintained in that spirit.

### 0.1 Changelog

- **v0.2.0 (April 21, 2026)** — Introduced the SCUT Identity Interface (SII). Identity documents no longer require a specific contract; SCUT clients resolve identities from any SII-compliant contract via EIP-165 discovery. Added the `scut://<chainId>/<contract>/<tokenId>` URI scheme for cross-system addressing. Envelope `from` / `to` fields carry full `scut://` URIs. The `?agent_id=` resolver parameter became `?ref=`. v0.1 envelopes are not wire-compatible with v0.2; v0.1 had no deployed users.
- **v0.1.0 (April 20, 2026)** — Initial draft. Core crypto, envelope format, wire protocol, and phase roadmap.

---

## 1. Design Goals

1. **End-to-end encrypted.** Only sender and recipient can read the payload. Relays see envelope metadata but cannot decrypt contents.
2. **Identity-rooted.** Every agent has an on-chain cryptographic identity published through a contract that implements the SCUT Identity Interface (§4). Sender identity is verifiable. No spoofing.
3. **Decentralized.** No central authority. No single point of failure. Any party can run a relay.
4. **Store-and-forward.** Sender and recipient do not need to be online simultaneously. Relays hold encrypted payloads until delivery.
5. **MX-style discovery.** Recipients publish a prioritized list of preferred relays in their identity document. Senders resolve and route accordingly. Analogous to DNS MX records for email.
6. **Permissionless at every layer.** Anyone can run a relay. Anyone can run a resolver. Anyone can deploy a contract that implements the SCUT Identity Interface. Anyone can register as an agent on any SII-compliant contract.
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
| Domain name | SCUT URI (`scut://chainId/contract/tokenId`) |
| DNS / MX records | SII-compliant contract + metadata URI |
| MX priority | Relay priority field |
| SMTP server | SCUT relay |
| Recipient's mail client | Recipient agent |
| DANE / DNSSEC public keys | X25519 encryption key in SII document |
| SMTP envelope | SCUT envelope |
| Message body | Encrypted payload |

The implication: SCUT is "email for AI agents." Everything that works for email (federation, priority fallback, permissionless participation, reputation systems) can work for SCUT. Everything that is hard for email (spam, metadata privacy, delivery reliability) is also hard for SCUT, but the cryptographic identity layer gives us cleaner tools to address these problems over time.

### 2.2 Components

**Agent.** An AI process with an on-chain identity published through a contract that implements the SCUT Identity Interface (§4). Holds Ed25519 signing key and X25519 encryption key. Can send and receive SCUT messages. An agent is addressed as `scut://<chainId>/<contract>/<tokenId>` (§4.6).

**Identity document.** JSON blob conforming to the SII document schema (§4.3), published at a URI returned by the SII contract's `scutIdentityURI(tokenId)` function. Contains the agent's public keys, preferred relay list, and protocol capabilities.

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

- SCUT Identity Interface (SII) contract and document schema (§4)
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

## 4. SCUT Identity Interface (SII)

SCUT does not privilege any specific identity contract. Instead it defines a minimal on-chain interface — the SCUT Identity Interface, SII — that any contract can implement. A contract that implements SII is a valid SCUT identity registry. SCUT's resolver reads from any SII-compliant contract.

This section specifies SII v1: the contract interface, the document schema, the resolution flow, and the addressing scheme.

### 4.1 Design Principles

- **Implementation-agnostic.** SCUT privileges no specific contract.
- **Minimal.** Required fields only; optional fields are clearly marked.
- **Upgradable.** SII documents carry a version; resolvers negotiate on `siiVersion`.
- **Cheap to read.** The primary read path is a single `view` call on an ERC-721-style contract.
- **Cheap to implement.** A new SII-compliant contract should be deployable in under 100 lines of Solidity.

### 4.2 Contract-Level Interface

Any contract that serves as a SCUT identity registry MUST implement this interface:

```solidity
interface ISCUTIdentity {
    /// @notice Returns a URI pointing to a JSON document conforming to SII
    ///         schema v1 for the given token.
    /// @dev MUST revert if the tokenId does not exist.
    /// @dev MUST return the empty string if the tokenId exists but no SII
    ///      document is registered for it.
    function scutIdentityURI(uint256 tokenId) external view returns (string memory);

    /// @notice The major SII version this contract supports. v1 = 1.
    function scutVersion() external pure returns (uint8);

    /// @notice EIP-165-style flag: true if this contract implements SII v1.
    function supportsSCUTIdentity() external pure returns (bool);
}
```

Implementers SHOULD additionally implement EIP-165 (`supportsInterface(bytes4)`) and return `true` for the SII interface ID (§4.5) so off-chain clients can detect SII support without relying on a revert-on-unknown-selector fallback.

### 4.3 Document Schema

The URI returned by `scutIdentityURI` MUST resolve to a JSON document matching this schema:

```json
{
  "siiVersion": 1,
  "agentRef": {
    "contract": "0x...",
    "tokenId": "123",
    "chainId": 8453
  },
  "keys": {
    "signing":    { "algorithm": "ed25519", "publicKey": "base64..." },
    "encryption": { "algorithm": "x25519",  "publicKey": "base64..." }
  },
  "relays": [
    { "host": "relay.openscut.ai",  "priority": 10, "protocols": ["scut/1"] },
    { "host": "relay.example.com",  "priority": 20, "protocols": ["scut/1"] }
  ],
  "capabilities": ["scut/1"],
  "displayName": "Alice's assistant",
  "updatedAt": "2026-04-21T16:00:00Z",
  "issuer": { "name": "OpenSCUT Registry", "url": "https://openscut.ai" },
  "v2Reserved": {
    "ratchetSupported": false,
    "onionSupported": false,
    "groupSupported": false
  }
}
```

**Required fields:**

- **siiVersion** (integer): Document schema version. v1 is `1`.
- **agentRef** (object): Self-referential pointer back to the contract entry that published this document.
  - **contract** (string, `0x`-prefixed 40-char hex): Address of the SII contract holding this agent.
  - **tokenId** (string, decimal): Token id within the contract.
  - **chainId** (integer): EIP-155 chain id. Base mainnet = `8453`, Base Sepolia = `84532`.
- **keys.signing** (object): `{ algorithm: "ed25519", publicKey: <base64> }` — used by recipients to verify envelope signatures.
- **keys.encryption** (object): `{ algorithm: "x25519", publicKey: <base64> }` — used by senders to encrypt envelopes addressed to this agent.
- **relays** (array, min 1): Preferred relays in priority order.
- **relays[].host** (string): Relay hostname; HTTPS on port 443 unless the host carries an explicit port.
- **relays[].priority** (integer): MX-style priority. Senders try lower numbers first.
- **relays[].protocols** (array): Protocol versions the relay claims to support.
- **capabilities** (array): Protocol versions this agent supports (e.g. `["scut/1"]`).

**Optional fields:**

- **displayName** (string): Human-readable name. Advisory; not required to be unique.
- **updatedAt** (ISO 8601 UTC): Last-modified timestamp. Resolvers MAY use this for staleness detection.
- **issuer** (object): `{ name, url }` for the registering organization. Useful for reputation / trust signals.
- **v2Reserved** (object): Capability flags for Phase 4+ features. All `false` in v1.

### 4.4 Resolution Flow

To resolve an agent's identity document from a `scut://` URI or `agentRef`:

1. Parse the triple `{ contract, tokenId, chainId }`.
2. Call `scutIdentityURI(tokenId)` on `contract` via an RPC for `chainId`.
3. Parse the returned URI. Scheme determines fetch mechanism: `ipfs://` → IPFS gateway; `https://` → direct HTTPS fetch; `data:` → inline decode.
4. Parse the fetched body as JSON, validate against the SII document schema (§4.3).
5. Verify the document's `agentRef` matches the lookup triple. If not, reject — this prevents URI mix-ups where one contract's tokenId points at another's document.
6. Cache the document with the resolver's configured TTL (§7.5 default 300 s).

### 4.5 Interface ID (EIP-165)

The SII v1 interface id is the XOR of the first four bytes of `keccak256` of each function signature:

```
scutIdentityURI(uint256)   = 0x8394584d
scutVersion()              = 0x4bdb66cb
supportsSCUTIdentity()     = 0xa7aa2d5f

interface id               = 0x6fe513d9
```

SII contracts SHOULD return `true` from `supportsInterface(0x6fe513d9)`.

### 4.6 Addressing (`scut://` URIs)

SCUT messages address recipients by their full `agentRef`, not just a token id. The canonical wire form is the `scut://` URI:

```
scut://<chainId>/<contract>/<tokenId>
```

Example: `scut://8453/0x6d34D47c5F863131A8D052Ca4C51Cd6A0F62Fe17/2`

Rules:

- `chainId` is the decimal EIP-155 chain id.
- `contract` is the `0x`-prefixed 40-char hex contract address, case-insensitive on the wire but SHOULD be normalized to lowercase when used as a canonical identifier.
- `tokenId` is the decimal token id.
- There is no authority component beyond `chainId/contract/tokenId`. No port, no path, no query, no fragment in v1.

Clients MAY support shorter forms (bare token id when the contract and chain are implicit from context — e.g. a CLI that defaults to Base + the OpenSCUT registry), but the full `scut://` URI is always unambiguous and is what ships on the wire in envelope `from` / `to` fields.

### 4.7 Identity Document Hosting

Registrants choose where to host the document their SII URI points at. The contract does not care whether the URI is `ipfs://<cid>`, `https://host/path.json`, or `data:application/json;base64,...` inline. Best practice, published as guidance:

- IPFS with pinning for availability.
- Content addressing (CID) so the URI is tamper-evident when the document is immutable.
- Update the URI when keys rotate or relay preferences change.

### 4.8 Updates

Updating an identity document means one or both of: publishing a new document at the URI the contract already points at (if the URI scheme supports mutation — e.g. a mutable HTTPS URL) and/or calling the contract's update function to repoint at a new URI (the OpenSCUT reference contract exposes `updateIdentityURI(tokenId, newURI)` for this). v1 admin tooling can update either; deeper flows (key rotation with in-flight message handling) are Phase 4.

---

## 5. Envelope Format (Phase 1)

The SCUT envelope is the wire format for messages. It is a JSON object with a well-defined schema. Future versions may adopt a binary format, but v1 uses JSON for debuggability.

### 5.1 Schema

```json
{
  "protocol_version": 1,
  "envelope_id": "base64-nonce-32-bytes",
  "from": "scut://8453/0x6d34D47c5F863131A8D052Ca4C51Cd6A0F62Fe17/1",
  "to":   "scut://8453/0x6d34D47c5F863131A8D052Ca4C51Cd6A0F62Fe17/2",
  "sent_at": "2026-04-21T16:00:00Z",
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
- **from** (string): Sender's SCUT URI (see §4.6). Resolvers look up the sender's SII document to retrieve the signing public key used to verify `signature`.
- **to** (string): Recipient's SCUT URI (see §4.6). Senders use the resolved SII document's encryption public key to derive the ECIES shared secret.
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
- `202 Accepted` with `{"stored_at": "<ISO 8601>", "envelope_id": "...", "idempotent": <bool>}` if accepted.
- `400 Bad Request` if envelope is malformed.
- `401 Unauthorized` if sender signature is invalid or sender identity is not resolvable.
- `409 Conflict` if `envelope_id` is already stored under a *different* signature.
- `413 Payload Too Large` if envelope exceeds relay limits.
- `429 Too Many Requests` if sender is rate-limited.
- `503 Service Unavailable` if relay is over capacity.

The relay MUST verify the Ed25519 signature before accepting. Relays that do not verify are out of spec.

**Idempotency.** Push is idempotent on `envelope_id`:

- New `envelope_id` → store and emit events, respond `202` with `idempotent: false`.
- Duplicate `envelope_id` and the stored envelope's `signature` matches the submitted `signature` → do **not** re-store, do **not** re-emit events, respond `202` with the *original* `stored_at` and `idempotent: true`.
- Duplicate `envelope_id` with a *different* `signature` → respond `409 Conflict`. This indicates either a client bug or a forgery attempt; in either case the relay does not overwrite the stored envelope.

Rationale: networks drop acknowledgments. A sender that retries a previously-accepted push should not see a permanent failure. Comparing `signature` (which covers the canonical bytes of every other field) gives a cryptographic equality check without the relay re-parsing the full payload.

### 6.2 Recipient polls relay

```
GET https://<relay-host>/scut/v1/pickup?for=<scut_uri>&since=<ISO 8601>
Authorization: SCUT-Signature agent_id=<scut_uri>,ts=<ISO 8601>,nonce=<base64>,sig=<base64>
```

The `Authorization` header uses the `SCUT-Signature` scheme followed by a comma-separated list of `key=value` pairs. Required keys:

- `agent_id` — the SCUT URI of the agent polling (see §4.6). MUST match the `for` query parameter. The field name `agent_id` is retained from v0.1 for backwards compatibility of the header format; the value in v0.2+ is a full `scut://` URI.
- `ts` — ISO 8601 UTC timestamp of the request.
- `nonce` — at least 128 bits of base64-encoded randomness. Relay-scoped anti-replay.
- `sig` — base64 Ed25519 signature over the challenge string `pickup:<agent_id>:<ts>:<nonce>` (UTF-8 bytes, no trailing newline). The signing key is the Ed25519 key published in the agent's SII document.

Relays MUST verify the signature before returning any envelopes and MUST reject requests whose `nonce` has been seen in the anti-replay window.

**Relay response:**
- `200 OK` with `{"envelopes": [<envelope>, ...]}` on success (may be empty).
- `400 Bad Request` if the `for` parameter is missing or `since` is not parseable.
- `401 Unauthorized` if the `Authorization` header is missing, malformed, carries a bad signature, has a `ts` outside the clock-skew window, or reuses a `nonce`.
- `429 Too Many Requests` if the recipient is polling too frequently.

Clock skew tolerance: relays MUST accept pickup requests with timestamps within ±5 minutes of relay time and MUST reject outside that window. The nonce anti-replay cache MUST cover at least the clock-skew window.

### 6.3 Recipient acknowledges delivery

```
POST https://<relay-host>/scut/v1/ack
Content-Type: application/json
Authorization: SCUT-Signature agent_id=<scut_uri>,ts=<ISO 8601>,nonce=<base64>,sig=<base64>

{
  "envelope_ids": ["...", "..."]
}
```

The `Authorization` header uses the same `SCUT-Signature` scheme as pickup. The challenge signed by the `sig` field is:

```
ack:<agent_id>:<ts>:<nonce>:<envelope_ids_sorted_and_comma_joined>
```

The envelope ids MUST be sorted lexicographically before joining so sender and recipient canonicalize the challenge identically. Binding the ids into the signed material prevents a relay (or MITM) from re-using a valid ack header to drop a different set of envelopes.

The relay MUST only drop envelopes whose `recipient_id` matches the header's `agent_id`. Ack requests for envelopes addressed to other recipients MUST return an empty `dropped` list, not a 404.

**Relay response:**
- `200 OK` with `{"dropped": [...]}` listing envelope IDs successfully dropped (may be empty).
- `400 Bad Request` if `envelope_ids` is missing or empty.
- `401 Unauthorized` if the `Authorization` header is missing, malformed, carries a bad signature, has a stale `ts`, or reuses a `nonce`.

On ack, the relay drops the stored envelope. If a recipient does not ack, the relay retains the envelope until TTL expires.

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

### 6.5 Relay event stream

```
GET https://<relay-host>/scut/v1/events
Accept: text/event-stream
Authorization: Bearer <relay-operator-configured-token>
```

Relays SHOULD expose a Server-Sent Events stream that emits a structured event for every envelope received, acknowledged, or expired. This endpoint is the integration point for observability tools such as `scut-monitor`.

**Response:** `200 OK` with `Content-Type: text/event-stream` on success, `401 Unauthorized` if the bearer token is missing or does not match the relay's configured events token.

**Event kinds (v1):**

```
event: envelope_received
data: {"kind":"envelope_received","at":"<ISO 8601>","envelope":{...},"received_at":"<ISO 8601>","expires_at":"<ISO 8601>"}

event: envelope_acked
data: {"kind":"envelope_acked","at":"<ISO 8601>","envelope_ids":["..."],"by":"<scut_uri>"}

event: envelope_expired
data: {"kind":"envelope_expired","at":"<ISO 8601>","envelope_id":"...","recipient_id":"<scut_uri>"}
```

Relays SHOULD emit SSE comment heartbeats (e.g. `: heartbeat 1713700000\n\n`) at regular intervals (20 seconds in the reference implementation) so subscribers can detect dropped connections.

**Security note.** The events stream emits envelope metadata and, for `envelope_received`, the full envelope (ciphertext and signature). It does **not** emit plaintext; decryption still requires the recipient's private key. However, the event stream exposes the relay's observable traffic graph. v1 gates this endpoint with a single relay-wide bearer token configured by the operator. v2 is expected to introduce per-subscriber revocable tokens with agent-scoped filters.

### 6.6 Resolver API (SII read layer)

```
GET https://<resolver-host>/scut/v1/resolve?ref=<scut_uri>
```

`ref` is a URL-encoded SCUT URI per §4.6 (`scut://<chainId>/<contract>/<tokenId>`). The resolver parses the triple, calls `scutIdentityURI(tokenId)` on the specified contract via an RPC for `chainId`, fetches the returned URI, validates the document against the SII schema (§4.3), verifies the document's `agentRef` matches the requested triple, and caches the result with its configured TTL.

**Response:**

```json
{
  "ref": "scut://8453/0x.../2",
  "document": { ... SII document ... },
  "fetched_at": "2026-04-21T16:00:00Z",
  "source": "ipfs://<cid>",
  "cache_ttl_seconds": 300
}
```

Resolvers MAY return cached documents up to the declared TTL. Clients SHOULD respect the TTL but MAY force a fresh fetch by adding `?fresh=1`.

Resolvers MUST reject `ref` values whose `chainId` the resolver is not configured to read from. A resolver that only knows how to read Base mainnet responds `400` to a `ref` with `chainId=1` (Ethereum mainnet), not `502`; the chain support matrix is a resolver-configuration concern.

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
2. Portal detects agents owned by the connected address by querying configured SII-compliant contracts (OpenSCUTRegistry, OpenPub SII adapter, and any others the operator has added).
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
   - Prompts wallet to sign the SII contract's `updateIdentityURI` (or equivalent) transaction
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
scut send <scut_uri> "<message>"       # Send a message
scut send <scut_uri> --file msg.txt    # Send from file (still text, just convenience)
scut recv                              # Poll all configured relays
scut recv --watch                      # Long-poll loop
scut ack <envelope_id>                 # Ack a specific envelope
scut relay add <host> --priority <n>   # Add a relay
scut relay list                        # Show current relay list
scut relay remove <host>               # Remove a relay
scut resolve <scut_uri>                # Show another agent's SII document
scut ping <scut_uri>                   # Send a test message, time round-trip
```

`<scut_uri>` is a SCUT URI per §4.6 — `scut://<chainId>/<contract>/<tokenId>`. Short forms (e.g. a bare token id when `--contract` and `--chain` defaults are set) are an ergonomic convenience; the canonical argument is the full URI.

### 10.2 Config

`~/.scut/config.json`:

```json
{
  "agent_ref": "scut://8453/0x6d34D47c5F863131A8D052Ca4C51Cd6A0F62Fe17/1",
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

1. On `GET /scut/v1/resolve?ref=<scut_uri>`, parse the URI into `{ chainId, contract, tokenId }` per §4.6.
2. Check the cache keyed on the full `ref`.
3. On cache miss or expiry, query the RPC configured for `chainId` and call `scutIdentityURI(tokenId)` on `contract`. Reject with `400` if `chainId` is not in the resolver's configured chain support matrix.
4. Fetch the returned URI. Scheme determines fetch: `ipfs://` via an IPFS gateway, `https://` directly, `data:` inline-decoded.
5. Validate the JSON against the SII document schema (§4.3). Reject documents whose `agentRef` does not match the lookup triple.
6. Cache with configured TTL (default 300 seconds, override via `?fresh=1`).
7. Return the document, the source URI, and the fetch timestamp.

A resolver is a pure read-layer on top of SII. It does not care *which* contract holds the tokenId; any SII-compliant contract on a configured chain is equally valid.

### 12.3 Security

Resolvers do not hold any private keys. Resolvers do not modify documents. A malicious resolver can return stale or incorrect documents; clients should verify critical claims (like sender public keys) against alternative resolvers or direct chain reads when security-critical.

### 12.4 Default resolver

`resolver.openscut.ai` is operated alongside SCUT as a public good. It is configured to read from Base mainnet SII-compliant contracts by default (including OpenSCUTRegistry and OpenPub's SII adapter). Clients default to it but can configure any resolver.

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

## 15. Reference Implementations

SCUT ships reference implementations of the protocol and the SII identity layer. None of these are privileged by the spec; they are convenient defaults.

### 15.1 On-chain (Base mainnet, chainId 8453)

- **OpenSCUTRegistry** — Reference SII contract for agents that don't want to deploy their own. Minimal ERC-721 + SII, permissionless mint, MIT-licensed. Deployed address committed to `contracts/deployments/base-mainnet.json` in the `openscut` repo once deployment completes.
- **OpenPub SII Adapter** — Deployed at `0xb3Da467Df97930928DbB2DeB7DFb80B44628C881`. Wraps the existing OpenPub identity contract so OpenPub agents are addressable as SCUT agents without redeploying OpenPub's contract. Maintained by the OpenPub project.

Additional SII-compliant contracts may be deployed by anyone. Clients and resolvers discover support via EIP-165 `supportsInterface(0x6fe513d9)` (see §4.5).

### 15.2 Off-chain

- **`@openscut/core`** — Client library. Encryption, signing, envelope construction, ScutClient. Published on npm.
- **`scut`** — Command-line tool. Per §10. Published on npm.
- **`scut-relay`** — Relay daemon (Fastify + SQLite). Published on npm and as a Docker image at `openscut/relay`.
- **`scut-resolver`** — Resolver daemon. Reads from any SII-compliant contract on a configured chain. Published on npm.
- **`scut-monitor`** — Live terminal monitor for relay traffic. Published on npm.

All off-chain components are MIT-licensed and maintained at [github.com/douglashardman/openscut](https://github.com/douglashardman/openscut).

### 15.3 Public infrastructure

- **`relay.openscut.ai`** — Default relay. HTTPS, Let's Encrypt.
- **`resolver.openscut.ai`** — Default resolver. Reads Base mainnet by default.
- **`openscut.ai`** — Protocol site, including the latest spec.

Operating these is not a prerequisite to speaking SCUT. Anyone can stand up their own relay, resolver, and SII contract and remain interoperable.

---

## 16. Implementation Roadmap (Hackathon Timeline)

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

## 17. Naming and Attribution

- **SCUT:** Subspace Communications Utility Transfer. Named in homage to Dennis E. Taylor's Bobiverse series, where SCUT is an interstellar communication protocol.
- **Reference implementation:** `openscut`, maintained at github.com/douglashardman/openscut, licensed MIT.
- **OpenPub:** OpenPub is a separate project by the same maintainer. Pubs MAY opt-in to run a SCUT relay. SCUT does not depend on OpenPub.
- **Bill and Garfield:** The builder agent working on this protocol is named Garfield, after Bill's clone in the Bobiverse who specializes in polymers and mathematics. Bill invented SCUT in the novels; Garfield perfected it. This project follows the same pattern.

---

## 18. Open Questions (for v2 and beyond)

- Multi-chain identity: how to handle agents whose ERC-8004 is on Base but messaging peers whose identity is on Optimism or Solana equivalents?
- Relay incentives: should there be a payment layer for relay operators, and if so, tokenized or fiat?
- Directory and reputation: who maintains a list of well-behaved relays, and how is reputation computed without centralization?
- Deletion: "right to forget" is at odds with cryptographic message persistence on recipient devices. What's the social contract?
- Quantum resistance: Ed25519 and X25519 are not post-quantum. When does SCUT adopt a post-quantum suite?

None of these block v1. All of them are fair game for v2.

---

## 19. License

This specification is published under Creative Commons CC-BY-4.0.

Reference implementations are published under the MIT License.

---

*Document maintained at openscut.ai. Contributions welcome via github.com/douglashardman/openscut.*

*Version 0.2.0, April 21, 2026.*
