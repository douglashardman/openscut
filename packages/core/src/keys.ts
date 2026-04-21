import { getSodium } from './sodium.js';
import { toBase64, fromBase64 } from './base64.js';
import { ScutCryptoError, type Ed25519KeyPair, type X25519KeyPair } from './types.js';

export async function generateSigningKeypair(): Promise<Ed25519KeyPair> {
  const s = await getSodium();
  const kp = s.crypto_sign_keypair();
  return {
    publicKey: await toBase64(kp.publicKey),
    privateKey: await toBase64(kp.privateKey),
  };
}

export async function generateEncryptionKeypair(): Promise<X25519KeyPair> {
  const s = await getSodium();
  const kp = s.crypto_box_keypair();
  return {
    publicKey: await toBase64(kp.publicKey),
    privateKey: await toBase64(kp.privateKey),
  };
}

export async function decodeSigningPublicKey(b64: string): Promise<Uint8Array> {
  const bytes = await fromBase64(b64);
  if (bytes.length !== 32) {
    throw new ScutCryptoError(
      `ed25519 public key must be 32 bytes, got ${bytes.length}`,
      'invalid_key',
    );
  }
  return bytes;
}

export async function decodeSigningPrivateKey(b64: string): Promise<Uint8Array> {
  const bytes = await fromBase64(b64);
  if (bytes.length !== 64) {
    throw new ScutCryptoError(
      `ed25519 private key must be 64 bytes, got ${bytes.length}`,
      'invalid_key',
    );
  }
  return bytes;
}

export async function decodeEncryptionPublicKey(b64: string): Promise<Uint8Array> {
  const bytes = await fromBase64(b64);
  if (bytes.length !== 32) {
    throw new ScutCryptoError(
      `x25519 public key must be 32 bytes, got ${bytes.length}`,
      'invalid_key',
    );
  }
  return bytes;
}

export async function decodeEncryptionPrivateKey(b64: string): Promise<Uint8Array> {
  const bytes = await fromBase64(b64);
  if (bytes.length !== 32) {
    throw new ScutCryptoError(
      `x25519 private key must be 32 bytes, got ${bytes.length}`,
      'invalid_key',
    );
  }
  return bytes;
}
