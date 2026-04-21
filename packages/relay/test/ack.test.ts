import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ackHeader,
  buildEnvelopeFor,
  InMemoryResolver,
  makeTestAgent,
  startTestRelay,
  type TestAgent,
} from './helpers.js';
import type { RelayServer } from '../src/server.js';

describe('POST /scut/v1/ack', () => {
  let resolver: InMemoryResolver;
  let server: RelayServer & { baseUrl: string };
  let alice: TestAgent;
  let bob: TestAgent;

  beforeEach(async () => {
    resolver = new InMemoryResolver();
    alice = await makeTestAgent('0xAlice');
    bob = await makeTestAgent('0xBob');
    resolver.register(alice);
    resolver.register(bob);
    server = await startTestRelay({}, { resolver });
  });

  afterEach(async () => {
    await server.close();
  });

  async function pushOne(): Promise<string> {
    const envelope = await buildEnvelopeFor(alice, bob, 'ack me');
    await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    return envelope.envelope_id;
  }

  it('drops envelopes addressed to the caller and returns the dropped list', async () => {
    const id = await pushOne();
    const authorization = await ackHeader(bob, [id]);
    const res = await fetch(`${server.baseUrl}/scut/v1/ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({ envelope_ids: [id] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dropped: string[] };
    expect(body.dropped).toEqual([id]);
  });

  it('returns an empty dropped list for an unknown envelope_id (idempotent)', async () => {
    const authorization = await ackHeader(bob, ['not-a-real-id']);
    const res = await fetch(`${server.baseUrl}/scut/v1/ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({ envelope_ids: ['not-a-real-id'] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dropped: string[] };
    expect(body.dropped).toEqual([]);
  });

  it('rejects an ack body with zero envelope_ids', async () => {
    const authorization = await ackHeader(bob, ['x']);
    const res = await fetch(`${server.baseUrl}/scut/v1/ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({ envelope_ids: [] }),
    });
    expect(res.status).toBe(400);
  });
});
