import {
  ackChallenge as coreAckChallenge,
  parseSignatureHeader as coreParse,
  pickupChallenge as corePickupChallenge,
  verifyChallengeSignature as coreVerify,
  type SignatureHeaderFields,
} from '@openscut/core';

export type SignatureHeader = SignatureHeaderFields;

export class SignatureHeaderError extends Error {
  constructor(
    message: string,
    public readonly reason:
      | 'missing'
      | 'malformed'
      | 'stale'
      | 'future'
      | 'replayed'
      | 'bad_signature',
  ) {
    super(message);
    this.name = 'SignatureHeaderError';
  }
}

export function parseSignatureHeader(headerValue: string | undefined): SignatureHeader {
  try {
    return coreParse(headerValue);
  } catch (err) {
    if ((err as Error).message.includes('missing Authorization')) {
      throw new SignatureHeaderError((err as Error).message, 'missing');
    }
    throw new SignatureHeaderError((err as Error).message, 'malformed');
  }
}

export const pickupChallenge = corePickupChallenge;
export const ackChallenge = coreAckChallenge;

export function assertFreshTimestamp(ts: string, skewSeconds: number, now: Date = new Date()): void {
  const parsed = Date.parse(ts);
  if (Number.isNaN(parsed)) {
    throw new SignatureHeaderError('ts is not a valid ISO 8601 timestamp', 'malformed');
  }
  const drift = Math.abs(now.getTime() - parsed);
  if (drift > skewSeconds * 1000) {
    throw new SignatureHeaderError(
      `ts outside ±${skewSeconds}s skew window`,
      parsed > now.getTime() ? 'future' : 'stale',
    );
  }
}

export async function verifyChallengeSignature(
  challenge: string,
  signatureB64: string,
  signingPublicKeyB64: string,
): Promise<void> {
  const ok = await coreVerify(challenge, signatureB64, signingPublicKeyB64);
  if (!ok) {
    throw new SignatureHeaderError('signature did not verify', 'bad_signature');
  }
}
