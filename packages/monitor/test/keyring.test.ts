import { describe, expect, it } from 'vitest';
import {
  buildEnvelope,
  generateEncryptionKeypair,
  generateSigningKeypair,
  type IdentityDocument,
  type ResolverClient,
} from '@openscut/core';
import { Keyring } from '../src/keyring.js';

function fakeResolver(table: Record<string, IdentityDocument>): ResolverClient {
  return {
    async resolve(agentId) {
      const doc = table[agentId];
      if (!doc) throw new Error(`unknown ${agentId}`);
      return doc;
    },
  };
}

async function makeAgent(id: string): Promise<{
  id: string;
  signing: { publicKey: string; privateKey: string };
  encryption: { publicKey: string; privateKey: string };
  doc: IdentityDocument;
}> {
  const signing = await generateSigningKeypair();
  const encryption = await generateEncryptionKeypair();
  const doc: IdentityDocument = {
    protocol_version: 1,
    agent_id: id,
    keys: {
      signing: { algorithm: 'ed25519', public_key: signing.publicKey },
      encryption: { algorithm: 'x25519', public_key: encryption.publicKey },
    },
    relays: [{ host: 'relay.test', priority: 10, protocols: ['scut/1'] }],
    capabilities: ['scut/1'],
    updated_at: new Date().toISOString(),
    v2_reserved: {
      ratchet_supported: false,
      onion_supported: false,
      group_supported: false,
    },
  };
  return { id, signing, encryption, doc };
}

describe('Keyring', () => {
  it('reports which agents it holds keys for', async () => {
    const bob = await makeAgent('0xBob');
    const ring = Keyring.fromMap({
      [bob.id]: { encryptionPrivateKey: bob.encryption.privateKey },
    });
    expect(ring.holdsKeyFor(bob.id)).toBe(true);
    expect(ring.holdsKeyFor('0xMallory')).toBe(false);
  });

  it('decrypts an envelope addressed to a held agent', async () => {
    const alice = await makeAgent('0xAlice');
    const bob = await makeAgent('0xBob');
    const envelope = await buildEnvelope({
      from: alice.id,
      to: bob.id,
      body: 'hello Bob',
      senderSigningPrivateKey: alice.signing.privateKey,
      recipientEncryptionPublicKey: bob.encryption.publicKey,
    });
    const ring = Keyring.fromMap({
      [bob.id]: { encryptionPrivateKey: bob.encryption.privateKey },
    });
    const plaintext = await ring.tryDecrypt(
      envelope,
      fakeResolver({ [alice.id]: alice.doc }),
    );
    expect(plaintext).toBe('hello Bob');
  });

  it('returns null when the recipient key is not in the ring', async () => {
    const alice = await makeAgent('0xAlice');
    const bob = await makeAgent('0xBob');
    const envelope = await buildEnvelope({
      from: alice.id,
      to: bob.id,
      body: 'hello Bob',
      senderSigningPrivateKey: alice.signing.privateKey,
      recipientEncryptionPublicKey: bob.encryption.publicKey,
    });
    const ring = Keyring.fromMap({});
    const plaintext = await ring.tryDecrypt(envelope, fakeResolver({ [alice.id]: alice.doc }));
    expect(plaintext).toBeNull();
  });

  it('returns null when signature verification fails', async () => {
    const alice = await makeAgent('0xAlice');
    const bob = await makeAgent('0xBob');
    const envelope = await buildEnvelope({
      from: alice.id,
      to: bob.id,
      body: 'hello Bob',
      senderSigningPrivateKey: alice.signing.privateKey,
      recipientEncryptionPublicKey: bob.encryption.publicKey,
    });
    const impostor = await makeAgent('0xImpostor');
    const badDoc: IdentityDocument = { ...alice.doc, keys: impostor.doc.keys };
    const ring = Keyring.fromMap({
      [bob.id]: { encryptionPrivateKey: bob.encryption.privateKey },
    });
    const plaintext = await ring.tryDecrypt(envelope, fakeResolver({ [alice.id]: badDoc }));
    expect(plaintext).toBeNull();
  });
});
