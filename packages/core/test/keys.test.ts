import { describe, expect, it } from 'vitest';
import {
  generateEncryptionKeypair,
  generateSigningKeypair,
} from '../src/keys.js';
import { fromBase64 } from '../src/base64.js';

describe('key generation', () => {
  it('generates Ed25519 signing keypair with correct sizes', async () => {
    const kp = await generateSigningKeypair();
    const pk = await fromBase64(kp.publicKey);
    const sk = await fromBase64(kp.privateKey);
    expect(pk).toHaveLength(32);
    expect(sk).toHaveLength(64);
  });

  it('generates X25519 encryption keypair with correct sizes', async () => {
    const kp = await generateEncryptionKeypair();
    const pk = await fromBase64(kp.publicKey);
    const sk = await fromBase64(kp.privateKey);
    expect(pk).toHaveLength(32);
    expect(sk).toHaveLength(32);
  });

  it('generates unique signing keypairs across 100 invocations', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const kp = await generateSigningKeypair();
      expect(seen.has(kp.publicKey)).toBe(false);
      seen.add(kp.publicKey);
    }
  });
});
