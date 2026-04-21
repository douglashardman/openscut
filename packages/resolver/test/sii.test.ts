import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { SIIRegistry, SIIRegistryError } from '../src/registry/sii.js';
import type { SiiDocument } from '../src/schema/sii.js';
import { createResolverServer, type ResolverServer } from '../src/server.js';
import type { ResolverConfig } from '../src/config.js';

const CONTRACT = '0x6d34d47c5f863131a8d052ca4c51cd6a0f62fe17';
const CHAIN_ID = 8453;

function makeDoc(overrides: Partial<SiiDocument> = {}): SiiDocument {
  return {
    siiVersion: 1,
    agentRef: { contract: CONTRACT, tokenId: '1', chainId: CHAIN_ID },
    keys: {
      signing: { algorithm: 'ed25519', publicKey: 'base64signing' },
      encryption: { algorithm: 'x25519', publicKey: 'base64enc' },
    },
    relays: [{ host: 'relay.test', priority: 10, protocols: ['scut/1'] }],
    capabilities: ['scut/1'],
    displayName: 'Alice',
    ...overrides,
  } as SiiDocument;
}

function fakeClient(uriForToken: (tokenId: bigint) => string | Error): PublicClient {
  return {
    readContract: vi.fn(async ({ args }: { args: readonly unknown[] }) => {
      const tokenId = args[0] as bigint;
      const res = uriForToken(tokenId);
      if (res instanceof Error) throw res;
      return res;
    }),
  } as unknown as PublicClient;
}

function fakeFetch(body: string, status = 200): typeof fetch {
  return (async () =>
    new Response(body, {
      status,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
}

describe('SIIRegistry.lookupRef', () => {
  const ref = { chainId: CHAIN_ID, contract: CONTRACT, tokenId: '1' };

  it('resolves a known agent via the contract and URI fetcher', async () => {
    const doc = makeDoc();
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => 'https://host/doc.json'),
      fetchImpl: fakeFetch(JSON.stringify(doc)),
    });
    const out = await registry.lookupRef(ref);
    expect(out?.agentRef).toEqual(ref);
    expect(out?.keys.signing.publicKey).toBe('base64signing');
  });

  it('returns undefined when the contract returns the empty string', async () => {
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => ''),
      fetchImpl: fakeFetch(''),
    });
    expect(await registry.lookupRef(ref)).toBeUndefined();
  });

  it('returns undefined when the contract reverts with nonexistent token', async () => {
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => new Error('ERC721NonexistentToken(1) reverted')),
      fetchImpl: fakeFetch(''),
    });
    expect(await registry.lookupRef(ref)).toBeUndefined();
  });

  it('throws chain_not_supported when the ref chainId does not match the resolver', async () => {
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => 'never'),
      fetchImpl: fakeFetch(''),
    });
    await expect(registry.lookupRef({ ...ref, chainId: 1 })).rejects.toMatchObject({
      code: 'chain_not_supported',
    });
  });

  it('rejects a document whose agentRef does not match the lookup triple', async () => {
    const wrong = makeDoc({
      agentRef: { contract: CONTRACT, tokenId: '99', chainId: CHAIN_ID },
    });
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => 'https://host/doc.json'),
      fetchImpl: fakeFetch(JSON.stringify(wrong)),
    });
    await expect(registry.lookupRef(ref)).rejects.toMatchObject({
      code: 'ref_mismatch',
    });
  });

  it('rejects a document that fails schema validation', async () => {
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => 'https://host/doc.json'),
      fetchImpl: fakeFetch(JSON.stringify({ siiVersion: 1 })),
    });
    await expect(registry.lookupRef(ref)).rejects.toMatchObject({
      code: 'schema_invalid',
    });
  });

  it('resolves ipfs:// URIs through the configured gateway', async () => {
    const doc = makeDoc();
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify(doc), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => 'ipfs://bafyabc/doc.json'),
      fetchImpl: fetchSpy as unknown as typeof fetch,
      ipfsGateway: 'https://gateway.test/ipfs/',
    });
    await registry.lookupRef(ref);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledWith = fetchSpy.mock.calls[0]?.[0];
    expect(calledWith).toBe('https://gateway.test/ipfs/bafyabc/doc.json');
  });

  it('decodes data: URIs inline without calling fetch', async () => {
    const doc = makeDoc();
    const inline = Buffer.from(JSON.stringify(doc), 'utf-8').toString('base64');
    const fetchSpy = vi.fn();
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => `data:application/json;base64,${inline}`),
      fetchImpl: fetchSpy as unknown as typeof fetch,
    });
    const out = await registry.lookupRef(ref);
    expect(out).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('surfaces a non-2xx fetch response as fetch_error', async () => {
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => 'https://host/doc.json'),
      fetchImpl: fakeFetch('', 502),
    });
    await expect(registry.lookupRef(ref)).rejects.toMatchObject({
      code: 'fetch_error',
    });
  });
});

