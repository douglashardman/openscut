# Session Log — April 21, 2026

**Clock:** 11:03 AM CT → ~9:00 PM CT. Single calendar day. ~10 hours at the keyboard.

**Operator:** Doug Hardman (`@DougHardman`).
**Builder agent:** Garfield (Claude Opus 4.7, 1M context).
**Co-designers:** Guppi (architecture + planning, async), Poe (OpenPub adapter + SII verification, async), Simon (infrastructure + droplet, async).

This is the honest record of what we built in one session. It exists so Guppi can see the state without reading the git log end-to-end, so Doug has a non-cheerleading snapshot to point at, and so future-me has an accurate baseline if this project ever needs a post-mortem.

---

## State at start (April 21, ~11 AM CT)

- `openscut` repo on GitHub with four files: `CLAUDE.md` (builder context), `spec/SPEC.md` v0.1.0 (protocol draft from April 20), `docs/DEMO-DECISION.md` (parked demo thinking from April 20), `README.md` (project shell).
- No code. No CI. No npm packages. No contracts. No deployed infrastructure.

The ship deadline was Sunday April 26, 2026, 8 PM EDT. The expectation, set by `CLAUDE.md`, was six calendar days of work.

## State at end (April 21, ~9 PM CT)

- **On-chain:** `OpenSCUTRegistry` deployed on Base mainnet at [`0x199b48E27a28881502b251B0068F388Ce750feff`](https://basescan.org/address/0x199b48e27a28881502b251b0068f388ce750feff#code), source verified. Five demo agents minted to tokens 1-5. Total gas: $0.04.
- **SII documents:** Live at `https://openscut.ai/registry/{1..5}.json` (Cloudflare Pages, Simon owns hosting).
- **Production services:** `https://relay.openscut.ai` and `https://resolver.openscut.ai` on a DigitalOcean droplet. Caddy + Let's Encrypt + systemd. SSE event stream live.
- **npm packages:** `@openscut/core`, `scut`, `scut-relay`, `scut-resolver`, `scut-monitor` all built and tested. (Publishing to npm registry is the next click; tarballs are ready.)
- **Tests:** 125 TypeScript tests + 19 Solidity tests, all green.
- **Lines of code** (source + tests, not counting lockfiles or generated): ~6,500 TS, ~260 Solidity.

---

## Work done, in order

### 1. Foundation (morning, ~2 hours)

- pnpm monorepo scaffold, six packages stubbed.
- `@openscut/core` crypto: X25519 ECDH → HKDF-SHA256 → XChaCha20-Poly1305 for encryption, Ed25519 over RFC 8785 canonical JSON for signing. `buildEnvelope` / `openEnvelope`. 27 tests covering round-trip, tamper detection on every signed field, cross-implementation stability (rebuild envelope from serialized JSON, re-verify signature — caught one potential object-identity-signing bug during implementation).
- GitHub Actions CI: lint / build / typecheck / test on every push.

### 2. Wire protocol and demo stack (mid-morning → early afternoon, ~4 hours)

- `scut-relay` (Fastify + better-sqlite3): push, pickup, ack, capabilities, SSE events. SCUT-Signature header auth with nonce replay protection. Idempotent push with 409 on same-id/different-signature. TTL eviction job. 20 tests.
- `scut-resolver` (Fastify): JSON-file and SII-capable registries, 5-minute cache, `?ref=<scut_uri>` lookups. 20 tests.
- `ScutClient` in core: send / receive / ack with relay-priority fallback, dev-mode `outboundRelayOverride` (later removed).
- `scut-monitor` (Ink): RevealBox spike built standalone first, approved by Doug as the locked demo surface, then the full monitor (SSE subscriber, keyring, store, orchestrator with auto + scripted reveal modes) built around it. 25 tests.
- `@openscut/agents` demo stack: five scenarios (three verbatim from `CLAUDE.md`, two drafted and approved mid-session — scenario 4 was rewritten from a rejected doctor-appointment draft to HVAC service coordination; medical scenarios were explicitly out of scope per Doug). Agent orchestrator, one-command `run-demo` boot. 14 tests.

### 3. SII pivot (mid-afternoon, ~3 hours)

Guppi's architecture doc arrived mid-afternoon. It flipped the identity model from "SCUT uses OpenPub's contract" to "SCUT defines an interface (SII) any contract can implement." The motivation: OpenPub's existing contract stores ownership tokens only, not identity documents — the original plan would have hard-coded SCUT to OpenPub's hub database.

- Spec rewritten as v0.2.0: new §4 "SCUT Identity Interface (SII)" with Solidity interface, document schema, resolution flow, EIP-165 interface id (`0x6fe513d9`), and the `scut://<chainId>/<contract>/<tokenId>` URI scheme.
- Interface id computed via viem's keccak256 and cross-verified against Poe's SII adapter at `0xb3Da467Df97930928DbB2DeB7DFb80B44628C881` on Base mainnet. Both agreed.
- `contracts/` Foundry project with `ISCUTIdentity.sol` and `OpenSCUTRegistry.sol`. Permissionless mint, token ids start at 1. 19 forge tests.
- CI gains a second job that installs Foundry and runs `forge test`.

### 4. On-chain deploy and mint (mid-afternoon, ~1 hour)

- Fresh `scut-deployer` keystore on Doug's machine. Funded with 0.02 ETH on Base.
- Pre-computed the CREATE address (deterministic at nonce 0) so we could verify it matched after broadcast.
- Deploy dry-run, then `--broadcast` live. Contract landed at the predicted address. Actual cost: 0.00000619 ETH (~$0.025).
- Verified source on BaseScan.
- Keygen script on Doug's laptop generated five Ed25519 + X25519 keypairs. Private keys stayed on Doug's machine; stdout summary with only public keys pasted back to me for SII-document construction.
- Five SII documents published at `https://openscut.ai/registry/{1..5}.json`.
- Mint script minted tokens 1-5 to Doug's wallet with those URIs. $0.014 in gas.
- End-to-end verified: `SIIRegistry` resolves all five agents through Base mainnet RPC + openscut.ai fetch + schema validation + agentRef verification.

### 5. Addressing cascade (late afternoon, ~2 hours)

Removed the `IdentityDocument` / `SiiDocument` bridge and cascaded the `scut://` URI addressing format through the whole stack:

- `@openscut/core`: `types.ts` gets `AgentRef`, `SiiDocument` (camelCase, nested agentRef, optional metadata); `IdentityDocument` becomes an alias for `SiiDocument`. New `agent-ref.ts` exports `parseScutUri` / `formatScutUri` / `isScutUri`. `client.ts`: `HttpResolverClient.resolve(ref)` takes scut URI and calls `/scut/v1/resolve?ref=`. `ScutClient` config switches from `agentId` to `agentRef`. Version bumped to 0.2.0.
- `scut-resolver`: old `identityDocumentSchema` deleted; SII schema is the only validator. `Registry.lookup` returns `SiiDocument`. `SIIRegistry` no longer bridges back to v0.1 shape.
- `scut-relay` keystore: reads SII documents via the HTTP resolver, accesses `keys.signing.publicKey`.
- `scut-monitor` keyring: consumes SII documents, accesses camelCase fields.
- `@openscut/agents`: `scenarios.ts` exports `AGENT_REFS` with the real on-chain scut URIs (five reused agents: Alice in all five scenarios, Bob recurring in 1 and 3, services once each). Orchestrator builds one agent per unique ref.

All 106 tests at this point still green; 125 after CLI landed later.

### 6. scut CLI (early evening, ~1 hour)

- Full SPEC §10 surface: `scut init / identity show|publish / send / recv / ack / relay add|list|remove / resolve / ping`.
- Per-command unit tests (14) + five end-to-end tests that spawn the compiled CLI as a subprocess and verify real argv parsing, init → identity show, relay add/list/remove, missing-config exit code, invalid-URI rejection.
- Keyfile permission enforced at load time (mode 0600; load rejects group/world-readable with a remediation hint).
- `scut identity publish` is a v1 placeholder: prints the signed JSON document for the operator to paste into a wallet or admin portal. Does not write on-chain.

### 7. Documentation pass (mid evening, ~40 minutes)

- Main `README.md` rewritten to reflect real state with links to per-package READMEs.
- Five new per-package READMEs for the published artifacts (`@openscut/core`, `scut`, `scut-relay`, `scut-resolver`, `scut-monitor`). Each one documents install, usage, config surface, and security boundary.
- `contracts/README.md` got the deployed address + BaseScan link.
- `docs/DEPLOYMENT.md` drafted (topology diagram, boundary with Simon's infrastructure work, operator runbook pointers).

### 8. Production deploy (late evening, ~1.5 hours)

- Ops config drafted locally: `ops/caddy/Caddyfile`, systemd units for relay and resolver, env templates, install and update scripts, runbook `ops/README.md`. All committed before touching the server.
- SSH'd into the droplet together (Doug at keyboard, per the first-time-production-SSH guardrail).
- `install.sh` ran idempotently: Node 20 via NodeSource, pnpm via corepack, Caddy from Cloudsmith, `scut` service user, `/etc/scut/` root:scut 0750, `/var/lib/scut/` scut:scut, build all three packages, install systemd units, generate events token, install Caddyfile, reload Caddy.
- Caddy issued Let's Encrypt certs for both hostnames (issuer `E8`, expires 2026-07-21).
- Verified from outside: Alice resolves through `https://resolver.openscut.ai`, cert chain clean, relay `/capabilities` returns valid JSON.
- `outboundRelayOverride` dev hack removed from the demo orchestrator. Demo now has three modes: hermetic (fresh keys, in-process), `--on-chain` (real keys + in-process services reading mainnet), and `--on-chain --against-prod` (real keys + real public endpoints).

---

## Open items (not done, by priority)

1. **Rotate the production events token.** It leaked into the chat session while debugging the `--against-prod` demo. Rotation is one ssh command; fix is ready. The fix to `run-demo.ts` that makes it print `--token "$EVENTS_TOKEN"` as an env-var reference instead of embedding the literal is not yet committed — do that tomorrow morning before any more production monitor work.
2. **Visual acceptance of the `--against-prod` demo flow.** The infrastructure is verified (Alice resolves through the public resolver, signature verification works, SSE stream is serving), but we did not complete a clean run of `run-demo --on-chain --against-prod` with the monitor connected and reveals firing through production. Backlog for Friday's dress rehearsal.
3. **`pnpm run` + `tsx` + Ink stdio** — the monitor exits back to prompt when launched via `pnpm --filter scut-monitor run dev --`. Works fine when launched via `node dist/index.js` directly. Worth investigating for operator ergonomics but not blocking.
4. **Run-demo printed-command hygiene.** In any `against-prod`-adjacent mode, print the monitor command with `"$EVENTS_TOKEN"` as an env-var reference instead of expanding the literal. Takes about five minutes.
5. **`docs/DEPLOYMENT.md` is drafted from the deploying-agent's perspective.** Worth a second pass from Simon to confirm the boundary description matches his operational reality.

## Remaining on the v1 roadmap

Only one: **record the 60-90 second demo video** on Sunday morning, single take on the Sony ZV-E10. Everything the demo relies on is live.

Saturday is `/ultrareview` + security review + dress rehearsal against the live infrastructure. Friday is polish and the Phase 4 pull-ahead decision (if any).

## Notable decisions and the reasoning behind each

- **SII pivot, afternoon, with Guppi.** Not a technical constraint — OpenPub's contract would have worked as a single identity source. But it would have made SCUT implicitly dependent on OpenPub's hub schema, and would have privileged one operator at the identity layer. SII makes SCUT permissionless at every layer, which is what the protocol claims.
- **Native Node + systemd + Caddy, not Docker.** Simon's existing infrastructure patterns favor native services. Docker is easier to debug in isolation but harder to correlate with Simon's backups and UFW state. Native was the lower-friction call with a trusted operator.
- **Five-agent reuse, not ten.** Alice appears in all five scenarios; Bob recurs between scenario 1 (professional meeting) and scenario 3 (playdate). Service agents appear once each. Communicates "agents have ongoing relationships" without burning ten separate identities.
- **Scenario 4 rewritten.** Doctor-appointment draft was rejected because medical scenarios invite the "should an agent even be doing this" debate. Replaced with HVAC service coordination, same cadence, same mundane-but-specifically-private texture.
- **`outboundRelayOverride` as a transitional affordance.** Introduced to keep the demo working during the cascade when the production relay didn't exist yet. Removed the same evening once production was up, keeping it in the type surface as documented dev-mode optional.

## What I got wrong during the session

- I repeatedly stamped mid-session work with "Day 2" / "Day 3" / "April 22" as if calendar boundaries had passed. Everything actually happened on April 21. Fixed in this log and in the surrounding documentation. Future sessions: trust the `currentDate` system reminder, not internal sense of elapsed time.
- I accidentally committed `demo-keys.json` and `demo-reveal-script.json` (per-run artifacts from Doug's local run) in one commit. The keys were ephemeral and never in use by any running relay, but committing generated private keys to a public repo is the wrong default. Removed in a follow-up commit, added to `.gitignore`, feedback memory saved so future sessions scan staged files before commit.
- I printed the production events token inline in the `run-demo` command output, which made it end up in Doug's terminal scrollback and subsequently in a paste to me. Leak is limited (SSE metadata only, no key material), but still sloppy. Rotation + emitted-command hygiene fix pending.

## Files to read next if you're reviewing

- [`spec/SPEC.md`](../spec/SPEC.md) — protocol v0.2.0. Most important: §4 SII, §5 envelope format, §6 wire protocol.
- [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) — topology, boundary with Simon, operator runbook pointers.
- [`ops/README.md`](../ops/README.md) — install / update / rollback commands.
- [`packages/core/README.md`](../packages/core/README.md) — library API surface.
- [`packages/cli/README.md`](../packages/cli/README.md) — CLI reference.
- [`contracts/README.md`](../contracts/README.md) — Solidity and deployment.
- [`CLAUDE.md`](../CLAUDE.md) — builder agent context (unchanged during session).
