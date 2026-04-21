import { describe, expect, it, vi } from 'vitest';
import type { Envelope, ResolverClient } from '@openscut/core';
import { Keyring } from '../src/keyring.js';
import { Orchestrator } from '../src/orchestrator.js';
import { MonitorStore } from '../src/store.js';

function fakeEnvelope(id: string, from = '0xA', to = '0xB'): Envelope {
  return {
    protocol_version: 1,
    envelope_id: id,
    from,
    to,
    sent_at: '2026-04-23T10:00:00Z',
    ttl_seconds: 3600,
    ciphertext: 'ct',
    ephemeral_pubkey: 'ep',
    signature: 'sg',
    v2_reserved: {
      ratchet_state: null,
      relay_path: null,
      recipient_hint: null,
      attachments: [],
      recipient_set: null,
    },
  };
}

class StubKeyring extends Keyring {
  constructor(private readonly plain: string | null) {
    super();
  }

  override holdsKeyFor(): boolean {
    return this.plain !== null;
  }

  override async tryDecrypt(): Promise<string | null> {
    return this.plain;
  }
}

const stubResolver: ResolverClient = {
  resolve: vi.fn(),
};

describe('Orchestrator (script mode)', () => {
  it('fires a reveal at the scripted offset for a matching envelope', async () => {
    vi.useFakeTimers();
    try {
      const store = new MonitorStore();
      store.addEnvelope(fakeEnvelope('e1', '0xA', '0xB'), 100, true);

      const orch = new Orchestrator(
        { store, keyring: new StubKeyring('hello Bob'), resolver: stubResolver },
        {
          kind: 'script',
          script: [{ at_ms_from_start: 1000, match: { from: '0xA', to: '0xB' } }],
          startedAt: Date.now(),
        },
      );
      orch.start();

      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      const snap = store.getSnapshot();
      expect(snap.reveal?.envelopeId).toBe('e1');
      expect(snap.reveal?.plaintext).toBe('hello Bob');
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips an entry when no matching envelope is in the store', async () => {
    vi.useFakeTimers();
    try {
      const store = new MonitorStore();
      const orch = new Orchestrator(
        { store, keyring: new StubKeyring('ignored'), resolver: stubResolver },
        {
          kind: 'script',
          script: [{ at_ms_from_start: 500, match: { from: '0xA', to: '0xB' } }],
          startedAt: Date.now(),
        },
      );
      orch.start();

      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      expect(store.getSnapshot().reveal).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('pops the queued reveal when the previous reveal ends', async () => {
    vi.useFakeTimers();
    try {
      const store = new MonitorStore();
      store.addEnvelope(fakeEnvelope('e1', '0xA', '0xB'), 100, true);
      store.addEnvelope(fakeEnvelope('e2', '0xC', '0xD'), 200, true);

      const orch = new Orchestrator(
        { store, keyring: new StubKeyring('body'), resolver: stubResolver },
        {
          kind: 'script',
          script: [
            { at_ms_from_start: 1000, match: { from: '0xA' } },
            { at_ms_from_start: 1500, match: { from: '0xC' } },
          ],
          startedAt: Date.now(),
        },
      );
      orch.start();

      vi.advanceTimersByTime(1500);
      await vi.runAllTimersAsync();

      expect(store.getSnapshot().reveal?.envelopeId).toBe('e1');

      store.endReveal();
      await vi.runAllTimersAsync();

      expect(store.getSnapshot().reveal?.envelopeId).toBe('e2');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Orchestrator (auto mode)', () => {
  it('fires a reveal on the auto cadence', async () => {
    vi.useFakeTimers();
    try {
      const store = new MonitorStore();
      store.addEnvelope(fakeEnvelope('e1'), 100, true);

      const orch = new Orchestrator(
        { store, keyring: new StubKeyring('auto body'), resolver: stubResolver },
        { kind: 'auto', intervalMs: 500 },
      );
      const stop = orch.start();
      try {
        await vi.advanceTimersByTimeAsync(500);
        expect(store.getSnapshot().reveal?.envelopeId).toBe('e1');
      } finally {
        stop();
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('is a no-op when the keyring returns null', async () => {
    vi.useFakeTimers();
    try {
      const store = new MonitorStore();
      store.addEnvelope(fakeEnvelope('e1'), 100, true);

      const orch = new Orchestrator(
        { store, keyring: new StubKeyring(null), resolver: stubResolver },
        { kind: 'auto', intervalMs: 500 },
      );
      const stop = orch.start();
      try {
        await vi.advanceTimersByTimeAsync(1000);
        expect(store.getSnapshot().reveal).toBeNull();
      } finally {
        stop();
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