describe('SIIRegistry.lookup (legacy string entry point)', () => {
  it('accepts a scut:// URI and resolves it', async () => {
    const doc = makeDoc();
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => 'https://host/doc.json'),
      fetchImpl: fakeFetch(JSON.stringify(doc)),
    });
    const out = await registry.lookup(`scut://${CHAIN_ID}/${CONTRACT}/1`);
    expect(out?.agentRef.tokenId).toBe('1');
    expect(out?.agentRef.contract).toBe(CONTRACT);
    expect(out?.keys.signing.publicKey).toBe('base64signing');
  });

  it('accepts a bare token id and applies the configured default contract', async () => {
    const doc = makeDoc();
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => 'https://host/doc.json'),
      fetchImpl: fakeFetch(JSON.stringify(doc)),
    });
    const out = await registry.lookup('1');
    expect(out?.agentRef.tokenId).toBe('1');
    expect(out?.agentRef.contract).toBe(CONTRACT);
  });

  it('rejects malformed scut:// URIs as bad_ref', async () => {
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => ''),
      fetchImpl: fakeFetch(''),
    });
    await expect(registry.lookup('scut://nope')).rejects.toBeInstanceOf(SIIRegistryError);
  });
});

describe('resolver route /scut/v1/resolve?ref= integration', () => {
  let server: ResolverServer;
  let baseUrl: string;

  beforeEach(async () => {
    process.env.SCUT_RESOLVER_LOG = 'silent';
    const doc = makeDoc();
    const registry = new SIIRegistry({
      chainId: CHAIN_ID,
      contractAddress: CONTRACT,
      rpcUrl: 'http://unused',
      client: fakeClient(() => 'https://host/doc.json'),
      fetchImpl: fakeFetch(JSON.stringify(doc)),
    });
    const config: ResolverConfig = {
      listen: { host: '127.0.0.1', port: 0 },
      registry: {
        backend: 'sii',
        contractAddress: CONTRACT,
        chainId: CHAIN_ID,
        rpcUrl: 'http://unused',
        ipfsGateway: 'https://ipfs.io/ipfs/',
      },
      cache: { ttlSeconds: 60 },
    };
    server = await createResolverServer(config, registry);
    baseUrl = await server.app.listen({ host: '127.0.0.1', port: 0 });
  });

  afterEach(async () => {
    await server.close();
  });

  it('returns 200 and a resolved document when ref resolves', async () => {
    const ref = encodeURIComponent(`scut://${CHAIN_ID}/${CONTRACT}/1`);
    const res = await fetch(`${baseUrl}/scut/v1/resolve?ref=${ref}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ref: string;
      document: { agentRef: { tokenId: string; contract: string; chainId: number } };
    };
    expect(body.ref).toBe(`scut://${CHAIN_ID}/${CONTRACT}/1`);
    expect(body.document.agentRef.tokenId).toBe('1');
    expect(body.document.agentRef.contract).toBe(CONTRACT);
  });

  it('returns 400 when neither ref nor agent_id is supplied', async () => {
    const res = await fetch(`${baseUrl}/scut/v1/resolve`);
    expect(res.status).toBe(400);
  });
});
