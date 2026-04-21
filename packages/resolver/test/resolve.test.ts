import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IdentityDocument } from '@openscut/core';
import { InMemoryRegistry, JsonFileRegistry } from '../src/registry.js';
import { createResolverServer, type ResolverServer } from '../src/server.js';
import type { ResolverConfig } from '../src/config.js';

function makeIdentity(agentId: string): IdentityDocument {
  return {
    protocol_version: 1,
    agent_id: agentId,
    keys: {
      signing: { algorithm: 'ed25519', public_key: 'c2lnbmluZ19wdWJfa2V5X2Jhc2U2NF9wbGFjZWhvbGRlcg==' },
      encryption: { algorithm: 'x25519', public_key: 'ZW5jcnlwdGlvbl9wdWJfa2V5X2Jhc2U2NF9wbGFjZWhvbGRlcg==' },
    },
    relays: [{ host: 'relay.test', priority: 10, protocols: ['scut/1'] }],
    capabilities: ['scut/1'],
    updated_at: '2026-04-21T12:00:00Z',
    v2_reserved: {
      ratchet_supported: false,
      onion_supported: false,
      group_supported: false,
    },
  };
}

const testConfig: ResolverConfig = {
  listen: { host: '127.0.0.1', port: 0 },
  registry: {
    backend: 'json-file',
    path: '/unused',
    rpcUrl: 'https://mainnet.base.org',
  },
  cache: { ttlSeconds: 60 },
};

describe('GET /scut/v1/resolve', () => {
  let server: ResolverServer;
  let baseUrl: string;
  let registry: InMemoryRegistry;

  beforeEach(async () => {
    process.env.SCUT_RESOLVER_LOG = 'silent';
    registry = new InMemoryRegistry();
    server = await createResolverServer(testConfig, registry);
    baseUrl = await server.app.listen({ host: '127.0.0.1', port: 0 });
  });

  afterEach(async () => {
    await server.close();
  });

  it('returns 400 when agent_id is missing', async () => {
    const res = await fetch(`${baseUrl}/scut/v1/resolve`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the agent is not registered', async () => {
    const res = await fetch(`${baseUrl}/scut/v1/resolve?agent_id=0xUnknown`);
    expect(res.status).toBe(404);
  });

  it('returns the identity document when the agent is registered', async () => {
    const doc = makeIdentity('0xAlice');
    registry.set('0xAlice', doc);
    const res = await fetch(`${baseUrl}/scut/v1/resolve?agent_id=0xAlice`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { document: IdentityDocument; cache_ttl_seconds: number };
    expect(body.document.agent_id).toBe('0xAlice');
    expect(body.cache_ttl_seconds).toBe(60);
  });

  it('?fresh=1 bypasses the cache', async () => {
    const doc = makeIdentity('0xAlice');
    registry.set('0xAlice', doc);
    const first = await fetch(`${baseUrl}/scut/v1/resolve?agent_id=0xAlice`);
    const firstBody = (await first.json()) as { fetched_at: string };

    const second = await fetch(`${baseUrl}/scut/v1/resolve?agent_id=0xAlice&fresh=1`);
    const secondBody = (await second.json()) as { fetched_at: string };

    expect(Date.parse(secondBody.fetched_at)).toBeGreaterThanOrEqual(
      Date.parse(firstBody.fetched_at),
    );
  });
});

describe('JsonFileRegistry', () => {
  it('loads and validates identity documents from a JSON file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scut-resolver-'));
    const path = join(dir, 'registry.json');
    const payload = { '0xAlice': makeIdentity('0xAlice') };
    writeFileSync(path, JSON.stringify(payload));

    const registry = new JsonFileRegistry(path);
    await registry.load();
    const doc = await registry.lookup('0xAlice');
    expect(doc?.agent_id).toBe('0xAlice');
  });

  it('rejects registries whose key does not match the document agent_id', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scut-resolver-'));
    const path = join(dir, 'registry.json');
    writeFileSync(path, JSON.stringify({ '0xWrong': makeIdentity('0xAlice') }));
    const registry = new JsonFileRegistry(path);
    await expect(registry.load()).rejects.toThrow(/does not match/);
  });
});
