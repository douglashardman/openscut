# OpenSCUT

**The messaging layer for the agent economy.**

An open protocol for encrypted agent-to-agent messaging. End-to-end encrypted like Signal. Decentralized mesh of relay nodes. MX-style discovery via on-chain ERC-8004 identity. Permissionless.

Relays route the envelope. Only the recipient can read the payload. No central server. No platform. Just a protocol.

---

## Status

**v0.1.0 draft** — spec published, reference implementation in active development.

Shipping v1 by Sunday, April 26, 2026, 8:00 PM EDT.

This repo is being built in public over a one-week sprint. Follow along at [@DougHardman](https://x.com/DougHardman) on X. Daily commits, daily updates.

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
     │  Resolver   │ <──lookup identity──│   Agent B   │
     │  (reads     │                     └─────────────┘
     │   ERC-8004) │
     └─────────────┘
```

- **Agents** hold Ed25519 signing keys and X25519 encryption keys, registered in an on-chain identity document.
- **Senders** resolve the recipient's identity document, encrypt a payload with the recipient's public key, sign the envelope, and push to one of the recipient's preferred relays.
- **Relays** store encrypted blobs keyed by recipient, serve them when the recipient polls, and drop them on acknowledgment or TTL expiry. Relays cannot decrypt.
- **Recipients** poll their relays, verify sender signatures, decrypt, and acknowledge.

The recipient publishes a prioritized list of preferred relays in their identity document, the same way a domain publishes MX records for email. Relays are permissionless. Anyone can run one.

---

## Why This Exists

I've been building infrastructure for AI agents for the last six months. Every time I get deeper into the stack, I hit the same wall: agents have no good way to talk to each other privately.

The pattern I kept sketching was a mesh. Agents with cryptographic identities. Relay nodes passing encrypted envelopes. End-to-end encryption keyed to on-chain identity. No vendor in the middle.

The closest analogy I had was SCUT from Dennis E. Taylor's Bobiverse. Subspace Communications Utility Transfer. So I stopped fighting it and made it the name.

Full thinking: [mrdoug.com](https://mrdoug.com)

---

## Protocol Spec

The full specification lives at [`spec/SPEC.md`](spec/SPEC.md) in this repo. It covers:

- Envelope format and wire protocol
- Identity document schema
- Relay behavior and storage model
- Encryption scheme (XChaCha20-Poly1305 + X25519 ECDH + HKDF-SHA256)
- Signing scheme (Ed25519 over RFC 8785 canonical JSON)
- Phased roadmap: v1 (Phases 1-3) ships this week, v2 (Phases 4-6) later

Spec is licensed CC-BY-4.0. Reference implementations are MIT.

---

## Reference Implementation

All packages live in this monorepo under `packages/`:

- **`@openscut/core`** — Client library. Encryption, signing, envelope construction, relay communication.
- **`scut`** — CLI for humans and scripts. `scut init`, `scut send`, `scut recv`, etc.
- **`scut-relay`** — Relay daemon. Fastify + SQLite. Deploy alongside your agent infrastructure.
- **`scut-resolver`** — Identity document resolver. Stateless HTTP service.
- **`scut-monitor`** — TUI for live envelope observation. For relay operators and demos.
- **`@openscut/agents`** — Demo agents and orchestration scripts.

Stack: TypeScript, Node 20+, Fastify, libsodium, ink.

---

## Quickstart

Coming Tuesday, April 21. The first working version ships to npm mid-week.

---

## Public Infrastructure

- **Relay:** `relay.openscut.ai`
- **Resolver:** `resolver.openscut.ai`
- **Docs:** [openscut.ai](https://openscut.ai)

All three go live during the v1 build week. Anyone can run their own relay and resolver. These are just defaults for people who don't want to host their own.

---

## Roadmap

### v1 (this week, Phases 1-3)
- Core protocol with envelope format, encryption, signing
- Wire protocol and relay daemon
- Identity document schema (local mock registry)
- CLI, client library, and relay/resolver services
- Monitor TUI for observing traffic

### v2 (post-launch)
- Forward secrecy via Double Ratchet
- Onion routing for metadata privacy
- Sender-side outbound relay (SMTP-style)
- Attachment support via content-addressed storage
- Group messaging (1:N and N:N)
- Base L2 on-chain identity document lookup
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
- Project site: [openscut.ai](https://openscut.ai)
- Author: [@DougHardman](https://x.com/DougHardman) / [mrdoug.com](https://mrdoug.com)
- Build-week demo decisions: [`docs/DEMO-DECISION.md`](docs/DEMO-DECISION.md)
