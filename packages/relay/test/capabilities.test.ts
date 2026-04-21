import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryResolver, startTestRelay } from './helpers.js';
import type { RelayServer } from '../src/server.js';

describe('GET /scut/v1/capabilities', () => {
  let server: RelayServer & { baseUrl: string };

  beforeEach(async () => {
    const resolver = new InMemoryResolver();
    server = await startTestRelay({}, { resolver });
  });

  afterEach(async () => {
    await server.close();
  });

  it('returns configured limits and protocol list', async () => {
    const res = await fetch(`${server.baseUrl}/scut/v1/capabilities`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      protocols: string[];
      max_envelope_bytes: number;
      max_ttl_seconds: number;
      rate_limit_per_sender_per_minute: number;
    };
    expect(body.protocols).toEqual(['scut/1']);
    expect(body.max_envelope_bytes).toBe(102_400);
    expect(body.max_ttl_seconds).toBe(604_800);
    expect(body.rate_limit_per_sender_per_minute).toBe(60);
  });
});
