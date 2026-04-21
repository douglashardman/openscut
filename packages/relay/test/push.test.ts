import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sodium from 'libsodium-wrappers';
import { canonicalBytesForSigning, type Envelope } from '@openscut/core';
import {
  buildEnvelopeFor,
  InMemoryResolver,
  makeTestAgent,
  startTestRelay,
  type TestAgent,
} from './helpers.js';
import type { RelayServer } from '../src/server.js';

async function resignEnvelope(envelope: Envelope, signingPrivateKeyB64: string): Promise<Envelope> {
  await sodium.ready;
  const sk = sodium.from_base64(signingPrivateKeyB64, sodium.base64_variants.ORIGINAL);
  const msg = canonicalBytesForSigning(envelope);
  const sig = sodium.crypto_sign_detached(msg, sk);
  return { ...envelope, signature: sodium.to_base64(sig, sodium.base64_variants.ORIGINAL) };
}

describe('POST /scut/v1/push', () => {
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

  it('accepts a valid envelope with 202 and stores it', async () => {
    const envelope = await buildEnvelopeFor(alice, bob, 'Hello, Bob.');
    const res = await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { stored_at: string; envelope_id: string; idempotent: boolean };
    expect(body.envelope_id).toBe(envelope.envelope_id);
    expect(body.idempotent).toBe(false);
  });

  it('is idempotent on duplicate envelope_id with same signature (202)', async () => {
    const envelope = await buildEnvelopeFor(alice, bob, 'duplicate test');
    const first = await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    const firstBody = (await first.json()) as { stored_at: string };

    const second = await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    expect(second.status).toBe(202);
    const secondBody = (await second.json()) as { stored_at: string; idempotent: boolean };
    expect(secondBody.idempotent).toBe(true);
    expect(secondBody.stored_at).toBe(firstBody.stored_at);
  });

  it('returns 409 on duplicate envelope_id with different signature', async () => {
    const envelope = await buildEnvelopeFor(alice, bob, 'conflict test');
    await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    // Build a *different* envelope but force its envelope_id to collide,
    // then re-sign it so the signature is valid for the collided id. This
    // matches a buggy-client scenario: same envelope_id, legitimately signed,
    // but different payload.
    const impostor = await buildEnvelopeFor(alice, bob, 'different payload');
    const reforged = await resignEnvelope(
      { ...impostor, envelope_id: envelope.envelope_id },
      alice.signing.privateKey,
    );
    const res = await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(reforged),
    });
    expect(res.status).toBe(409);
  });

  it('rejects an envelope with a tampered signature (401)', async () => {
    const envelope = await buildEnvelopeFor(alice, bob, 'bad sig test');
    const tampered = { ...envelope, from: '0xAttacker' };
    const res = await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(tampered),
    });
    expect(res.status).toBe(401);
  });

  it('rejects a malformed envelope (400)', async () => {
    const res = await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ protocol_version: 1, envelope_id: 'nope' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized body (413)', async () => {
    server = await startTestRelay(
      {
        limits: {
          maxEnvelopeBytes: 1024,
          maxTtlSeconds: 604_800,
          ratePerSenderPerMinute: 60,
          rateGlobalPerMinute: 60_000,
          pickupNonceWindowSeconds: 300,
          clockSkewSeconds: 300,
        },
      },
      { resolver },
    );
    const envelope = await buildEnvelopeFor(alice, bob, 'x'.repeat(4000));
    const res = await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    expect(res.status).toBe(413);
  });

  it('rejects a sender the resolver cannot find (401)', async () => {
    const stranger = await makeTestAgent('0xStranger');
    const envelope = await buildEnvelopeFor(stranger, bob, 'unknown sender');
    const res = await fetch(`${server.baseUrl}/scut/v1/push`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    expect(res.status).toBe(401);
  });
});
