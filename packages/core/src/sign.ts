import { getSodium } from './sodium.js';
import { canonicalizeToBytes } from './canonicalize.js';
import { ScutCryptoError, type Envelope } from './types.js';

type EnvelopeWithoutSignature = Omit<Envelope, 'signature'>;

export function canonicalBytesForSigning(envelope: Envelope | EnvelopeWithoutSignature): Uint8Array {
  const { signature: _omit, ...rest } = envelope as Envelope;
  return canonicalizeToBytes(rest);
}

export async function signEnvelope(
  envelopeWithoutSignature: EnvelopeWithoutSignature,
  signingPrivateKey: Uint8Array,
): Promise<Uint8Array> {
  const s = await getSodium();
  const bytes = canonicalBytesForSigning(envelopeWithoutSignature);
  return s.crypto_sign_detached(bytes, signingPrivateKey);
}

export async function verifyEnvelopeSignature(
  envelope: Envelope,
  signature: Uint8Array,
  signingPublicKey: Uint8Array,
): Promise<void> {
  const s = await getSodium();
  const bytes = canonicalBytesForSigning(envelope);
  let ok: boolean;
  try {
    ok = s.crypto_sign_verify_detached(signature, bytes, signingPublicKey);
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new ScutCryptoError('envelope signature is invalid', 'bad_signature');
  }
}
