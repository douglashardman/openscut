import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  assertFreshTimestamp,
  parseSignatureHeader,
  pickupChallenge,
  SignatureHeaderError,
  verifyChallengeSignature,
} from '../auth.js';
import type { RelayConfig } from '../config.js';
import type { Keystore } from '../keystore.js';
import type { EnvelopeRepo, NonceRepo } from '../repo.js';

export interface PickupDeps {
  config: RelayConfig;
  repo: EnvelopeRepo;
  nonces: NonceRepo;
  keystore: Keystore;
}

export function registerPickupRoute(app: FastifyInstance, deps: PickupDeps): void {
  app.get('/scut/v1/pickup', async (req, reply) => handlePickup(req, reply, deps));
}

async function handlePickup(
  req: FastifyRequest,
  reply: FastifyReply,
  deps: PickupDeps,
): Promise<void> {
  const query = req.query as { for?: string; since?: string };
  if (!query.for) {
    return reply.code(400).send({ error: 'missing required query parameter: for' });
  }

  let header;
  try {
    header = parseSignatureHeader(req.headers.authorization);
    if (header.agentId !== query.for) {
      throw new SignatureHeaderError('agent_id in header does not match ?for=', 'malformed');
    }
    assertFreshTimestamp(header.timestamp, deps.config.limits.clockSkewSeconds);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }

  let signingKey: string;
  try {
    signingKey = await deps.keystore.getSigningPublicKey(query.for);
  } catch {
    return reply.code(401).send({ error: 'agent identity could not be resolved' });
  }

  const challenge = pickupChallenge(header.agentId, header.timestamp, header.nonce);
  try {
    await verifyChallengeSignature(challenge, header.signature, signingKey);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }

  if (!deps.nonces.tryClaim(header.nonce, header.agentId, Date.now())) {
    return reply.code(401).send({ error: 'nonce has already been used' });
  }

  const sinceMs = query.since ? Date.parse(query.since) : 0;
  if (query.since && Number.isNaN(sinceMs)) {
    return reply.code(400).send({ error: 'invalid since timestamp' });
  }

  const rows = deps.repo.forRecipientSince(query.for, sinceMs || 0);
  const envelopes = rows.map((r) => JSON.parse(r.payload.toString('utf-8')) as unknown);
  return reply.code(200).send({ envelopes });
}
