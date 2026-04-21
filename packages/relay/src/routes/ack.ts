import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  ackChallenge,
  assertFreshTimestamp,
  parseSignatureHeader,
  verifyChallengeSignature,
} from '../auth.js';
import type { RelayConfig } from '../config.js';
import type { RelayEventBus } from '../events.js';
import type { Keystore } from '../keystore.js';
import type { EnvelopeRepo, NonceRepo } from '../repo.js';
import { ackRequestSchema } from '../schemas.js';

export interface AckDeps {
  config: RelayConfig;
  repo: EnvelopeRepo;
  nonces: NonceRepo;
  keystore: Keystore;
  bus: RelayEventBus;
}

export function registerAckRoute(app: FastifyInstance, deps: AckDeps): void {
  app.post('/scut/v1/ack', async (req, reply) => handleAck(req, reply, deps));
}

async function handleAck(
  req: FastifyRequest,
  reply: FastifyReply,
  deps: AckDeps,
): Promise<void> {
  const bodyParse = ackRequestSchema.safeParse(req.body);
  if (!bodyParse.success) {
    return reply.code(400).send({ error: 'invalid ack body', detail: bodyParse.error.issues });
  }
  const envelopeIds = bodyParse.data.envelope_ids;

  let header;
  try {
    header = parseSignatureHeader(req.headers.authorization);
    assertFreshTimestamp(header.timestamp, deps.config.limits.clockSkewSeconds);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }

  let signingKey: string;
  try {
    signingKey = await deps.keystore.getSigningPublicKey(header.agentId);
  } catch {
    return reply.code(401).send({ error: 'agent identity could not be resolved' });
  }

  const challenge = ackChallenge(header.agentId, header.timestamp, header.nonce, envelopeIds);
  try {
    await verifyChallengeSignature(challenge, header.signature, signingKey);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }

  if (!deps.nonces.tryClaim(header.nonce, header.agentId, Date.now())) {
    return reply.code(401).send({ error: 'nonce has already been used' });
  }

  const dropped = deps.repo.ackForRecipient(header.agentId, envelopeIds);

  if (dropped.length > 0) {
    deps.bus.publish({
      kind: 'envelope_acked',
      at: new Date().toISOString(),
      envelope_ids: dropped,
      by: header.agentId,
    });
  }

  return reply.code(200).send({ dropped });
}
