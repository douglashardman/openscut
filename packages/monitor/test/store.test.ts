import { describe, expect, it } from 'vitest';
import type { Envelope } from '@openscut/core';
import { MonitorStore } from '../src/store.js';

function fakeEnvelope(id: string, from = '0xA', to = '0xB'): Envelope {
  return {
    protocol_version: 1,
    envelope_id: id,
    from,
    to,
    sent_at: '2026-04-23T10:00:00Z',
    ttl_seconds: 3600,
    ciphertext: 'x'.repeat(32),
    ephemeral_pubkey: 'y'.repeat(32),
    signature: 'z'.repeat(32),
    v2_reserved: {
      ratchet_state: null,
      relay_path: null,
      recipient_hint: null,
      attachments: [],
      recipient_set: null,
    },
  };
}

describe('MonitorStore', () => {
  it('notifies subscribers on addEnvelope and exposes an updated snapshot', () => {
    const store = new MonitorStore();
    let ticks = 0;
    store.subscribe(() => ticks++);
    store.addEnvelope(fakeEnvelope('e1'), 1000, true);
    expect(ticks).toBe(1);
    const snap = store.getSnapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0]?.envelope.envelope_id).toBe('e1');
    expect(snap.entries[0]?.decryptable).toBe(true);
    expect(snap.entries[0]?.status).toBe('stored');
  });

  it('findDecryptableFor returns the most recent match and skips already-revealed', () => {
    const store = new MonitorStore();
    store.addEnvelope(fakeEnvelope('e1', '0xA', '0xB'), 1, true);
    store.addEnvelope(fakeEnvelope('e2', '0xA', '0xB'), 2, true);
    store.addEnvelope(fakeEnvelope('e3', '0xC', '0xD'), 3, true);

    expect(store.findDecryptableFor({ from: '0xA', to: '0xB' })?.envelope.envelope_id).toBe('e2');

    store.startReveal({ envelopeId: 'e2', plaintext: '', startedAt: 100 });
    store.endReveal();

    expect(store.findDecryptableFor({ from: '0xA', to: '0xB' })?.envelope.envelope_id).toBe('e1');
  });

  it('markAcked transitions matching entries without removing them', () => {
    const store = new MonitorStore();
    store.addEnvelope(fakeEnvelope('e1'), 1, false);
    store.markAcked(['e1'], 100);
    expect(store.getSnapshot().entries[0]?.status).toBe('acked');
  });

  it('markExpired transitions matching entries to expired status', () => {
    const store = new MonitorStore();
    store.addEnvelope(fakeEnvelope('e1'), 1, false);
    store.markExpired('e1');
    expect(store.getSnapshot().entries[0]?.status).toBe('expired');
  });

  it('caps the buffer at 500 entries', () => {
    const store = new MonitorStore();
    for (let i = 0; i < 600; i++) {
      store.addEnvelope(fakeEnvelope(`e${i}`), i, false);
    }
    const snap = store.getSnapshot();
    expect(snap.entries).toHaveLength(500);
    expect(snap.entries[0]?.envelope.envelope_id).toBe('e100');
  });

  it('startReveal stamps the entry and surfaces a reveal snapshot', () => {
    const store = new MonitorStore();
    store.addEnvelope(fakeEnvelope('e1'), 1, true);
    store.startReveal({ envelopeId: 'e1', plaintext: 'hello', startedAt: 500 });
    const snap = store.getSnapshot();
    expect(snap.reveal?.envelopeId).toBe('e1');
    expect(snap.entries[0]?.revealedAt).toBe(500);
  });
});
