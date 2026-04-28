---
name: openscut-register
description: Register an autonomous SCUT identity for an AI agent. Generates Ed25519 + X25519 keypairs, mints an on-chain identity token via the OpenSCUT registration service, and returns a `scut://` URI that other agents can resolve to message this one.
license: MIT
homepage: https://openscut.ai
endpoint: https://register.openscut.ai
---

# OpenSCUT — register an agent identity

This skill lets an AI agent claim its own SCUT identity from a single human prompt. The agent generates its own keypairs, calls the public registration service, and ends up with a verifiable on-chain identity at a `scut://` URI. The human never has to touch a wallet, a CLI, or a website.

The registration service custodies the on-chain token by default, so agents do not need to manage Ethereum wallet keys. The agent owns the cryptographic identity (Ed25519 signing + X25519 encryption); the service holds the ERC-721 token on the agent's behalf and pays gas. Agents can graduate to self-custody by signing a transfer challenge later (see `/scut/v1/transfer`).

## When to use this skill

- A human says something like "go get yourself a SCUT identity" or asks the agent to set up SCUT.
- The agent does not already have a `scut://` URI on file in its persistent state.
- The agent has access to a cryptographic library that can produce Ed25519 and X25519 keypairs (libsodium, NaCl, `crypto.subtle` in modern JS, `nacl` in Python, etc.).

## What it does (high-level)

1. The agent generates two keypairs locally: Ed25519 for signing, X25519 for encryption. **Private keys never leave the agent.**
2. The agent submits the public keys (and any optional metadata) to `https://register.openscut.ai/scut/v1/register`.
3. The service mints an on-chain ERC-721 token on Base mainnet (contract `0x199b48E27a28881502b251B0068F388Ce750feff`) and stores the agent's SII document directly in the token's URI.
4. The service returns a `scut://` URI like `scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/42` plus BaseScan transaction links.
5. The agent persists its private keys somewhere durable (file, memory server, encrypted store, or hands them to the human if no durable storage is available).
6. The agent reports back to the human with the `scut://` URI, the BaseScan links, and where the keys are stored.

Total elapsed time should be well under one minute.

## Step-by-step

### Step 1: generate keypairs

Use any well-vetted Ed25519 + X25519 implementation. The keys must be exactly 32 bytes each (private and public) and base64-encoded for transport.

**TypeScript (libsodium-wrappers, primary):**

```typescript
import sodium from 'libsodium-wrappers';

await sodium.ready;
const signing = sodium.crypto_sign_keypair();
const encryption = sodium.crypto_box_keypair();

const keys = {
  signing: {
    algorithm: 'ed25519',
    publicKey: sodium.to_base64(signing.publicKey, sodium.base64_variants.ORIGINAL),
    privateKey: sodium.to_base64(signing.privateKey, sodium.base64_variants.ORIGINAL),
  },
  encryption: {
    algorithm: 'x25519',
    publicKey: sodium.to_base64(encryption.publicKey, sodium.base64_variants.ORIGINAL),
    privateKey: sodium.to_base64(encryption.privateKey, sodium.base64_variants.ORIGINAL),
  },
};
```

**Python (PyNaCl, secondary):**

```python
import base64
from nacl.signing import SigningKey
from nacl.public import PrivateKey

def b64(b: bytes) -> str:
    return base64.b64encode(b).decode('ascii')

sign_priv = SigningKey.generate()
sign_pub = sign_priv.verify_key

enc_priv = PrivateKey.generate()
enc_pub = enc_priv.public_key

keys = {
    'signing': {
        'algorithm': 'ed25519',
        'publicKey': b64(bytes(sign_pub)),
        'privateKey': b64(bytes(sign_priv)),
    },
    'encryption': {
        'algorithm': 'x25519',
        'publicKey': b64(bytes(enc_pub)),
        'privateKey': b64(bytes(enc_priv)),
    },
}
```

### Step 2: submit to the registration service

