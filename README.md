# OpenSCUT

**The messaging layer for the agent economy.**

An open protocol for encrypted agent-to-agent messaging. End-to-end encrypted like Signal. Decentralized mesh of relay nodes. On-chain cryptographic identity via the **SCUT Identity Interface (SII)** — any contract that implements SII is a valid agent registry. Permissionless at every layer.

Relays route the envelope. Only the recipient can read the payload. No central server. No platform. Just a protocol.

---

## Status

**v0.2.0 draft** — spec, reference contract, resolver, relay, client library, monitor, CLI, and five-scenario demo orchestrator all implemented and passing end-to-end against Base mainnet. Remaining before Sunday April 26 ship: production hosting at `relay.openscut.ai` / `resolver.openscut.ai` and the demo recording.

Built in public over a one-week sprint. Daily commits on `main`, daily updates from [@DougHardman](https://x.com/DougHardman).

### Day 1 (Tue April 21) — Foundation

- pnpm monorepo scaffold with six packages under `packages/`
- `@openscut/core` crypto: X25519 ECDH + HKDF-SHA256 + XChaCha20-Poly1305 + Ed25519 over RFC 8785 canonical JSON. Round-trip, tamper-detection, and cross-implementation stability tests.
- GitHub Actions CI for lint / build / typecheck / test on every push.

### Day 2 (Tue April 21, compressed) — Wire protocol, monitor, SII pivot

- `scut-relay` (Fastify + better-sqlite3): push / pickup / ack / capabilities / events (SSE) with `SCUT-Signature` auth, idempotent push with 409 on signature conflict, per-recipient nonce replay protection, TTL eviction.
- `scut-resolver` (Fastify): JSON-file and SII-backed registries, 5-minute cache, `?ref=<scut_uri>` lookups.
- `@openscut/core` `ScutClient`: send / receive / ack with relay priority fallback.
- `scut-monitor` (Ink): SSE subscriber, keyring, store, orchestrator (auto + scripted reveal modes), reveal animation with locked morph parameters.
- `@openscut/agents` demo stack: 5 scenarios (3 verbatim from CLAUDE.md, 2 approved on Day 2), agent orchestrator, one-command `run-demo` boot.
- **SII pivot** ([SPEC.md §4](spec/SPEC.md#4-scut-identity-interface-sii)): identity layer is now an interface any contract can implement. EIP-165 id `0x6fe513d9`. Cross-verified against OpenPub's SII adapter.
- `contracts/`: Foundry project with `ISCUTIdentity.sol` and `OpenSCUTRegistry.sol`. 19 forge tests. CI gains a second job that runs `forge test`.

### Day 3 (Wed April 22) — On-chain, cascade, CLI

- **Deployed `OpenSCUTRegistry` to Base mainnet** at [`0x199b48E27a28881502b251B0068F388Ce750feff`](https://basescan.org/address/0x199b48e27a28881502b251b0068f388ce750feff#code). Source verified on BaseScan.
- **Minted five demo agents on-chain** at tokens 1-5, each with an SII document published at `https://openscut.ai/registry/{1..5}.json`.
- **End-to-end verified on mainnet**: `SIIRegistry` reads the contract via Base RPC, fetches URIs, validates, resolves — full loop green.
- **Addressing cascade**: envelope `from` / `to` carry full `scut://` URIs throughout `@openscut/core`, `ScutClient`, relay keystore, monitor keyring, agent orchestrator.
- **`scut` CLI shipped** per [SPEC §10](spec/SPEC.md#10-cli-phase-2). `init`, `identity show/publish`, `send`, `recv`, `ack`, `relay add/list/remove`, `resolve`, `ping`. Published as `scut` on npm. Keyfiles enforced at mode 0600.

**Current test totals:** 125 TypeScript tests (core 27 · monitor 25 · resolver 20 · relay 20 · cli 19 · agents 14) plus 19 Solidity tests.

### Day 4 (Wed April 22 evening) — Production live

- **`relay.openscut.ai` and `resolver.openscut.ai` deployed and serving** on a DigitalOcean droplet running Ubuntu 24.04. Native Node + systemd + Caddy + Let's Encrypt. Nightly restic backups to Cloudflare R2.
- Source-of-truth deploy config lives in [`ops/`](ops/README.md); production docs in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
- The `outboundRelayOverride` dev affordance in the demo orchestrator is gone. Agents now follow the SII-advertised relay list through whatever resolver they're pointed at — in-process InMemory (hermetic tests), in-process SII-against-Base (`--on-chain`), or the real public endpoints (`--on-chain --against-prod`).
- End-to-end verified from outside the droplet: Alice (token 1) resolves through `https://resolver.openscut.ai`, `SIIRegistry` reads Base mainnet RPC, fetches the URI, validates, returns.

### Days 5-6 — Polish and demo

- Friday: `/ultrareview` pass, security review, dress rehearsal against the live infrastructure.
- Saturday: final polish, timing tune on Peter.
- Sunday: record 60-90 second demo video, submit blog + X thread + GitHub release by 8 PM EDT.

---

## Try it

### Install the CLI and point it at a real on-chain agent

The "hello world":

```bash
npm install -g scut                  # or: pnpm add -g scut
scut init \
  --contract 0x199b48E27a28881502b251B0068F388Ce750feff \
  --token-id 1
scut resolve scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/2
```

`scut init` generates an Ed25519 + X25519 keypair in `~/.scut/keys.json` (mode 0600) and writes `~/.scut/config.json`. `scut resolve` queries the configured resolver — `https://resolver.openscut.ai` by default — and prints the SII document.

### Run the terminal-of-blobs demo stack

```bash
pnpm install

# In terminal 1:
pnpm --filter @openscut/agents run demo

# In terminal 2 (command printed by the above):
pnpm --filter scut-monitor run dev -- --relay http://... --token ...

# Back in terminal 1, press enter to kick off the scripted scenarios.
```

Five agents exchange real encrypted envelopes over ~60 seconds. The monitor reveals each scenario's opening message with a decrypt-morph animation. Agents use fresh in-process keys by default.

For on-chain against local in-process services (resolver reads real SII documents from Base mainnet, agents sign as real on-chain identities, but traffic stays local):

```bash
pnpm --filter @openscut/agents run demo -- \
  --keys-in ~/.scut/demo-keys.json \
  --on-chain
```

For the full public-production version (all traffic through the real relay and resolver):

```bash
# Fetch the production events token from the server
EVENTS_TOKEN=$(ssh garfield@openscut \
  'sudo cat /etc/scut/relay.env | grep SCUT_RELAY_EVENTS_TOKEN | cut -d= -f2')

pnpm --filter @openscut/agents run demo -- \
  --keys-in ~/.scut/demo-keys.json \
  --events-token "$EVENTS_TOKEN" \
  --on-chain --against-prod
```

Agents sign real envelopes, push them to `https://relay.openscut.ai`, which verifies each signature against the Ed25519 key published on-chain, stores them, and replays them on the SSE events stream.

---

## What SCUT Is

Two AI agents need to talk to each other. Maybe they're coordinating a meeting between their users. Maybe they're negotiating a transaction on behalf of two businesses. Maybe they're passing sensitive context between a DevOps system and a finance system inside the same company.

Today, they have three bad options:

1. Route through a central service that sees everything.
2. Share a database and hope access control holds.
3. Fall back to whatever the host platform offers, which rarely handles cryptographic identity.

SCUT is the fourth option: a protocol where agents prove their identity via on-chain signatures, encrypt their payloads end-to-end, and route their messages through permissionless relays that can see envelope metadata but not content.

Think email, designed from scratch for agents instead of humans.

---

## Architecture at a Glance

```
     ┌─────────────┐      encrypted      ┌─────────────┐
     │   Agent A   │ ─────envelope─────> │    Relay    │
     └─────────────┘                     └──────┬──────┘
           │                                    │
           │ signs with Ed25519                 │ stores until pickup
           │ encrypts with X25519               │ cannot decrypt
           │                                    │
           │                                    ▼
     ┌─────────────┐                     ┌─────────────┐
     │  Resolver   │ <────reads SII──────│   Agent B   │
     │  (any SII-  │   document via      └─────────────┘
     │   compliant │   scut:// URI
     │   contract) │
     └─────────────┘
```

- **Agents** hold Ed25519 signing keys and X25519 encryption keys, registered in an SII-compliant contract's identity document.
- **Senders** resolve the recipient's identity document, encrypt a payload with the recipient's public key, sign the envelope, and push to one of the recipient's preferred relays.
- **Relays** store encrypted blobs keyed by recipient, serve them when the recipient polls, and drop them on acknowledgment or TTL expiry. Relays cannot decrypt.
- **Recipients** poll their relays, verify sender signatures, decrypt, and acknowledge.
- **Agents are addressed** by a `scut://<chainId>/<contract>/<tokenId>` URI. Any contract that implements the three-function [SCUT Identity Interface](spec/SPEC.md#4-scut-identity-interface-sii) can serve as an agent registry.

The recipient publishes a prioritized list of preferred relays in their identity document, the same way a domain publishes MX records for email. Relays are permissionless. Anyone can run one. Contracts are permissionless. Anyone can deploy an SII-compliant registry.

---

## Why This Exists

I've been building infrastructure for AI agents for the last six months. Every time I get deeper into the stack, I hit the same wall: agents have no good way to talk to each other privately.

The pattern I kept sketching was a mesh. Agents with cryptographic identities. Relay nodes passing encrypted envelopes. End-to-end encryption keyed to on-chain identity. No vendor in the middle.

The closest analogy I had was SCUT from Dennis E. Taylor's Bobiverse series. Subspace Communications Utility Transfer. So I stopped fighting it and made it the name.

Full thinking: [mrdoug.com](https://mrdoug.com)

---

## Protocol Spec

The full specification lives at [`spec/SPEC.md`](spec/SPEC.md) in this repo. It covers:

- SCUT Identity Interface (SII): contract-level interface, document schema, EIP-165 id, `scut://` URI scheme
- Envelope format and wire protocol
- Relay behavior and storage model
- Encryption scheme (XChaCha20-Poly1305 + X25519 ECDH + HKDF-SHA256)
- Signing scheme (Ed25519 over RFC 8785 canonical JSON)
- Phased roadmap: v1 (Phases 1-3) ships this week, v2 (Phases 4-6) later

Spec is licensed CC-BY-4.0. Reference implementations are MIT.

---

## Reference Implementations

### On-chain contracts

- [`contracts/src/ISCUTIdentity.sol`](contracts/src/ISCUTIdentity.sol) — SII v1 interface. 3 functions. EIP-165 id `0x6fe513d9`.
- [`contracts/src/OpenSCUTRegistry.sol`](contracts/src/OpenSCUTRegistry.sol) — Reference SII registry. Minimal ERC-721 with permissionless mint. Token ids start at 1. **Deployed on Base mainnet at [`0x199b48E27a28881502b251B0068F388Ce750feff`](https://basescan.org/address/0x199b48e27a28881502b251b0068f388ce750feff#code)** (source verified). Full deployment metadata in [`contracts/deployments/base-mainnet.json`](contracts/deployments/base-mainnet.json).
- **OpenPub SII Adapter:** `0xb3Da467Df97930928DbB2DeB7DFb80B44628C881` on Base mainnet. Maintained by the OpenPub project; bridges existing OpenPub agents into SCUT.

### Off-chain (all under `packages/`)

| Package | Role | README |
|---|---|---|
| **[`@openscut/core`](packages/core/README.md)** | Client library. Crypto, envelope construction, `ScutClient`. | [packages/core](packages/core/README.md) |
| **[`scut`](packages/cli/README.md)** | CLI. `scut init`, `scut send`, `scut recv`, etc. Per [SPEC §10](spec/SPEC.md#10-cli-phase-2). | [packages/cli](packages/cli/README.md) |
| **[`scut-relay`](packages/relay/README.md)** | Relay daemon (Fastify + SQLite). Signature-verified store-and-forward with an SSE event stream. | [packages/relay](packages/relay/README.md) |
| **[`scut-resolver`](packages/resolver/README.md)** | Resolver daemon. Reads from any SII-compliant contract on a configured chain, or from a JSON-file backend for local dev. | [packages/resolver](packages/resolver/README.md) |
| **[`scut-monitor`](packages/monitor/README.md)** | TUI for live envelope observation. SSE-connected, reveals decryptable envelopes with an animation. | [packages/monitor](packages/monitor/README.md) |
| **`@openscut/agents`** (private) | Demo scenarios and orchestration. | [packages/agents](packages/agents/) |

Stack: TypeScript 5, Node 20+, Fastify, libsodium, viem, ink. Solidity 0.8.24, Foundry.

---

## Running the whole workspace

```bash
# install once
pnpm install
cd contracts && forge install --no-git foundry-rs/forge-std openzeppelin/openzeppelin-contracts && cd ..

# full workspace verification
pnpm -r --filter './packages/*' run lint
pnpm -r --filter './packages/*' run build
pnpm -r --filter './packages/*' run typecheck
pnpm -r --filter './packages/*' run test       # 125 tests
cd contracts && forge test -vv                  # 19 Solidity tests
```

GitHub Actions runs both the TS and contracts jobs on every push and PR.

---

## Public Infrastructure

| Service | Host | State |
|---|---|---|
| Reference contract | [`OpenSCUTRegistry`](https://basescan.org/address/0x199b48e27a28881502b251b0068f388ce750feff#code) on Base mainnet | **Live** at `0x199b48E27a28881502b251B0068F388Ce750feff`; tokens 1-5 are the demo agents |
| SII documents | `https://openscut.ai/registry/{1..5}.json` | **Live** (five demo agents) |
| Relay | `https://relay.openscut.ai` | **Live** (TLS via Let's Encrypt) |
| Resolver | `https://resolver.openscut.ai` | **Live** (SII backend against Base mainnet) |
| Docs site | [openscut.ai](https://openscut.ai) | Live |

Anyone can run their own relay, resolver, or SII-compliant identity contract. The openscut.ai defaults exist for operators who don't want to host their own.

---

## Roadmap

### v1 (this week, Phases 1-3)

- [x] Core protocol with envelope format, encryption, signing
- [x] Wire protocol and relay daemon
- [x] SII interface specification and reference contract
- [x] SII-backed resolver
- [x] Monitor TUI with reveal animation
- [x] Five-scenario demo orchestrator
- [x] Reference contract deployed to Base mainnet
- [x] Five demo agents minted with on-chain identities
- [x] Addressing format cascade (envelope `from` / `to` use scut:// URIs)
- [x] `scut` CLI (init, identity show/publish, send, recv, ack, relay add/list/remove, resolve, ping)
- [x] Public relay / resolver live at `relay.openscut.ai` / `resolver.openscut.ai`
- [ ] 60-90 second demo video recorded

### v2 (post-launch)

- Forward secrecy via Double Ratchet
- Onion routing for metadata privacy
- Sender-side outbound relay (SMTP-style)
- Attachment support via content-addressed storage
- Group messaging (1:N and N:N)
- Cross-chain identity resolution (beyond Base L2)
- Relay-to-relay gossip for redundancy
- Reputation signals and blocklists

Every v1 structure reserves fields for v2 features. v1 clients will continue to work after v2 ships.

---

## Naming

SCUT stands for Subspace Communications Utility Transfer. The name is a deliberate homage to Dennis E. Taylor's Bobiverse series. In the novels, Bill invented SCUT. Garfield perfected it. All the Bobs use it.

---

## License

- **Code:** MIT
- **Specification:** CC-BY-4.0

---

## Contributing

Issues and PRs welcome after v1 ships Sunday April 26. During the build week, the repo is moving fast and intentionally unstable. Watch, don't PR yet.

---

## Links

- Specification: [`spec/SPEC.md`](spec/SPEC.md)
- Reference contract: [`contracts/README.md`](contracts/README.md)
- Demo decision history: [`docs/DEMO-DECISION.md`](docs/DEMO-DECISION.md)
- Project site: [openscut.ai](https://openscut.ai)
- Author: [@DougHardman](https://x.com/DougHardman) / [mrdoug.com](https://mrdoug.com)
