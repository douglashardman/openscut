import { describe, expect, it } from 'vitest';
import {
  buildEnvelope,
  generateEncryptionKeypair,
  generateSigningKeypair,
  openEnvelope,
  ScutCryptoError,
  type Envelope,
} from '../src/index.js';

interface Alice {
  id: string;
  signing: { publicKey: string; privateKey: string };
  encryption: { publicKey: string; privateKey: string };
}

async function makeAgent(id: string): Promise<Alice> {
  const signing = await generateSigningKeypair();
  const encryption = await generateEncryptionKeypair();
  return { id, signing, encryption };
}

async function buildAliceToBob(body: string): Promise<{
  envelope: Envelope;
  alice: Alice;
  bob: Alice;
}> {
  const alice = await makeAgent('0xAlice');
  const bob = await makeAgent('0xBob');
  const envelope = await buildEnvelope({
    from: alice.id,
    to: bob.id,
    body,
    senderSigningPrivateKey: alice.signing.privateKey,
    recipientEncryptionPublicKey: bob.encryption.publicKey,
  });
  return { envelope, alice, bob };
}

describe('envelope round-trip', () => {
  it('encrypts and decrypts ASCII text', async () => {
    const { envelope, alice, bob } = await buildAliceToBob('Hello, Bob.');
    const opened = await openEnvelope({
      envelope,
      recipientEncryptionPrivateKey: bob.encryption.privateKey,
      senderSigningPublicKey: alice.signing.publicKey,
    });
    expect(opened.body).toBe('Hello, Bob.');
    expect(opened.from).toBe(alice.id);
    expect(opened.to).toBe(bob.id);
    expect(opened.envelopeId).toBe(envelope.envelope_id);
  });

  it('encrypts and decrypts multibyte UTF-8 text', async () => {
    const body = 'héllo, Bôb — 你好 👋 🦾';
    const { envelope, alice, bob } = await buildAliceToBob(body);
    const opened = await openEnvelope({
      envelope,
      recipientEncryptionPrivateKey: bob.encryption.privateKey,
      senderSigningPublicKey: alice.signing.publicKey,
    });
    expect(opened.body).toBe(body);
  });

  it('survives JSON round-trip (cross-implementation stability)', async () => {
    const { envelope, alice, bob } = await buildAliceToBob('JSON round-trip test');
    const serialized = JSON.stringify(envelope);
    const reparsed = JSON.parse(serialized) as Envelope;
    const opened = await openEnvelope({
      envelope: reparsed,
      recipientEncryptionPrivateKey: bob.encryption.privateKey,
      senderSigningPublicKey: alice.signing.publicKey,
    });
    expect(opened.body).toBe('JSON round-trip test');
  });

  it('sets v2_reserved fields to their v1 null/empty values', async () => {
    const { envelope } = await buildAliceToBob('v2 reservation test');
    expect(envelope.v2_reserved).toEqual({
      ratchet_state: null,
      relay_path: null,
      recipient_hint: null,
      attachments: [],
      recipient_set: null,
    });
  });

  it('populates protocol_version = 1', async () => {
    const { envelope } = await buildAliceToBob('version');
    expect(envelope.protocol_version).toBe(1);
  });
});

