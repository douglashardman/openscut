import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  generateEncryptionKeypair,
  generateSigningKeypair,
  HttpResolverClient,
  ScutClient,
  type IdentityDocument,
} from '@openscut/core';
import { createRelayServer, type RelayServer } from 'scut-relay/src/server.js';
import { InMemoryRegistry } from 'scut-resolver/src/registry.js';
import { createResolverServer, type ResolverServer } from 'scut-resolver/src/server.js';

interface AgentFixture {
  id: string;
  signing: { publicKey: string; privateKey: string };
  encryption: { publicKey: string; privateKey: string };
  identity: IdentityDocument;
  client: ScutClient;
}

interface Stack {
  relay: RelayServer & { baseUrl: string };
  resolver: ResolverServer & { baseUrl: string };
  registry: InMemoryRegistry;
  alice: AgentFixture;
  bob: AgentFixture;
  close: () => Promise<void>;
}

async function bootstrap(): Promise<Stack> {
  process.env.SCUT_RELAY_LOG = 'silent';
  process.env.SCUT_RESOLVER_LOG = 'silent';

  const registry = new InMemoryRegistry();

  const resolverServer = await createResolverServer(
    {
      listen: { host: '127.0.0.1', port: 0 },
      registry: {
        backend: 'json-file' as const,
        path: '/unused',
        chainId: 8453,
        rpcUrl: 'https://mainnet.base.org',
        ipfsGateway: 'https://ipfs.io/ipfs/',
      },
      cache: { ttlSeconds: 60 },
    },
    registry,
  );
  const resolverUrl = await resolverServer.app.listen({ host: '127.0.0.1', port: 0 });

  const relayServer = await createRelayServer({
    listen: { host: '127.0.0.1', port: 0 },
    database: { path: ':memory:' },
    resolver: { url: resolverUrl, cacheTtlSeconds: 300 },
    limits: {
      maxEnvelopeBytes: 102_400,
      maxTtlSeconds: 604_800,
      ratePerSenderPerMinute: 60,
      rateGlobalPerMinute: 60_000,
      pickupNonceWindowSeconds: 300,
      clockSkewSeconds: 300,
    },
    events: { token: 'integration-events-token', heartbeatSeconds: 20 },
    eviction: { intervalSeconds: 3600 },
  });
  const relayUrl = await relayServer.app.listen({ host: '127.0.0.1', port: 0 });

  const alice = await createAgent('0xAlice', relayUrl, resolverUrl, registry);
  const bob = await createAgent('0xBob', relayUrl, resolverUrl, registry);

  return {
    relay: Object.assign(relayServer, { baseUrl: relayUrl }),
    resolver: Object.assign(resolverServer, { baseUrl: resolverUrl }),
    registry,
    alice,
    bob,
    async close() {
      await relayServer.close();
      await resolverServer.close();
    },
  };
}

async function createAgent(
  id: string,
  relayUrl: string,
  resolverUrl: string,
  registry: InMemoryRegistry,
): Promise<AgentFixture> {
  const signing = await generateSigningKeypair();
  const encryption = await generateEncryptionKeypair();
  const identity: IdentityDocument = {
    protocol_version: 1,
    agent_id: id,
    keys: {
      signing: { algorithm: 'ed25519', public_key: signing.publicKey },
      encryption: { algorithm: 'x25519', public_key: encryption.publicKey },
    },
    relays: [{ host: relayUrl, priority: 10, protocols: ['scut/1'] }],
    capabilities: ['scut/1'],
    updated_at: new Date().toISOString(),
    v2_reserved: {
      ratchet_supported: false,
      onion_supported: false,
      group_supported: false,
    },
  };
  registry.set(id, identity);

  const client = new ScutClient({
    agentId: id,
    signingPrivateKey: signing.privateKey,
    signingPublicKey: signing.publicKey,
    encryptionPrivateKey: encryption.privateKey,
    encryptionPublicKey: encryption.publicKey,
    resolver: new HttpResolverClient(resolverUrl),
  });
  return { id, signing, encryption, identity, client };
}

describe('end-to-end: resolver + relay + ScutClient', () => {
  let stack: Stack;

  beforeEach(async () => {
    stack = await bootstrap();
  });

  afterEach(async () => {
    await stack.close();
  });

  it('alice sends, bob receives, bob acks, relay drops', async () => {
    const sendResult = await stack.alice.client.send({
      to: stack.bob.id,
      body: 'Hello, Bob. Meeting Thursday at 2.',
    });
    expect(sendResult.envelopeId).toMatch(/.+/);
    expect(sendResult.idempotent).toBe(false);

    const received = await stack.bob.client.receive();
    expect(received).toHaveLength(1);
    expect(received[0]?.body).toBe('Hello, Bob. Meeting Thursday at 2.');
    expect(received[0]?.from).toBe(stack.alice.id);
    expect(received[0]?.envelopeId).toBe(sendResult.envelopeId);

    const dropped = await stack.bob.client.ack([sendResult.envelopeId]);
    expect(dropped).toEqual([sendResult.envelopeId]);

    // After ack, the relay no longer has the envelope to serve.
    const after = await stack.bob.client.receive();
    expect(after).toHaveLength(0);
  });

  it('SSE stream observes envelope_received and envelope_acked from a real send/ack cycle', async () => {
    const controller = new AbortController();
    const events: Array<{ kind: string; [key: string]: unknown }> = [];
    const sseRes = await fetch(`${stack.relay.baseUrl}/scut/v1/events`, {
      headers: { authorization: 'Bearer integration-events-token' },
      signal: controller.signal,
    });
    expect(sseRes.ok).toBe(true);
    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const pump = (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const line = frame.split('\n').find((l) => l.startsWith('data: '));
            if (line) events.push(JSON.parse(line.slice(6)));
          }
        }
      } catch {
        /* stream aborted */
      }
    })();

    try {
      const { envelopeId } = await stack.alice.client.send({
        to: stack.bob.id,
        body: 'SSE test message',
      });

      await waitUntil(() => events.some((e) => e.kind === 'envelope_received'));

      await stack.bob.client.ack([envelopeId]);

      await waitUntil(() => events.some((e) => e.kind === 'envelope_acked'));

      const received = events.find((e) => e.kind === 'envelope_received') as
        | { envelope: { envelope_id: string } }
        | undefined;
      const acked = events.find((e) => e.kind === 'envelope_acked') as
        | { envelope_ids: string[] }
        | undefined;
      expect(received?.envelope.envelope_id).toBe(envelopeId);
      expect(acked?.envelope_ids).toContain(envelopeId);
    } finally {
      controller.abort();
      await pump;
    }
  });

  it('push to a 404 recipient raises ScutClientError(not_found)', async () => {
    await expect(
      stack.alice.client.send({ to: '0xNobody', body: 'hi' }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});

async function waitUntil(
  predicate: () => boolean,
  { timeoutMs = 2000, stepMs = 20 } = {},
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for condition');
    await new Promise((r) => setTimeout(r, stepMs));
  }
}
