import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

export interface RegistrationRow {
  tokenId: string;
  ed25519PublicKey: string;
  x25519PublicKey: string;
  displayName: string | null;
  custodial: 0 | 1;
  createdAt: number;
  updatedAt: number;
  clientIp: string | null;
  mintTxHash: string;
  lastUpdateTxHash: string;
}

export interface DailyCountRow {
  day: string;
  count: number;
}

export class RegisterDb {
  private readonly db: Database.Database;

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS registrations (
        token_id TEXT PRIMARY KEY,
        ed25519_public_key TEXT NOT NULL,
        x25519_public_key TEXT NOT NULL,
        display_name TEXT,
        custodial INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        client_ip TEXT,
        mint_tx_hash TEXT NOT NULL,
        last_update_tx_hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_registrations_ed25519
        ON registrations(ed25519_public_key);
      CREATE INDEX IF NOT EXISTS idx_registrations_display_name
        ON registrations(display_name);

      CREATE TABLE IF NOT EXISTS daily_counts (
        day TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  insertRegistration(row: Omit<RegistrationRow, 'custodial' | 'updatedAt'>): void {
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT INTO registrations
         (token_id, ed25519_public_key, x25519_public_key, display_name,
          custodial, created_at, updated_at, client_ip, mint_tx_hash, last_update_tx_hash)
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.tokenId,
        row.ed25519PublicKey,
        row.x25519PublicKey,
        row.displayName,
        row.createdAt,
        now,
        row.clientIp,
        row.mintTxHash,
        row.lastUpdateTxHash,
      );
  }

  findByTokenId(tokenId: string): RegistrationRow | undefined {
    const row = this.db
      .prepare(
        `SELECT token_id as tokenId,
                ed25519_public_key as ed25519PublicKey,
                x25519_public_key as x25519PublicKey,
                display_name as displayName,
                custodial,
                created_at as createdAt,
                updated_at as updatedAt,
                client_ip as clientIp,
                mint_tx_hash as mintTxHash,
                last_update_tx_hash as lastUpdateTxHash
         FROM registrations WHERE token_id = ?`,
      )
      .get(tokenId) as RegistrationRow | undefined;
    return row;
  }

  countAll(): number {
    return (
      this.db.prepare(`SELECT COUNT(*) as c FROM registrations`).get() as { c: number }
    ).c;
  }

  countByDisplayNameToday(displayName: string): number {
    const since = Math.floor(Date.now() / 1000) - 86_400;
    return (
      this.db
        .prepare(
          `SELECT COUNT(*) as c FROM registrations
           WHERE display_name = ? AND created_at >= ?`,
        )
        .get(displayName, since) as { c: number }
    ).c;
  }

  countToday(): number {
    const today = isoDay(new Date());
    const row = this.db
      .prepare(`SELECT count FROM daily_counts WHERE day = ?`)
      .get(today) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  incrementToday(): void {
    const today = isoDay(new Date());
    this.db
      .prepare(
        `INSERT INTO daily_counts (day, count) VALUES (?, 1)
         ON CONFLICT(day) DO UPDATE SET count = count + 1`,
      )
      .run(today);
  }

  updateAfterMutation(
    tokenId: string,
    txHash: string,
    fields: { ed25519PublicKey?: string; x25519PublicKey?: string; custodial?: 0 | 1 },
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const sets: string[] = ['last_update_tx_hash = ?', 'updated_at = ?'];
    const args: unknown[] = [txHash, now];
    if (fields.ed25519PublicKey) {
      sets.push('ed25519_public_key = ?');
      args.push(fields.ed25519PublicKey);
    }
    if (fields.x25519PublicKey) {
      sets.push('x25519_public_key = ?');
      args.push(fields.x25519PublicKey);
    }
    if (typeof fields.custodial === 'number') {
      sets.push('custodial = ?');
      args.push(fields.custodial);
    }
    args.push(tokenId);
    this.db
      .prepare(`UPDATE registrations SET ${sets.join(', ')} WHERE token_id = ?`)
      .run(...args);
  }

  close(): void {
    this.db.close();
  }
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