describe('envelope tamper detection', () => {
  it('rejects wrong recipient key (MAC fails)', async () => {
    const { envelope, alice } = await buildAliceToBob('secret');
    const mallory = await generateEncryptionKeypair();
    await expect(
      openEnvelope({
        envelope,
        recipientEncryptionPrivateKey: mallory.privateKey,
        senderSigningPublicKey: alice.signing.publicKey,
      }),
    ).rejects.toMatchObject({
      code: 'bad_ciphertext',
    });
  });

  it('rejects tampered ciphertext', async () => {
    const { envelope, alice, bob } = await buildAliceToBob('secret');
    const tampered: Envelope = {
      ...envelope,
      ciphertext: flipFirstBase64Byte(envelope.ciphertext),
    };
    await expect(
      openEnvelope({
        envelope: tampered,
        recipientEncryptionPrivateKey: bob.encryption.privateKey,
        senderSigningPublicKey: alice.signing.publicKey,
      }),
    ).rejects.toBeInstanceOf(ScutCryptoError);
  });

  it('rejects tampered sender field (signature fails before decrypt)', async () => {
    const { envelope, alice, bob } = await buildAliceToBob('secret');
    const tampered: Envelope = { ...envelope, from: '0xAttacker' };
    await expect(
      openEnvelope({
        envelope: tampered,
        recipientEncryptionPrivateKey: bob.encryption.privateKey,
        senderSigningPublicKey: alice.signing.publicKey,
      }),
    ).rejects.toMatchObject({ code: 'bad_signature' });
  });

  it('rejects tampered envelope_id (changes salt and nonce, signature fails)', async () => {
    const { envelope, alice, bob } = await buildAliceToBob('secret');
    const tampered: Envelope = {
      ...envelope,
      envelope_id: flipFirstBase64Byte(envelope.envelope_id),
    };
    await expect(
      openEnvelope({
        envelope: tampered,
        recipientEncryptionPrivateKey: bob.encryption.privateKey,
        senderSigningPublicKey: alice.signing.publicKey,
      }),
    ).rejects.toMatchObject({ code: 'bad_signature' });
  });

  it('rejects envelope signed by the wrong signing key', async () => {
    const { envelope, bob } = await buildAliceToBob('secret');
    const impostor = await generateSigningKeypair();
    await expect(
      openEnvelope({
        envelope,
        recipientEncryptionPrivateKey: bob.encryption.privateKey,
        senderSigningPublicKey: impostor.publicKey,
      }),
    ).rejects.toMatchObject({ code: 'bad_signature' });
  });

  it('rejects missing required fields', async () => {
    const { envelope, alice, bob } = await buildAliceToBob('secret');
    const broken = { ...envelope, signature: '' } as Envelope;
    await expect(
      openEnvelope({
        envelope: broken,
        recipientEncryptionPrivateKey: bob.encryption.privateKey,
        senderSigningPublicKey: alice.signing.publicKey,
      }),
    ).rejects.toMatchObject({ code: 'bad_envelope_schema' });
  });
});

describe('nonce and ephemeral-key uniqueness', () => {
  it('produces unique envelope_id and ephemeral_pubkey across 1000 envelopes', async () => {
    const alice = await makeAgent('0xAlice');
    const bob = await makeAgent('0xBob');
    const ids = new Set<string>();
    const ephs = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const env = await buildEnvelope({
        from: alice.id,
        to: bob.id,
        body: `msg ${i}`,
        senderSigningPrivateKey: alice.signing.privateKey,
        recipientEncryptionPublicKey: bob.encryption.publicKey,
      });
      expect(ids.has(env.envelope_id)).toBe(false);
      expect(ephs.has(env.ephemeral_pubkey)).toBe(false);
      ids.add(env.envelope_id);
      ephs.add(env.ephemeral_pubkey);
    }
  });
});

describe('payload size limits', () => {
  it('accepts payloads near the 64 KiB ciphertext ceiling', async () => {
    const alice = await makeAgent('0xAlice');
    const bob = await makeAgent('0xBob');
    const body = 'a'.repeat(60 * 1024);
    const env = await buildEnvelope({
      from: alice.id,
      to: bob.id,
      body,
      senderSigningPrivateKey: alice.signing.privateKey,
      recipientEncryptionPublicKey: bob.encryption.publicKey,
    });
    const opened = await openEnvelope({
      envelope: env,
      recipientEncryptionPrivateKey: bob.encryption.privateKey,
      senderSigningPublicKey: alice.signing.publicKey,
    });
    expect(opened.body.length).toBe(body.length);
  });

  it('rejects payloads that exceed the ciphertext max', async () => {
    const alice = await makeAgent('0xAlice');
    const bob = await makeAgent('0xBob');
    const body = 'a'.repeat(65 * 1024);
    await expect(
      buildEnvelope({
        from: alice.id,
        to: bob.id,
        body,
        senderSigningPrivateKey: alice.signing.privateKey,
        recipientEncryptionPublicKey: bob.encryption.publicKey,
      }),
    ).rejects.toMatchObject({ code: 'payload_too_large' });
  });
});

function flipFirstBase64Byte(b64: string): string {
  const buf = Buffer.from(b64, 'base64');
  buf[0] = buf[0]! ^ 0x01;
  return buf.toString('base64');
}