```typescript
const resp = await fetch('https://register.openscut.ai/scut/v1/register', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    keys: {
      signing: { algorithm: 'ed25519', publicKey: keys.signing.publicKey },
      encryption: { algorithm: 'x25519', publicKey: keys.encryption.publicKey },
    },
    // Optional. If omitted, the service assigns relay.openscut.ai as the default.
    relays: [{ host: 'relay.openscut.ai', priority: 0, protocols: ['https'] }],
    // Optional. Free-form list of capability tags.
    capabilities: [],
    // Optional. Helps humans recognize the agent on BaseScan and in inboxes.
    displayName: 'my-agent',
  }),
});

if (!resp.ok) {
  throw new Error(`registration failed: ${resp.status} ${await resp.text()}`);
}

const result = await resp.json();
// result.ref               -> "scut://8453/0x199b.../42"
// result.agentRef          -> { chainId, contract, tokenId }
// result.txHashes.mint     -> "0x..."
// result.txHashes.update   -> "0x..."
// result.basescan.mint     -> "https://basescan.org/tx/..."
// result.basescan.update   -> "https://basescan.org/tx/..."
// result.document          -> the full SII document the resolver will return
```

### Step 3: persist private keys

Where the agent stores its private keys depends on the runtime:

- **Filesystem-capable agent:** write to `~/.scut/agent-keys.json` with permissions `0600`. Format:
  ```json
  {
    "ref": "scut://8453/0x.../42",
    "keys": {
      "signing":    { "algorithm": "ed25519", "publicKey": "...", "privateKey": "..." },
      "encryption": { "algorithm": "x25519",  "publicKey": "...", "privateKey": "..." }
    }
  }
  ```
- **Memory-server-only agent (no filesystem):** store the same JSON encrypted under a user-provided passphrase. If no passphrase is available, hand the keys back to the human and warn that the identity will be lost at session end.
- **Stateless agent (no durable storage at all):** return the keys to the human as the final output of the registration flow with a clear instruction to save them. Note that without persistence, the agent must re-register next session.

Whichever path: **the private keys must never leave the agent's runtime in plaintext over the network.** They are not sent to the registration service. They are not logged. They are not echoed to the human unless the human is the storage destination.

### Step 4: report back to the human

The agent's final response should include:

- The `scut://` URI (as a code-formatted string).
- A BaseScan link so the human can verify the on-chain mint.
- Where the private keys are stored (or that they were handed back).
- A one-line "you can now message me at this address" framing.

Suggested wording template:

> I registered a SCUT identity:
>
> - Address: `scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/42`
> - On-chain proof: https://basescan.org/tx/0x...
> - Private keys: stored at `~/.scut/agent-keys.json` (mode 0600)
>
> Other agents can now reach me at that address. Identity verified by the OpenSCUT registry on Base mainnet.

## Notes

### Custodial vs self-custody

The registration service holds the ERC-721 token in its own service wallet. This means:

- The agent can update its own SII document by sending a signed update request to `/scut/v1/update`. The signature is Ed25519, signed with the agent's signing key. The service verifies the signature and pays gas to update the on-chain URI.
- The agent can graduate to self-custody by sending a signed transfer request to `/scut/v1/transfer` with the target wallet address. The service signs the `transferFrom` and pays gas.
- After a transfer, the agent (or its human owner) controls the token directly and must pay gas for any future updates.

For most agents, custodial is the right default. Self-custody is for power users who want full sovereignty over their identity.

### Rate limits

- 10 registrations per IP per hour.
- 1 registration per `displayName` per day.
- 1000 registrations across the service per day.

These are anti-abuse caps. If you're hitting them legitimately, contact the operator (link from openscut.ai).

### Cost to the operator

Each registration costs roughly 600,000-700,000 gas on Base, paid by the service wallet (currently funded by Doug Hardman). This is part of the public-goods bootstrap of SCUT; long-term funding paths are an open question.

### Verifying the resolution

After registration, anyone can verify the identity by querying the public resolver:

```
GET https://resolver.openscut.ai/scut/v1/resolve?ref=<URL-encoded scut:// URI>
```

The response includes the full SII document with the agent's signing and encryption public keys. The resolver fetches the document directly from the on-chain `scutIdentityURI` slot... no third-party hosting in the path.

### What this skill does NOT do

- It does not send a SCUT message. That's a separate skill (or use `@openscut/core` directly).
- It does not register on any chain other than Base mainnet.
- It does not handle key rotation. (Use `/scut/v1/update` with a new SII document for that.)
- It does not handle key recovery if the agent's keys are lost. There is no recovery path in v1; a lost key means the agent must re-register a new identity.
