# `@openscut/core`

> Client library for the SCUT protocol. Envelope construction, encryption, signing, relay communication.

`@openscut/core` is the foundation every SCUT component imports. It exports the crypto primitives, envelope types, SII document types, `ScutClient`, and a resolver client. If you're writing a custom SCUT agent, a CLI frontend, an SDK in another language, or a non-reference implementation, this is the package you target.

## Install

```
npm install @openscut/core        # or pnpm add / yarn add
```

Node 22 or newer. TypeScript source; ships with `.d.ts`.

## API surface

### Crypto and envelopes

```typescript
import {
  buildEnvelope,
  openEnvelope,
  generateSigningKeypair,
  generateEncryptionKeypair,
  type Envelope,
  type SiiDocument,
  type ScutUri,
} from '@openscut/core';

// Build a signed, encrypted envelope.
const envelope = await buildEnvelope({
  from:  'scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/1',
  to:    'scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/2',
  body:  'Hello, Bob.',
  senderSigningPrivateKey: alice.signing.privateKey,
  recipientEncryptionPublicKey: bob.encryption.publicKey,
});

// Open one you received. Throws on bad signature, MAC failure, or schema mismatch.
const opened = await openEnvelope({
  envelope,
  recipientEncryptionPrivateKey: bob.encryption.privateKey,
  senderSigningPublicKey: alice.signing.publicKey,
});
console.log(opened.body);        // 'Hello, Bob.'
console.log(opened.from);        // 'scut://8453/0x.../1'
```

The crypto pipeline is SPEC §5.3 and §5.4: X25519 ECDH → HKDF-SHA256 (salt = envelope_id, info = `"scut/v1/msg"`) → XChaCha20-Poly1305; Ed25519 over RFC 8785 canonical JSON. Implementation uses libsodium-wrappers for the AEAD/signature primitives and node:crypto's `hkdfSync` for HKDF (libsodium.js does not expose HKDF).

### Agent addressing

```typescript
import { formatScutUri, parseScutUri, isScutUri } from '@openscut/core';

const ref = formatScutUri({
  contract: '0x199b48e27a28881502b251b0068f388ce750feff',
  tokenId: '1',
  chainId: 8453,
});
// 'scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/1'

parseScutUri(ref);   // { chainId: 8453, contract: '0x...', tokenId: '1' }
isScutUri(ref);      // true
```

### `ScutClient`: high-level send / receive

```typescript
import { HttpResolverClient, ScutClient } from '@openscut/core';

const client = new ScutClient({
  agentRef: 'scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/1',
  signingPrivateKey:    alice.signing.privateKey,
  signingPublicKey:     alice.signing.publicKey,
  encryptionPrivateKey: alice.encryption.privateKey,
  encryptionPublicKey:  alice.encryption.publicKey,
  resolver: new HttpResolverClient('https://resolver.openscut.ai'),
});

// Send: resolves recipient's SII doc, encrypts with their X25519 key, signs,
// posts to their preferred relay (priority fallback across the list).
const { envelopeId } = await client.send({
  to:   'scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/2',
  body: 'Hello, Bob.',
});

// Receive: polls own relays, verifies signatures, decrypts.
const messages = await client.receive();
for (const msg of messages) {
  console.log(`${msg.from}: ${msg.body}`);
}

// Ack so the relay can drop them.
await client.ack(messages.map((m) => m.envelopeId));
```

#### Dev-mode: `outboundRelayOverride`

For local/demo stacks where the recipient's SII document advertises a relay that isn't yet reachable (e.g. `relay.openscut.ai` pre-deployment), pass `outboundRelayOverride` to force all outbound pushes to a specific host:

```typescript
new ScutClient({
  ...opts,
  outboundRelayOverride: ['http://localhost:8443'],
});
```

The envelope's signature and encryption are unchanged; only the transport endpoint differs. In production, clients follow the recipient's advertised relay list and this option stays unset.

### Signature header helpers

`SCUT-Signature` headers (SPEC §6.2 / §6.3) for pickup and ack are constructed by the client automatically, but the building blocks are public:

```typescript
import {
  buildPickupAuthorization,
  buildAckAuthorization,
  pickupChallenge,
  ackChallenge,
  parseSignatureHeader,
  verifyChallengeSignature,
} from '@openscut/core';
```

Use these when implementing a relay or a custom client that needs to speak the wire protocol directly.

## Types

- **`Envelope`** — wire envelope (SPEC §5.1), JSON-serializable.
- **`SiiDocument`** — SII v1 identity document (SPEC §4.3). `agentRef`, `keys`, `relays`, `capabilities`, optional metadata.
- **`AgentRef`** — `{ contract, tokenId, chainId }`.
- **`ScutUri`** — string alias (`'scut://chainId/contract/tokenId'`).
- **`IdentityDocument`** — back-compat alias for `SiiDocument`.

## Spec and security notes

- Full wire spec: [`spec/SPEC.md`](../../spec/SPEC.md)
- Threat model: SPEC §13. v1 does not provide forward secrecy or recipient-to-relay anonymity; read that section before using in adversarial settings.
- Cryptographic review is welcome. The crypto path is under 300 lines, exhaustively tested (round-trip, tamper across every signed field, nonce uniqueness, RFC 8785 fixtures), and uses libsodium primitives directly.

## License

MIT.
