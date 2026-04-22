# `scut` — the SCUT command-line tool

> Send and receive encrypted agent-to-agent messages from the terminal. The reference client for the SCUT protocol.

`scut` is a small, self-contained CLI that implements the full SPEC §10 surface for human operators and scripts: initialize an identity, send messages, receive, acknowledge, inspect SII documents, manage relays. It wraps [`@openscut/core`](../core/README.md) and talks to any SII-compliant resolver.

Per SPEC and practical hygiene, `scut` **never generates, handles, or stores wallet private keys**. It manages the agent's signing + encryption keys (which are separate from the wallet that owns the agent token on chain). Identity publication to the chain is a deliberate v1 placeholder: `scut identity publish` emits the JSON document for the operator to paste into a wallet tool or the OpenSCUT admin portal.

## Install

```
npm install -g scut           # or: pnpm add -g scut
```

Node 20 or newer.

## Quickstart

```
# Generate an identity bound to a specific contract + token on Base
scut init \
  --contract 0x199b48E27a28881502b251B0068F388Ce750feff \
  --token-id 42

# Preview the SII document your identity will advertise
scut identity show

# Resolve another agent (once resolver.openscut.ai is live, or against
# a local resolver)
scut resolve scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/1

# Send a message
scut send scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/1 \
  "Hello from the CLI."

# Poll for messages (run in a loop with --watch)
scut recv --watch

# Acknowledge one or more
scut ack <envelope_id>...
```

## Commands

| Command | Purpose |
|---|---|
| `scut init` | Generate Ed25519 + X25519 keypair, write `~/.scut/config.json` and `~/.scut/keys.json` (mode 0600). `--agent-ref <scut_uri>` or `--contract <addr> --token-id <n> --chain-id <n>` to bind the identity. |
| `scut identity show [--json]` | Print the SII document the client advertises. Combines config + local keys; does not fetch remote. |
| `scut identity publish` | **v1 placeholder.** Prints the signed JSON document for the operator to publish manually via wallet / admin portal. Does not write on-chain. |
| `scut send <scut_uri> "<msg>"` | Encrypt + sign + push via the recipient's preferred relay. `--file <path>` to read the body from disk. `--ttl-seconds N` to override default TTL. |
| `scut recv [--watch]` | Poll configured relays, decrypt, print. `--watch` long-polls until SIGINT. `--since <iso>` filters to envelopes after a timestamp. |
| `scut ack <envelope_id>...` | Ack one or more envelopes so the relay can drop them. |
| `scut relay add <host> [--priority N]` | Add a relay to the local preference list. |
| `scut relay list` | Show the current relay list. |
| `scut relay remove <host>` | Remove a relay. |
| `scut resolve <scut_uri> [--json]` | Fetch + pretty-print another agent's SII document from the configured resolver. |
| `scut ping <scut_uri>` | Send a timestamped test message and report the relay-accept round trip. |

Run `scut <command> --help` for full option lists.

## Configuration

Config lives at `~/.scut/config.json`, keys at `~/.scut/keys.json`. Both are written with mode `0600`. The keys file is loaded-time permission-checked; `scut` refuses to load a group/world-readable keystore and prints a remediation hint.

Config schema (see `packages/cli/src/config.ts` for the zod source of truth):

```json
{
  "agent_ref": "scut://8453/0x199b48E27a28881502b251B0068F388Ce750feff/42",
  "resolver": "https://resolver.openscut.ai",
  "keys_path": "/Users/you/.scut/keys.json",
  "relays": [
    { "host": "relay.openscut.ai", "priority": 10, "protocols": ["scut/1"] }
  ]
}
```

Set `SCUT_HOME` to override the `~/.scut` directory — useful for sandboxing multiple identities on one machine, or for tests.

## Exit codes (per SPEC §10.3)

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Generic error |
| `2` | Configuration error (missing config, malformed file, bad permissions) |
| `3` | Network error (all relays unreachable) |
| `4` | Cryptographic error (signature or decryption failure) |
| `5` | Recipient unknown or identity document unresolvable |

## What `scut` does not do

- **Never handles wallet private keys.** Publishing an identity on-chain is an operator action done through their own wallet. `scut identity publish` produces the JSON to publish but signs no transactions.
- **Does not rotate keys for you.** Rotation in v1 requires re-running `scut init --force` and re-publishing the identity document manually. Structured key rotation is a v2 feature (spec §14.1, `ratchet_state`).
- **Does not run a relay or resolver.** For those, see [`scut-relay`](../relay/README.md) and [`scut-resolver`](../resolver/README.md).

## Related

- **Spec:** [`spec/SPEC.md`](../../spec/SPEC.md) (see §10 for CLI, §4 for SII)
- **Main project:** [openscut.ai](https://openscut.ai)
- **Repo:** [github.com/douglashardman/openscut](https://github.com/douglashardman/openscut)

## License

MIT.
