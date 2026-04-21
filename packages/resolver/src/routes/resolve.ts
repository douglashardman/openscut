import type { FastifyInstance, FastifyReply } from 'fastify';
import type { IdentityDocument } from '@openscut/core';
import type { ResolverConfig } from '../config.js';
import type { Registry } from '../registry.js';

interface CachedEntry {
  document: IdentityDocument;
  fetchedAt: number;
  sourceKey: string;
}

export interface ResolveDeps {
  config: ResolverConfig;
  registry: Registry;
}

export function registerResolveRoute(app: FastifyInstance, deps: ResolveDeps): void {
  const cache = new Map<string, CachedEntry>();
  const ttlMs = deps.config.cache.ttlSeconds * 1000;

  app.get('/scut/v1/resolve', async (req, reply) => {
    const query = req.query as { agent_id?: string; ref?: string; fresh?: string };
    const key = query.ref ?? query.agent_id;
    if (!key) {
      return reply
        .code(400)
        .send({ error: 'missing required query parameter: ref (or legacy agent_id)' });
    }

    const fresh = query.fresh === '1' || query.fresh === 'true';
    const cached = cache.get(key);
    if (!fresh && cached && Date.now() - cached.fetchedAt < ttlMs) {
      return respond(reply, key, cached, deps.config.cache.ttlSeconds);
    }

    let document: IdentityDocument | undefined;
    try {
      document = await deps.registry.lookup(key);
    } catch (err) {
      return reply
        .code(502)
        .send({ error: 'registry lookup failed', detail: (err as Error).message });
    }

    if (!document) {
      return reply.code(404).send({ error: 'ref not found', ref: key });
    }
    const entry: CachedEntry = { document, fetchedAt: Date.now(), sourceKey: key };
    cache.set(key, entry);
    return respond(reply, key, entry, deps.config.cache.ttlSeconds);
  });
}

function respond(
  reply: FastifyReply,
  key: string,
  entry: CachedEntry,
  ttlSeconds: number,
): FastifyReply {
  return reply.code(200).send({
    ref: key,
    agent_id: entry.document.agent_id,
    document: entry.document,
    fetched_at: new Date(entry.fetchedAt).toISOString(),
    source: 'registry',
    cache_ttl_seconds: ttlSeconds,
  });
}
