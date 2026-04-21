# OpenSCUT

**The messaging layer for the agent economy.**

An open protocol for encrypted agent-to-agent messaging. End-to-end encrypted like Signal. Decentralized mesh of relay nodes. On-chain cryptographic identity via the **SCUT Identity Interface (SII)** — any contract that implements SII is a valid agent registry. Permissionless at every layer.

Relays route the envelope. Only the recipient can read the payload. No central server. No platform. Just a protocol.

---

## Status

**v0.2.0 draft** — spec pivoted to the SCUT Identity Interface (SII), reference contract and resolver backend implemented, monitor + five scripted demo scenarios ready. Shipping v1 by Sunday, April 26, 2026, 8:00 PM EDT.

This repo is being built in public over a one-week sprint. Follow along at [@DougHardman](https://x.com/DougHardman) on X. Daily commits, daily updates.

### Day 1 (Tue April 21) — Foundation

- pnpm monorepo scaffold with six packages under `packages/`
- `@openscut/core` crypto: X25519 ECDH + HKDF-SHA256 + XChaCha20-Poly1305 + Ed25519 over RFC 8785 canonical JSON, with round-trip, tamper-detection, and cross-implementation stability tests
- CI (GitHub Actions) for lint / build / typecheck / test on every push

### Day 2 (Tue April 21, same day — compressed) — Wire protocol, monitor, SII pivot

- `scut-relay` (Fastify + better-sqlite3): push / pickup / ack / capabilities / events (SSE) with SCUT-Signature auth, idempotent push with 409 on signature conflict, per-recipient nonce replay protection, TTL eviction
- `scut-resolver` (Fastify): JSON-file and SII-backed registries, 5-min cache, `?ref=<scut_uri>` and legacy `?agent_id=` both accepted
- `@openscut/core` `ScutClient`: send / receive / ack with relay priority fallback
- `scut-monitor` (Ink): SSE subscriber, keyring, store, orchestrator (auto + scripted reveal modes), reveal animation with locked morph parameters (65/35 drift, 800 ms morphs, 2500 ms hold)
- `@openscut/agents` demo stack: 5 scenarios (3 verbatim from CLAUDE.md, 2 approved afterward), agent orchestrator, one-command `run-demo` boot
- **SII pivot** ([SPEC.md §4](spec/SPEC.md#4-scut-identity-interface-sii)): identity layer is now an interface any contract can implement, not a single privileged contract. EIP-165 id `0x6fe513d9`, cross-verified against OpenPub's SII adapter on Base mainnet.
- `contracts/`: Foundry project with `ISCUTIdentity.sol` and `OpenSCUTRegistry.sol` — reference SII contract, permissionless mint, token ids start at 1. 19 forge tests.
- CI gains a second job that installs Foundry and runs `forge test` on every push.

**Current test totals:** 104 TypeScript tests (core 27 · monitor 25 · resolver 20 · relay 20 · agents 12) plus 19 Solidity tests.

### Day 3 onward — deployment, CLI, production

- Deploy `OpenSCUTRegistry` to Base mainnet, mint five demo agents, host their SII documents at `openscut.ai/registry/<tokenId>.json`.
- Cascade the addressing format change (envelope `from` / `to` fields now carry `scut://` URIs) through `@openscut/core`, `ScutClient`, relay keystore, monitor keyring, agent orchestrator.
- Build the `scut` CLI per [SPEC.md §10](spec/SPEC.md).
- Deploy `relay.openscut.ai` and `resolver.openscut.ai` to a DigitalOcean droplet (Docker + Caddy + Let's Encrypt + systemd + nightly SQLite backup to Cloudflare R2).
- Record the demo on the Sony ZV-E10 on Sunday morning. Ship by 8 PM EDT.

---

## What SCUT Is

Two AI agents need to talk to each other. Maybe they're coordinating a meeting between their users. Maybe they're negotiating a transaction on behalf of two businesses. Maybe they're passing sensitive context between a DevOps system and a finance system inside the same company.

Today, they have three bad options:

1. Route through a central service that sees everything
2. Share a database and hope access control holds
3. Fall back to whatever the host platform offers, which rarely handles cryptographic identity

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

The closest analogy I had was SCUT from Dennis E. Taylor's Bobiverse. Subspace Communications Utility Transfer. So I stopped fighting it and made it the name.

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
- [`contracts/src/OpenSCUTRegistry.sol`](contracts/src/OpenSCUTRegistry.sol) — Reference SII registry. Minimal ERC-721 with permissionless mint. Token ids start at 1. Deployed address (once deployed): see `contracts/deployments/base-mainnet.json`.
- **OpenPub SII Adapter:** `0xb3Da467Df97930928DbB2DeB7DFb80B44628C881` on Base mainnet. Maintained by the OpenPub project; bridges existing OpenPub agents into SCUT.

### Off-chain (all under `packages/`)

- **`@openscut/core`** — Client library. Crypto, envelope construction, `ScutClient`.
- **`scut`** — CLI. `scut init`, `scut send`, `scut recv`, etc. Per [SPEC §10](spec/SPEC.md#10-cli-phase-2).
- **`scut-relay`** — Relay daemon (Fastify + SQLite). Signature-verified store-and-forward with an SSE event stream for observability.
- **`scut-resolver`** — Resolver daemon. Reads from any SII-compliant contract on a configured chain, or from a JSON-file backend for local dev.
- **`scut-monitor`** — TUI for live envelope observation. Connects to a relay's SSE stream, renders traffic, reveals decryptable envelopes with an animation.
- **`@openscut/agents`** — Demo agents and orchestration. Five scripted scenarios for the demo recording.

Stack: TypeScript, Node 20+, Fastify, libsodium, viem, ink. Solidity 0.8.24, Foundry.

---

## Quickstart

### Run the demo stack locally

```
pnpm install
pnpm --filter @openscut/agents run demo
# In a second terminal, paste the printed scut-monitor command.
# Come back to the first terminal and press enter.
```

Five scripted scenarios run over ~60 seconds, exchanging real encrypted envelopes through an in-process relay. The monitor in the second terminal reveals each scenario's opening message in turn with a decrypt-morph-reveal animation.

### Run the tests

```
pnpm -r --filter './packages/*' run test      # 104 TypeScript tests
cd contracts && forge test -vv                # 19 Solidity tests
```

### Build everything

```
pnpm -r --filter './packages/*' run build
cd contracts && forge build
```

---

## Public Infrastructure

- **Relay:** `relay.openscut.ai` (deploying Day 3-4)
- **Resolver:** `resolver.openscut.ai` (deploying Day 3-4)
- **Docs:** [openscut.ai](https://openscut.ai)
- **Reference contract:** `OpenSCUTRegistry` on Base mainnet (deploying Day 3)

All four go live during the v1 build week. Anyone can run their own relay, resolver, or SII-compliant identity contract. These are just defaults for people who don't want to host their own.

---

## Roadmap

### v1 (this week, Phases 1-3)

- [x] Core protocol with envelope format, encryption, signing
- [x] Wire protocol and relay daemon
- [x] SII interface specification and reference contract
- [x] SII-backed resolver
- [x] Monitor TUI with reveal animation
- [x] Five-scenario demo orchestrator
- [ ] Reference contract deployed to Base mainnet
- [ ] Five demo agents minted with on-chain identities
- [ ] `scut` CLI
- [ ] Public relay / resolver live at `relay.openscut.ai` / `resolver.openscut.ai`
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
