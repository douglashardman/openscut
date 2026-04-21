import { getSodium } from './sodium.js';
import { fromBase64, toBase64 } from './base64.js';
import { decryptBody, encryptBody } from './encrypt.js';
import {
  decodeEncryptionPrivateKey,
  decodeEncryptionPublicKey,
  decodeSigningPrivateKey,
  decodeSigningPublicKey,
} from './keys.js';
import { canonicalBytesForSigning, signEnvelope, verifyEnvelopeSignature } from './sign.js';
import {
  DEFAULT_TTL_SECONDS,
  EMPTY_V2_RESERVED,
  ENVELOPE_ID_BYTES,
  MAX_ENVELOPE_BYTES,
  PROTOCOL_VERSION,
  ScutCryptoError,
  type AgentId,
  type Envelope,
} from './types.js';

export interface BuildEnvelopeParams {
  from: AgentId;
  to: AgentId;
  body: string;
  senderSigningPrivateKey: string;
  recipientEncryptionPublicKey: string;
  ttlSeconds?: number;
  sentAt?: Date;
}

export interface OpenEnvelopeParams {
  envelope: Envelope;
  recipientEncryptionPrivateKey: string;
  senderSigningPublicKey: string;
}

export interface OpenedEnvelope {
  body: string;
  verifiedAt: Date;
  envelopeId: string;
  from: AgentId;
  to: AgentId;
  sentAt: Date;
}

export async function buildEnvelope(params: BuildEnvelopeParams): Promise<Envelope> {
  const s = await getSodium();

  const recipientPk = await decodeEncryptionPublicKey(params.recipientEncryptionPublicKey);
  const senderSk = await decodeSigningPrivateKey(params.senderSigningPrivateKey);

  const envelopeIdBytes = s.randombytes_buf(ENVELOPE_ID_BYTES);
  const envelopeId = await toBase64(envelopeIdBytes);

  const plaintext = new TextEncoder().encode(params.body);
  const { ciphertext, ephemeralPublicKey } = await encryptBody(
    plaintext,
    recipientPk,
    envelopeIdBytes,
  );

  const sentAt = (params.sentAt ?? new Date()).toISOString();

  const withoutSig = {
    protocol_version: PROTOCOL_VERSION,
    envelope_id: envelopeId,
    from: params.from,
    to: params.to,
    sent_at: sentAt,
    ttl_seconds: params.ttlSeconds ?? DEFAULT_TTL_SECONDS,
    ciphertext: await toBase64(ciphertext),
    ephemeral_pubkey: await toBase64(ephemeralPublicKey),
    v2_reserved: EMPTY_V2_RESERVED,
  } satisfies Omit<Envelope, 'signature'>;

  const sigBytes = await signEnvelope(withoutSig, senderSk);
  const envelope: Envelope = { ...withoutSig, signature: await toBase64(sigBytes) };

  const size = canonicalBytesForSigning(envelope).length + sigBytes.length + 40;
  if (size > MAX_ENVELOPE_BYTES) {
    throw new ScutCryptoError(
      `envelope exceeds max size (${size} bytes)`,
      'payload_too_large',
    );
  }

  return envelope;
}

export async function openEnvelope(params: OpenEnvelopeParams): Promise<OpenedEnvelope> {
  const { envelope } = params;

  assertEnvelopeShape(envelope);

  const senderPk = await decodeSigningPublicKey(params.senderSigningPublicKey);
  const signature = await fromBase64(envelope.signature);
  await verifyEnvelopeSignature(envelope, signature, senderPk);

  const recipientSk = await decodeEncryptionPrivateKey(params.recipientEncryptionPrivateKey);
  const ephemeralPk = await fromBase64(envelope.ephemeral_pubkey);
  const ciphertext = await fromBase64(envelope.ciphertext);
  const envelopeIdBytes = await fromBase64(envelope.envelope_id);

  if (envelopeIdBytes.length !== ENVELOPE_ID_BYTES) {
    throw new ScutCryptoError(
      `envelope_id must decode to ${ENVELOPE_ID_BYTES} bytes`,
      'bad_envelope_schema',
    );
  }

  const plaintext = await decryptBody(ciphertext, recipientSk, ephemeralPk, envelopeIdBytes);
  const body = new TextDecoder('utf-8', { fatal: true }).decode(plaintext);

  return {
    body,
    verifiedAt: new Date(),
    envelopeId: envelope.envelope_id,
    from: envelope.from,
    to: envelope.to,
    sentAt: new Date(envelope.sent_at),
  };
}

function assertEnvelopeShape(envelope: Envelope): void {
  if (envelope.protocol_version !== PROTOCOL_VERSION) {
    throw new ScutCryptoError(
      `unsupported protocol_version: ${String(envelope.protocol_version)}`,
      'bad_envelope_schema',
    );
  }
  for (const field of [
    'envelope_id',
    'from',
    'to',
    'sent_at',
    'ciphertext',
    'ephemeral_pubkey',
    'signature',
  ] as const) {
    if (typeof envelope[field] !== 'string' || envelope[field].length === 0) {
      throw new ScutCryptoError(`envelope.${field} missing or invalid`, 'bad_envelope_schema');
    }
  }
  if (typeof envelope.ttl_seconds !== 'number' || envelope.ttl_seconds <= 0) {
    throw new ScutCryptoError('envelope.ttl_seconds missing or invalid', 'bad_envelope_schema');
  }
}
