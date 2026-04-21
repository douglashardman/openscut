import type { FastifyInstance } from 'fastify';
import type { RelayConfig } from '../config.js';

export function registerCapabilitiesRoute(app: FastifyInstance, config: RelayConfig): void {
  app.get('/scut/v1/capabilities', async (_req, reply) => {
    return reply.code(200).send({
      protocols: ['scut/1'],
      max_envelope_bytes: config.limits.maxEnvelopeBytes,
      max_ttl_seconds: config.limits.maxTtlSeconds,
      rate_limit_per_sender_per_minute: config.limits.ratePerSenderPerMinute,
    });
  });
}
