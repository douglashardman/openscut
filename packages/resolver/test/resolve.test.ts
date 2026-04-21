import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatScutUri, type SiiDocument } from '@openscut/core';
import { InMemoryRegistry, JsonFileRegistry } from '../src/registry.js';
import { createResolverServer, type ResolverServer } from '../src/server.js';
import type { ResolverConfig } from '../src/config.js';

const CONTRACT = '0x6d34d47c5f863131a8d052ca4c51cd6a0f62fe17';
const CHAIN_ID = 8453;

function makeIdentity(tokenId: string): SiiDocument {
  return {
    siiVersion: 1,
    agentRef: { contract: CONTRACT, tokenId, chainId: CHAIN_ID },
    keys: {
      signing: {
        algorithm: 'ed25519',
        publicKey: 'c2lnbmluZ19wdWJfa2V5X2Jhc2U2NF9wbGFjZWhvbGRlcg==',
      },
      encryption: {
        algorithm: 'x25519',
        publicKey: 'ZW5jcnlwdGlvbl9wdWJfa2V5X2Jhc2U2NF9wbGFjZWhvbGRlcg==',
      },
    },
    relays: [{ host: 'relay.test', priority: 10, protocols: ['scut/1'] }],
    capabilities: ['scut/1'],
    updatedAt: '2026-04-21T12:00:00Z',
    v2Reserved: {
      ratchetSupported: false,
      onionSupported: false,
      groupSupported: false,
    },
  };
}

const testConfig: ResolverConfig = {
  listen: { host: '127.0.0.1', port: 0 },
  registry: {
    backend: 'json-file',
    path: '/unused',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    ipfsGateway: 'https://ipfs.io/ipfs/',
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

  it('returns 400 when ref is missing', async () => {
    const res = await fetch(`${baseUrl}/scut/v1/resolve`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the agent is not registered', async () => {
    const ref = encodeURIComponent(`scut://${CHAIN_ID}/${CONTRACT}/99`);
    const res = await fetch(`${baseUrl}/scut/v1/resolve?ref=${ref}`);
    expect(res.status).toBe(404);
  });

  it('returns the SII document when the agent is registered', async () => {
    const doc = makeIdentity('1');
    registry.set(doc);
    const ref = formatScutUri(doc.agentRef);
    const res = await fetch(`${baseUrl}/scut/v1/resolve?ref=${encodeURIComponent(ref)}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { document: SiiDocument; cache_ttl_seconds: number; ref: string };
    expect(body.document.agentRef).toEqual(doc.agentRef);
    expect(body.ref).toBe(ref);
    expect(body.cache_ttl_seconds).toBe(60);
  });

  it('?fresh=1 bypasses the cache', async () => {
    const doc = makeIdentity('1');
    registry.set(doc);
    const ref = encodeURIComponent(formatScutUri(doc.agentRef));
    const first = await fetch(`${baseUrl}/scut/v1/resolve?ref=${ref}`);
    const firstBody = (await first.json()) as { fetched_at: string };

    const second = await fetch(`${baseUrl}/scut/v1/resolve?ref=${ref}&fresh=1`);
    const secondBody = (await second.json()) as { fetched_at: string };

    expect(Date.parse(secondBody.fetched_at)).toBeGreaterThanOrEqual(
      Date.parse(firstBody.fetched_at),
    );
  });
});

describe('JsonFileRegistry', () => {
  it('loads and validates SII documents from a JSON file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scut-resolver-'));
    const path = join(dir, 'registry.json');
    const doc = makeIdentity('1');
    const key = formatScutUri(doc.agentRef);
    writeFileSync(path, JSON.stringify({ [key]: doc }));

    const registry = new JsonFileRegistry(path);
    await registry.load();
    const out = await registry.lookup(key);
    expect(out?.agentRef).toEqual(doc.agentRef);
  });

  it('rejects registries whose key does not match the document agentRef', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'scut-resolver-'));
    const path = join(dir, 'registry.json');
    writeFileSync(
      path,
      JSON.stringify({ 'scut://8453/0x0000000000000000000000000000000000000000/1': makeIdentity('1') }),
    );
    const registry = new JsonFileRegistry(path);
    await expect(registry.load()).rejects.toThrow(/does not match/);
  });
});
