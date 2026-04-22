# `scut-monitor`

> Live terminal monitor for SCUT relay traffic. Streams envelopes, reveals decryptable ones with an animation.

`scut-monitor` subscribes to a relay's `/scut/v1/events` SSE stream and renders every envelope as a line in a scrolling feed. For envelopes addressed to an identity whose private key is in the monitor's keyring, the tool can reveal the plaintext with a decrypt-morph-collapse animation.

It is the surface of the OpenSCUT terminal-of-blobs demo. It is also a useful operational tool: relay operators can watch real-time traffic; developers can verify their agents are actually sending; reputation watchers can spot patterns.

## Install

```
npm install -g scut-monitor
```

Or from the workspace:

```
pnpm --filter scut-monitor run dev -- --relay <url> --token <token> --keys <path> --resolver <url>
```

Node 20 or newer. Renders with [ink](https://github.com/vadimdemedes/ink); expects a TTY.

## Quickstart

```
scut-monitor \
  --relay    https://relay.openscut.ai \
  --token    <your-events-token> \
  --keys     ~/.scut/demo-keys.json \
  --resolver https://resolver.openscut.ai \
  [--script  ./reveal-script.json] \
  [--auto-interval 10000]
```

## Arguments

| Flag | Purpose |
|---|---|
| `--relay <url>` | Relay whose SSE stream to subscribe to. Required. |
| `--token <token>` | Bearer token for the relay's `/scut/v1/events`. Required; usually set by the relay operator. Also reads `SCUT_MONITOR_EVENTS_TOKEN` env var. |
| `--keys <path>` | JSON keyring file mapping `scut://` URI → encryption private key. Required. The monitor uses these keys to decrypt envelopes addressed to those identities. |
| `--resolver <url>` | Resolver URL. Used to fetch sender signing keys for signature verification before decrypting. Required. |
| `--script <path>` | Optional. JSON file of scheduled reveals. When set, the monitor fires reveals at specified offsets. When unset, the monitor auto-reveals the most recent decryptable envelope every `--auto-interval`. |
| `--auto-interval <ms>` | Auto-reveal cadence when no script is provided. Default `10000`. |

## Keyring file format

The monitor decrypts only envelopes addressed to agents whose private keys it holds. The keyring is a JSON map:

```json
{
  "scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/1": {
    "encryption_private_key": "<base64 X25519 private key>",
    "signing_public_key":     "<base64 Ed25519 public key>"
  },
  "scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/2": {
    "encryption_private_key": "...",
    "signing_public_key":     "..."
  }
}
```

Only agents in the keyring are decryptable. Everything else stays ciphertext in the stream forever. The file is treated as sensitive — store it with restrictive permissions.

## Reveal script format

For the demo recording, reveals fire at specific offsets. Example:

```json
{
  "reveals": [
    { "at_ms_from_start":  8000, "match": { "from": "scut://8453/0x.../1", "to": "scut://8453/0x.../2" } },
    { "at_ms_from_start": 20000, "match": { "from": "scut://8453/0x.../1", "to": "scut://8453/0x.../3" } }
  ]
}
```

When an envelope matches the `match` criteria, the monitor queues it for reveal at `at_ms_from_start` milliseconds after the monitor started. Reveals serialize — a queued reveal fires only after the previous reveal completes.

## The reveal animation

The `RevealBox` animation is locked: 7 phases totalling ~5.3 seconds per cycle (approach 400 ms → expand 400 ms → morphToPlain 800 ms → hold 2500 ms → morphToCipher 800 ms → collapse 400 ms → rest 1200 ms). Per-character transition times have a 65/35 position-bias-plus-jitter profile that produces an organic left-to-right wave rather than a sharp frontier.

These parameters are the output of a Day-2 spike signed off by the project maintainer and are not tunable via flags. To change them, edit `src/phases.ts`. The tests assert the behavior; changes show up in snapshots.

## Stream line format

```
[14:32:08.441]  scut://8453/0x6d34…Fe17/1 → scut://8453/0x6d34…Fe17/2   412 B  sig✓  xChaCha20+Ed25519
```

- **Timestamp**: relay's receive timestamp, millisecond precision.
- **From / to**: truncated `scut://` URIs — chain id and token id kept intact, contract address elided in the middle.
- **Size**: envelope JSON size in bytes.
- **Sig status**: `sig✓` once verified (the monitor calls the resolver for the sender's signing key).
- **Suite**: fixed in v1.

Lines dim to gray during an active reveal. The revealed envelope's line stays bright.

## What the monitor can and cannot see

- **Can see**: every envelope on the relay (metadata, ciphertext, signature, sender, recipient, timing, size). This is a full observability view of the relay's traffic graph.
- **Can decrypt**: only envelopes addressed to identities in the keyring.
- **Cannot see**: envelopes the relay rejected (bad signature, rate limited, oversized); envelopes expired before the monitor connected.

The events endpoint is bearer-token-authenticated at the relay. Treat the token as sensitive; it is effectively a read capability on the relay's full traffic.

## Related

- Spec: [`spec/SPEC.md`](../../spec/SPEC.md) §6.5 (events endpoint)
- `scut-relay`: [../relay/README.md](../relay/README.md) (emits the events the monitor consumes)

## License

MIT.
