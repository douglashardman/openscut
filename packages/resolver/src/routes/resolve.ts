import type { FastifyInstance, FastifyReply } from 'fastify';
import type { IdentityDocument } from '@openscut/core';
import type { ResolverConfig } from '../config.js';
import type { Registry } from '../registry.js';

interface CachedEntry {
  document: IdentityDocument;
  fetchedAt: number;
}

export interface ResolveDeps {
  config: ResolverConfig;
  registry: Registry;
}

export function registerResolveRoute(app: FastifyInstance, deps: ResolveDeps): void {
  const cache = new Map<string, CachedEntry>();
  const ttlMs = deps.config.cache.ttlSeconds * 1000;

  app.get('/scut/v1/resolve', async (req, reply) => {
    const query = req.query as { agent_id?: string; fresh?: string };
    if (!query.agent_id) {
      return reply.code(400).send({ error: 'missing required query parameter: agent_id' });
    }

    const fresh = query.fresh === '1' || query.fresh === 'true';
    const cached = cache.get(query.agent_id);
    if (!fresh && cached && Date.now() - cached.fetchedAt < ttlMs) {
      return respond(reply, cached, deps.config.cache.ttlSeconds);
    }

    const document = await deps.registry.lookup(query.agent_id);
    if (!document) {
      return reply.code(404).send({ error: 'agent_id not found', agent_id: query.agent_id });
    }
    const entry: CachedEntry = { document, fetchedAt: Date.now() };
    cache.set(query.agent_id, entry);
    return respond(reply, entry, deps.config.cache.ttlSeconds);
  });
}

function respond(reply: FastifyReply, entry: CachedEntry, ttlSeconds: number): FastifyReply {
  return reply.code(200).send({
    agent_id: entry.document.agent_id,
    document: entry.document,
    fetched_at: new Date(entry.fetchedAt).toISOString(),
    source: 'local:mock-registry',
    cache_ttl_seconds: ttlSeconds,
  });
}
