import { describe, expect, it } from 'vitest';
import {
  buildEnvelope,
  formatScutUri,
  generateEncryptionKeypair,
  generateSigningKeypair,
  type ResolverClient,
  type ScutUri,
  type SiiDocument,
} from '@openscut/core';
import { Keyring } from '../src/keyring.js';

const TEST_CONTRACT = '0x0000000000000000000000000000000000002222';
let nextTokenId = 1;

function fakeResolver(table: Record<string, SiiDocument>): ResolverClient {
  return {
    async resolve(ref) {
      const doc = table[ref];
      if (!doc) throw new Error(`unknown ${ref}`);
      return doc;
    },
  };
}

async function makeAgent(label: string): Promise<{
  ref: ScutUri;
  signing: { publicKey: string; privateKey: string };
  encryption: { publicKey: string; privateKey: string };
  doc: SiiDocument;
}> {
  const tokenId = String(nextTokenId++);
  const agentRef = { contract: TEST_CONTRACT, tokenId, chainId: 8453 };
  const ref = formatScutUri(agentRef);
  const signing = await generateSigningKeypair();
  const encryption = await generateEncryptionKeypair();
  const doc: SiiDocument = {
    siiVersion: 1,
    agentRef,
    keys: {
      signing: { algorithm: 'ed25519', publicKey: signing.publicKey },
      encryption: { algorithm: 'x25519', publicKey: encryption.publicKey },
    },
    relays: [{ host: 'relay.test', priority: 10, protocols: ['scut/1'] }],
    capabilities: ['scut/1'],
    displayName: label,
    updatedAt: new Date().toISOString(),
  };
  return { ref, signing, encryption, doc };
}

describe('Keyring', () => {
  it('reports which agents it holds keys for', async () => {
    const bob = await makeAgent('bob');
    const ring = Keyring.fromMap({
      [bob.ref]: { encryptionPrivateKey: bob.encryption.privateKey },
    });
    expect(ring.holdsKeyFor(bob.ref)).toBe(true);
    expect(ring.holdsKeyFor('scut://8453/0x0000000000000000000000000000000000009999/1')).toBe(false);
  });

  it('decrypts an envelope addressed to a held agent', async () => {
    const alice = await makeAgent('alice');
    const bob = await makeAgent('bob');
    const envelope = await buildEnvelope({
      from: alice.ref,
      to: bob.ref,
      body: 'hello Bob',
      senderSigningPrivateKey: alice.signing.privateKey,
      recipientEncryptionPublicKey: bob.encryption.publicKey,
    });
    const ring = Keyring.fromMap({
      [bob.ref]: { encryptionPrivateKey: bob.encryption.privateKey },
    });
    const plaintext = await ring.tryDecrypt(
      envelope,
      fakeResolver({ [alice.ref]: alice.doc }),
    );
    expect(plaintext).toBe('hello Bob');
  });

  it('returns null when the recipient key is not in the ring', async () => {
    const alice = await makeAgent('alice');
    const bob = await makeAgent('bob');
    const envelope = await buildEnvelope({
      from: alice.ref,
      to: bob.ref,
      body: 'hello Bob',
      senderSigningPrivateKey: alice.signing.privateKey,
      recipientEncryptionPublicKey: bob.encryption.publicKey,
    });
    const ring = Keyring.fromMap({});
    const plaintext = await ring.tryDecrypt(envelope, fakeResolver({ [alice.ref]: alice.doc }));
    expect(plaintext).toBeNull();
  });

  it('returns null when signature verification fails', async () => {
    const alice = await makeAgent('alice');
    const bob = await makeAgent('bob');
    const envelope = await buildEnvelope({
      from: alice.ref,
      to: bob.ref,
      body: 'hello Bob',
      senderSigningPrivateKey: alice.signing.privateKey,
      recipientEncryptionPublicKey: bob.encryption.publicKey,
    });
    const impostor = await makeAgent('impostor');
    const badDoc: SiiDocument = { ...alice.doc, keys: impostor.doc.keys };
    const ring = Keyring.fromMap({
      [bob.ref]: { encryptionPrivateKey: bob.encryption.privateKey },
    });
    const plaintext = await ring.tryDecrypt(envelope, fakeResolver({ [alice.ref]: badDoc }));
    expect(plaintext).toBeNull();
  });
});
