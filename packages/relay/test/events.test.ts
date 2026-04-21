import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ackHeader,
  buildEnvelopeFor,
  InMemoryResolver,
  makeTestAgent,
  startTestRelay,
  TEST_EVENTS_TOKEN,
  type TestAgent,
} from './helpers.js';
import type { RelayServer } from '../src/server.js';
import { runEviction } from '../src/eviction.js';

interface SseEvent {
  kind: string;
  [key: string]: unknown;
}

async function subscribe(
  baseUrl: string,
  token: string,
): Promise<{
  events: SseEvent[];
  close: () => void;
  waitFor: (predicate: (e: SseEvent) => boolean, timeoutMs?: number) => Promise<SseEvent>;
}> {
  const controller = new AbortController();
  const events: SseEvent[] = [];
  const waiters: Array<{
    predicate: (e: SseEvent) => boolean;
    resolve: (e: SseEvent) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  const res = await fetch(`${baseUrl}/scut/v1/events`, {
    headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
    signal: controller.signal,
  });
  if (!res.ok || !res.body) throw new Error(`SSE subscribe failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = frame
            .split('\n')
            .find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          const event = JSON.parse(dataLine.slice(6)) as SseEvent;
          events.push(event);
          for (const w of [...waiters]) {
            if (w.predicate(event)) {
              clearTimeout(w.timer);
              waiters.splice(waiters.indexOf(w), 1);
              w.resolve(event);
            }
          }
        }
      }
    } catch {
      // stream closed
    }
  })();

  return {
    events,
    close: () => controller.abort(),
    waitFor(predicate, timeoutMs = 2000) {
      const existing = events.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise<SseEvent>((resolve, reject) => {
        const timer = setTimeout(() => {
          const idx = waiters.findIndex((w) => w.resolve === resolve);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(new Error('timed out waiting for SSE event'));
        }, timeoutMs);
        waiters.push({ predicate, resolve, reject, timer });
      });
    },
  };
}

describe('GET /scut/v1/events (SSE)', () => {
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

  it('requires the Bearer events token', async () => {
    const res = await fetch(`${server.baseUrl}/scut/v1/events`, {
      headers: { accept: 'text/event-stream' },
    });
    expect(res.status).toBe(401);
  });

  it('emits envelope_received on push and envelope_acked on ack', async () => {
    const sub = await subscribe(server.baseUrl, TEST_EVENTS_TOKEN);
    try {
      const envelope = await buildEnvelopeFor(alice, bob, 'stream me');
      await fetch(`${server.baseUrl}/scut/v1/push`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
      });

      const received = await sub.waitFor((e) => e.kind === 'envelope_received');
      expect((received as { envelope: { envelope_id: string } }).envelope.envelope_id).toBe(
        envelope.envelope_id,
      );

      const authorization = await ackHeader(bob, [envelope.envelope_id]);
      await fetch(`${server.baseUrl}/scut/v1/ack`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization },
        body: JSON.stringify({ envelope_ids: [envelope.envelope_id] }),
      });

      const acked = await sub.waitFor((e) => e.kind === 'envelope_acked');
      expect((acked as { envelope_ids: string[] }).envelope_ids).toContain(envelope.envelope_id);
    } finally {
      sub.close();
    }
  });

  it('emits envelope_expired when the eviction job runs', async () => {
    const sub = await subscribe(server.baseUrl, TEST_EVENTS_TOKEN);
    try {
      const envelope = await buildEnvelopeFor(alice, bob, 'short-lived', 3600);
      await fetch(`${server.baseUrl}/scut/v1/push`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(envelope),
      });
      await sub.waitFor((e) => e.kind === 'envelope_received');

      // Fast-forward the eviction cursor by 24 hours.
      const future = new Date(Date.now() + 24 * 3600 * 1000);
      runEviction(server.repo, server.bus, future);

      const expired = await sub.waitFor((e) => e.kind === 'envelope_expired');
      expect((expired as { envelope_id: string }).envelope_id).toBe(envelope.envelope_id);
    } finally {
      sub.close();
    }
  });
});
