import Fastify, { type FastifyInstance } from 'fastify';
import type { ResolverConfig } from './config.js';
import type { Registry } from './registry.js';
import { registerResolveRoute } from './routes/resolve.js';

export interface ResolverServer {
  app: FastifyInstance;
  close: () => Promise<void>;
}

export async function createResolverServer(
  config: ResolverConfig,
  registry: Registry,
): Promise<ResolverServer> {
  const app = Fastify({
    logger: process.env.SCUT_RESOLVER_LOG === 'silent' ? false : true,
  });

  app.get('/health', async (_req, reply) => reply.send({ status: 'ok' }));
  registerResolveRoute(app, { config, registry });

  return {
    app,
    close: () => app.close(),
  };
}
