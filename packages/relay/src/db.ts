import Database from 'better-sqlite3';
import type { Database as SqliteDb } from 'better-sqlite3';

export function openDatabase(path: string): SqliteDb {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  migrate(db);
  return db;
}

function migrate(db: SqliteDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS envelopes (
      envelope_id  TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL,
      sender_id    TEXT NOT NULL,
      signature    TEXT NOT NULL,
      received_at  INTEGER NOT NULL,
      expires_at   INTEGER NOT NULL,
      payload      BLOB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_recipient ON envelopes(recipient_id, received_at);
    CREATE INDEX IF NOT EXISTS idx_expiry    ON envelopes(expires_at);

    CREATE TABLE IF NOT EXISTS pickup_nonces (
      nonce    TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      seen_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pickup_nonces_expiry ON pickup_nonces(seen_at);
  `);
}

export type { SqliteDb };
