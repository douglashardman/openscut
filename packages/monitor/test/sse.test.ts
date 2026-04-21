import { describe, expect, it } from 'vitest';
import { subscribeToEvents } from '../src/sse.js';
import type { RelayEvent } from '../src/types.js';

function fakeResponse(body: ReadableStream<Uint8Array>): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('subscribeToEvents', () => {
  it('parses a complete event frame and invokes onEvent', async () => {
    const received: RelayEvent[] = [];
    await subscribeToEvents({
      url: 'http://relay',
      token: 'token',
      onEvent: (e) => received.push(e),
      fetchImpl: async () =>
        fakeResponse(
          streamFromChunks([
            'event: envelope_received\n',
            'data: {"kind":"envelope_received","at":"2026-04-23T10:00:00Z","envelope":{"protocol_version":1,"envelope_id":"abc","from":"0xA","to":"0xB","sent_at":"2026-04-23T10:00:00Z","ttl_seconds":3600,"ciphertext":"xx","ephemeral_pubkey":"yy","signature":"zz","v2_reserved":{"ratchet_state":null,"relay_path":null,"recipient_hint":null,"attachments":[],"recipient_set":null}},"received_at":"2026-04-23T10:00:00Z","expires_at":"2026-04-23T11:00:00Z"}\n\n',
          ]),
        ),
    });
    expect(received).toHaveLength(1);
    expect(received[0]?.kind).toBe('envelope_received');
  });

  it('reassembles frames split across chunk boundaries', async () => {
    const received: RelayEvent[] = [];
    await subscribeToEvents({
      url: 'http://relay',
      token: 'token',
      onEvent: (e) => received.push(e),
      fetchImpl: async () =>
        fakeResponse(
          streamFromChunks([
            'event: envelope_acked\ndata: {"kind":"envelope',
            '_acked","at":"2026-04-23T10:00:00Z","envelope_ids":["x"],"by":"0xB"}',
            '\n\n',
          ]),
        ),
    });
    expect(received).toHaveLength(1);
    expect(received[0]?.kind).toBe('envelope_acked');
  });

  it('skips heartbeat comment lines', async () => {
    const received: RelayEvent[] = [];
    await subscribeToEvents({
      url: 'http://relay',
      token: 'token',
      onEvent: (e) => received.push(e),
      fetchImpl: async () =>
        fakeResponse(
          streamFromChunks([
            ': heartbeat 1\n\n',
            ': heartbeat 2\n\n',
            'event: envelope_expired\ndata: {"kind":"envelope_expired","at":"2026-04-23T10:00:00Z","envelope_id":"x","recipient_id":"0xB"}\n\n',
          ]),
        ),
    });
    expect(received).toHaveLength(1);
    expect(received[0]?.kind).toBe('envelope_expired');
  });

  it('surfaces non-OK responses via onError', async () => {
    let lastError: Error | null = null;
    await subscribeToEvents({
      url: 'http://relay',
      token: 'token',
      onEvent: () => {},
      onError: (err) => (lastError = err),
      fetchImpl: async () =>
        new Response(null, { status: 401, statusText: 'Unauthorized' }),
    });
    expect(lastError).not.toBeNull();
    expect(lastError?.message).toMatch(/401/);
  });
});
