import { hkdfSync } from 'node:crypto';
import { getSodium } from './sodium.js';
import {
  HKDF_INFO,
  MAX_CIPHERTEXT_BYTES,
  ScutCryptoError,
  XCHACHA20_NONCE_BYTES,
} from './types.js';

export interface EncryptResult {
  ciphertext: Uint8Array;
  ephemeralPublicKey: Uint8Array;
}

/**
 * ECIES-style encryption per SPEC §5.3.
 * Ephemeral X25519 → ECDH → HKDF-SHA256(salt=envelopeId) → XChaCha20-Poly1305.
 */
export async function encryptBody(
  plaintext: Uint8Array,
  recipientPublicKey: Uint8Array,
  envelopeId: Uint8Array,
): Promise<EncryptResult> {
  const s = await getSodium();

  if (plaintext.length > MAX_CIPHERTEXT_BYTES - s.crypto_aead_xchacha20poly1305_ietf_ABYTES) {
    throw new ScutCryptoError(
      `plaintext exceeds max size (${plaintext.length} bytes)`,
      'payload_too_large',
    );
  }

  const ephemeral = s.crypto_box_keypair();
  try {
    const shared = s.crypto_scalarmult(ephemeral.privateKey, recipientPublicKey);
    try {
      const key = hkdf(shared, envelopeId, HKDF_INFO);
      try {
        const nonce = envelopeId.slice(0, XCHACHA20_NONCE_BYTES);
        const ciphertext = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
          plaintext,
          null,
          null,
          nonce,
          key,
        );
        if (ciphertext.length > MAX_CIPHERTEXT_BYTES) {
          throw new ScutCryptoError(
            `ciphertext exceeds max size (${ciphertext.length} bytes)`,
            'payload_too_large',
          );
        }
        return { ciphertext, ephemeralPublicKey: ephemeral.publicKey };
      } finally {
        s.memzero(key);
      }
    } finally {
      s.memzero(shared);
    }
  } finally {
    s.memzero(ephemeral.privateKey);
  }
}

export async function decryptBody(
  ciphertext: Uint8Array,
  recipientPrivateKey: Uint8Array,
  senderEphemeralPublicKey: Uint8Array,
  envelopeId: Uint8Array,
): Promise<Uint8Array> {
  const s = await getSodium();

  const shared = s.crypto_scalarmult(recipientPrivateKey, senderEphemeralPublicKey);
  try {
    const key = hkdf(shared, envelopeId, HKDF_INFO);
    try {
      const nonce = envelopeId.slice(0, XCHACHA20_NONCE_BYTES);
      try {
        return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, null, nonce, key);
      } catch {
        throw new ScutCryptoError('ciphertext failed authentication', 'bad_ciphertext');
      }
    } finally {
      s.memzero(key);
    }
  } finally {
    s.memzero(shared);
  }
}

function hkdf(ikm: Uint8Array, salt: Uint8Array, info: string): Uint8Array {
  const out = hkdfSync('sha256', ikm, salt, info, 32);
  return new Uint8Array(out);
}
