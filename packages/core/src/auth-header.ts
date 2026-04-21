import { getSodium } from './sodium.js';
import { fromBase64, toBase64 } from './base64.js';
import { decodeSigningPrivateKey } from './keys.js';

export const PICKUP_CHALLENGE_PREFIX = 'pickup';
export const ACK_CHALLENGE_PREFIX = 'ack';

export function pickupChallenge(agentId: string, ts: string, nonce: string): string {
  return `${PICKUP_CHALLENGE_PREFIX}:${agentId}:${ts}:${nonce}`;
}

export function ackChallenge(
  agentId: string,
  ts: string,
  nonce: string,
  envelopeIds: readonly string[],
): string {
  const sorted = [...envelopeIds].sort();
  return `${ACK_CHALLENGE_PREFIX}:${agentId}:${ts}:${nonce}:${sorted.join(',')}`;
}

export interface SignatureHeaderFields {
  agentId: string;
  timestamp: string;
  nonce: string;
  signature: string;
}

export function parseSignatureHeader(headerValue: string | undefined): SignatureHeaderFields {
  if (!headerValue) {
    throw new Error('missing Authorization header');
  }
  const scheme = 'SCUT-Signature ';
  if (!headerValue.startsWith(scheme)) {
    throw new Error('Authorization scheme must be SCUT-Signature');
  }
  const map: Record<string, string> = {};
  for (const part of headerValue.slice(scheme.length).split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) throw new Error(`malformed segment "${part}"`);
    map[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  const agentId = map.agent_id;
  const ts = map.ts;
  const nonce = map.nonce;
  const sig = map.sig;
  if (!agentId || !ts || !nonce || !sig) {
    throw new Error('missing one of agent_id/ts/nonce/sig');
  }
  return { agentId, timestamp: ts, nonce, signature: sig };
}

export function formatSignatureHeader(fields: SignatureHeaderFields): string {
  return (
    `SCUT-Signature agent_id=${fields.agentId},` +
    `ts=${fields.timestamp},` +
    `nonce=${fields.nonce},` +
    `sig=${fields.signature}`
  );
}

async function signChallenge(challenge: string, signingPrivateKeyB64: string): Promise<string> {
  const s = await getSodium();
  const sk = await decodeSigningPrivateKey(signingPrivateKeyB64);
  const sig = s.crypto_sign_detached(challenge, sk);
  return toBase64(sig);
}

async function freshNonce(): Promise<string> {
  const s = await getSodium();
  return toBase64(s.randombytes_buf(16));
}

export async function buildPickupAuthorization(params: {
  agentId: string;
  signingPrivateKey: string;
  now?: Date;
}): Promise<string> {
  const timestamp = (params.now ?? new Date()).toISOString();
  const nonce = await freshNonce();
  const challenge = pickupChallenge(params.agentId, timestamp, nonce);
  const signature = await signChallenge(challenge, params.signingPrivateKey);
  return formatSignatureHeader({ agentId: params.agentId, timestamp, nonce, signature });
}

export async function buildAckAuthorization(params: {
  agentId: string;
  signingPrivateKey: string;
  envelopeIds: readonly string[];
  now?: Date;
}): Promise<string> {
  const timestamp = (params.now ?? new Date()).toISOString();
  const nonce = await freshNonce();
  const challenge = ackChallenge(params.agentId, timestamp, nonce, params.envelopeIds);
  const signature = await signChallenge(challenge, params.signingPrivateKey);
  return formatSignatureHeader({ agentId: params.agentId, timestamp, nonce, signature });
}

export async function verifyChallengeSignature(
  challenge: string,
  signatureB64: string,
  signingPublicKeyB64: string,
): Promise<boolean> {
  const s = await getSodium();
  try {
    const sig = await fromBase64(signatureB64);
    const pk = await fromBase64(signingPublicKeyB64);
    return s.crypto_sign_verify_detached(sig, challenge, pk);
  } catch {
    return false;
  }
}
