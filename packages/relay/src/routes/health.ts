import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', async (_req, reply) => reply.code(200).send({ status: 'ok' }));
}
