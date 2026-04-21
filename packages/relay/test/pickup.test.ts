import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ackHeader,
  buildEnvelopeFor,
  InMemoryResolver,
  makeTestAgent,
  pickupHeader,
  signedHeader,
  startTestRelay,
  type TestAgent,
} from './helpers.js';
import { pickupChallenge } from '../src/auth.js';
import type { RelayServer } from '../src/server.js';

describe('GET /scut/v1/pickup', () => {
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

  async function pushOne(body = 'hello Bob'): Promise<string> {
    const envelope = await buildEnvelopeFor(alice, bob, body);
    await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    return envelope.envelope_id;
  }

  it('returns stored envelopes to the authenticated recipient', async () => {
    const id = await pushOne();
    const authorization = await pickupHeader(bob);
    const res = await fetch(
      `${server.baseUrl}/scut/v1/pickup?for=${encodeURIComponent(bob.ref)}`,
      { headers: { authorization } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { envelopes: Array<{ envelope_id: string }> };
    expect(body.envelopes).toHaveLength(1);
    expect(body.envelopes[0]?.envelope_id).toBe(id);
  });

  it('rejects a pickup where agent_id does not match ?for=', async () => {
    await pushOne();
    const authorization = await pickupHeader(bob);
    const res = await fetch(
      `${server.baseUrl}/scut/v1/pickup?for=${encodeURIComponent(alice.ref)}`,
      { headers: { authorization } },
    );
    expect(res.status).toBe(401);
  });

  it('rejects a pickup signed by the wrong agent', async () => {
    await pushOne();
    // Bob tries to pickup but signs with Alice's key.
    const ts = new Date().toISOString();
    const nonce = 'abc123';
    const challenge = pickupChallenge(bob.ref, ts, nonce);
    const authorization = await signedHeader(alice, challenge, ts, nonce);
    // We still pretend the header says bob, but the sig was made by alice.
    const spoofed = authorization.replace(`agent_id=${alice.ref}`, `agent_id=${bob.ref}`);
    const res = await fetch(
      `${server.baseUrl}/scut/v1/pickup?for=${encodeURIComponent(bob.ref)}`,
      { headers: { authorization: spoofed } },
    );
    expect(res.status).toBe(401);
  });

  it('rejects a pickup with a stale timestamp', async () => {
    await pushOne();
    const ts = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const nonce = 'stale-nonce';
    const challenge = pickupChallenge(bob.ref, ts, nonce);
    const authorization = await signedHeader(bob, challenge, ts, nonce);
    const res = await fetch(
      `${server.baseUrl}/scut/v1/pickup?for=${encodeURIComponent(bob.ref)}`,
      { headers: { authorization } },
    );
    expect(res.status).toBe(401);
  });

  it('rejects a replayed pickup nonce', async () => {
    await pushOne();
    const authorization = await pickupHeader(bob);
    const first = await fetch(
      `${server.baseUrl}/scut/v1/pickup?for=${encodeURIComponent(bob.ref)}`,
      { headers: { authorization } },
    );
    expect(first.status).toBe(200);
    const replay = await fetch(
      `${server.baseUrl}/scut/v1/pickup?for=${encodeURIComponent(bob.ref)}`,
      { headers: { authorization } },
    );
    expect(replay.status).toBe(401);
  });

  it('ack cross-recipient: Mallory cannot ack Bob envelopes', async () => {
    const id = await pushOne('protected payload');
    const mallory = await makeTestAgent('0xMallory');
    resolver.register(mallory);
    const authorization = await ackHeader(mallory, [id]);
    const res = await fetch(`${server.baseUrl}/scut/v1/ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({ envelope_ids: [id] }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { dropped: string[] };
    expect(body.dropped).toHaveLength(0);
  });
});
