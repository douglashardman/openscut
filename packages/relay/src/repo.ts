import type { SqliteDb } from './db.js';

export interface StoredEnvelope {
  envelope_id: string;
  recipient_id: string;
  sender_id: string;
  signature: string;
  received_at: number;
  expires_at: number;
  payload: Buffer;
}

export interface StoreResult {
  kind: 'stored' | 'duplicate' | 'conflict';
  received_at: number;
}

export class EnvelopeRepo {
  constructor(private readonly db: SqliteDb) {}

  tryStore(envelope: Omit<StoredEnvelope, 'received_at'>, now: number): StoreResult {
    const existing = this.db
      .prepare(
        `SELECT signature, received_at FROM envelopes WHERE envelope_id = ?`,
      )
      .get(envelope.envelope_id) as { signature: string; received_at: number } | undefined;

    if (existing) {
      if (existing.signature === envelope.signature) {
        return { kind: 'duplicate', received_at: existing.received_at };
      }
      return { kind: 'conflict', received_at: existing.received_at };
    }

    this.db
      .prepare(
        `INSERT INTO envelopes
         (envelope_id, recipient_id, sender_id, signature, received_at, expires_at, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        envelope.envelope_id,
        envelope.recipient_id,
        envelope.sender_id,
        envelope.signature,
        now,
        envelope.expires_at,
        envelope.payload,
      );
    return { kind: 'stored', received_at: now };
  }

  forRecipientSince(recipientId: string, sinceMs: number): StoredEnvelope[] {
    const rows = this.db
      .prepare(
        `SELECT envelope_id, recipient_id, sender_id, signature, received_at, expires_at, payload
         FROM envelopes
         WHERE recipient_id = ? AND received_at >= ?
         ORDER BY received_at ASC`,
      )
      .all(recipientId, sinceMs) as StoredEnvelope[];
    return rows;
  }

  ackForRecipient(recipientId: string, envelopeIds: readonly string[]): string[] {
    if (envelopeIds.length === 0) return [];
    const placeholders = envelopeIds.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT envelope_id FROM envelopes
         WHERE recipient_id = ? AND envelope_id IN (${placeholders})`,
      )
      .all(recipientId, ...envelopeIds) as Array<{ envelope_id: string }>;

    if (rows.length === 0) return [];

    const hits = rows.map((r) => r.envelope_id);
    const delPlaceholders = hits.map(() => '?').join(',');
    this.db
      .prepare(
        `DELETE FROM envelopes
         WHERE recipient_id = ? AND envelope_id IN (${delPlaceholders})`,
      )
      .run(recipientId, ...hits);
    return hits;
  }

  evictExpired(nowMs: number): Array<{ envelope_id: string; recipient_id: string }> {
    const rows = this.db
      .prepare(`SELECT envelope_id, recipient_id FROM envelopes WHERE expires_at <= ?`)
      .all(nowMs) as Array<{ envelope_id: string; recipient_id: string }>;
    if (rows.length === 0) return [];
    this.db.prepare(`DELETE FROM envelopes WHERE expires_at <= ?`).run(nowMs);
    return rows;
  }
}

export class NonceRepo {
  constructor(
    private readonly db: SqliteDb,
    private readonly windowSeconds: number,
  ) {}

  tryClaim(nonce: string, agentId: string, nowMs: number): boolean {
    this.db.prepare(`DELETE FROM pickup_nonces WHERE seen_at < ?`).run(
      nowMs - this.windowSeconds * 1000,
    );
    try {
      this.db
        .prepare(`INSERT INTO pickup_nonces (nonce, agent_id, seen_at) VALUES (?, ?, ?)`)
        .run(nonce, agentId, nowMs);
      return true;
    } catch {
      return false;
    }
  }
}
