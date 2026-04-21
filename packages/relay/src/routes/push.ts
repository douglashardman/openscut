import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import sodium from 'libsodium-wrappers';
import { canonicalBytesForSigning, type Envelope } from '@openscut/core';
import type { RelayConfig } from '../config.js';
import type { RelayEventBus } from '../events.js';
import type { Keystore } from '../keystore.js';
import type { EnvelopeRepo } from '../repo.js';
import { envelopeSchema } from '../schemas.js';

export interface PushDeps {
  config: RelayConfig;
  repo: EnvelopeRepo;
  keystore: Keystore;
  bus: RelayEventBus;
}

export function registerPushRoute(app: FastifyInstance, deps: PushDeps): void {
  app.post(
    '/scut/v1/push',
    {
      bodyLimit: deps.config.limits.maxEnvelopeBytes,
    },
    async (req, reply) => handlePush(req, reply, deps),
  );
}

async function handlePush(
  req: FastifyRequest,
  reply: FastifyReply,
  deps: PushDeps,
): Promise<void> {
  const parsed = envelopeSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid envelope', detail: parsed.error.issues });
  }
  const envelope = parsed.data as Envelope;

  let signingKey: string;
  try {
    signingKey = await deps.keystore.getSigningPublicKey(envelope.from);
  } catch {
    return reply.code(401).send({ error: 'sender identity could not be resolved' });
  }

  await sodium.ready;
  let sigOk = false;
  try {
    const sigBytes = sodium.from_base64(envelope.signature, sodium.base64_variants.ORIGINAL);
    const pkBytes = sodium.from_base64(signingKey, sodium.base64_variants.ORIGINAL);
    const msg = canonicalBytesForSigning(envelope);
    sigOk = sodium.crypto_sign_verify_detached(sigBytes, msg, pkBytes);
  } catch {
    sigOk = false;
  }
  if (!sigOk) {
    return reply.code(401).send({ error: 'envelope signature is invalid' });
  }

  const now = Date.now();
  const ttlSeconds = Math.min(envelope.ttl_seconds, deps.config.limits.maxTtlSeconds);
  const expiresAt = now + ttlSeconds * 1000;

  const payload = Buffer.from(JSON.stringify(envelope), 'utf-8');
  const result = deps.repo.tryStore(
    {
      envelope_id: envelope.envelope_id,
      recipient_id: envelope.to,
      sender_id: envelope.from,
      signature: envelope.signature,
      expires_at: expiresAt,
      payload,
    },
    now,
  );

  if (result.kind === 'conflict') {
    return reply.code(409).send({
      error: 'envelope_id already stored with a different signature',
      envelope_id: envelope.envelope_id,
    });
  }

  const storedAt = new Date(result.received_at).toISOString();

  if (result.kind === 'stored') {
    deps.bus.publish({
      kind: 'envelope_received',
      at: new Date().toISOString(),
      envelope,
      received_at: storedAt,
      expires_at: new Date(expiresAt).toISOString(),
    });
  }

  return reply.code(202).send({
    stored_at: storedAt,
    envelope_id: envelope.envelope_id,
    idempotent: result.kind === 'duplicate',
  });
}
