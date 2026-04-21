import type { Envelope } from '@openscut/core';
import type { RevealTarget, StreamEntry } from './types.js';

export interface StoreSnapshot {
  entries: readonly StreamEntry[];
  reveal: RevealTarget | null;
  version: number;
}

const BUFFER_CAP = 500;

export class MonitorStore {
  private entries: StreamEntry[] = [];
  private reveal: RevealTarget | null = null;
  private version = 0;
  private readonly subscribers = new Set<() => void>();
  private snapshotCache: StoreSnapshot;

  constructor() {
    this.snapshotCache = { entries: [], reveal: null, version: 0 };
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  getSnapshot = (): StoreSnapshot => this.snapshotCache;

  addEnvelope(envelope: Envelope, receivedAt: number, decryptable: boolean): void {
    const sizeBytes = Buffer.byteLength(JSON.stringify(envelope), 'utf-8');
    this.entries.push({
      envelope,
      receivedAt,
      sizeBytes,
      status: 'stored',
      decryptable,
      revealedAt: null,
    });
    if (this.entries.length > BUFFER_CAP) {
      this.entries = this.entries.slice(-BUFFER_CAP);
    }
    this.bump();
  }

  markAcked(envelopeIds: readonly string[], now: number): void {
    const ids = new Set(envelopeIds);
    for (const entry of this.entries) {
      if (ids.has(entry.envelope.envelope_id) && entry.status === 'stored') {
        entry.status = 'acked';
      }
    }
    void now;
    this.bump();
  }

  markExpired(envelopeId: string): void {
    for (const entry of this.entries) {
      if (entry.envelope.envelope_id === envelopeId) {
        entry.status = 'expired';
      }
    }
    this.bump();
  }

  findDecryptableFor(match: { from?: string; to?: string }): StreamEntry | undefined {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!;
      if (!entry.decryptable || entry.revealedAt !== null) continue;
      if (match.from && entry.envelope.from !== match.from) continue;
      if (match.to && entry.envelope.to !== match.to) continue;
      return entry;
    }
    return undefined;
  }

  oldestUnrevealedDecryptable(): StreamEntry | undefined {
    return this.entries.find((e) => e.decryptable && e.revealedAt === null);
  }

  startReveal(target: RevealTarget): void {
    const entry = this.entries.find((e) => e.envelope.envelope_id === target.envelopeId);
    if (entry) entry.revealedAt = target.startedAt;
    this.reveal = target;
    this.bump();
  }

  endReveal(): void {
    this.reveal = null;
    this.bump();
  }

  private bump(): void {
    this.version += 1;
    this.snapshotCache = {
      entries: this.entries.slice(),
      reveal: this.reveal,
      version: this.version,
    };
    for (const listener of this.subscribers) listener();
  }
}
