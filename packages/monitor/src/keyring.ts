import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  HttpResolverClient,
  openEnvelope,
  type Envelope,
  type ResolverClient,
} from '@openscut/core';

const keyringSchema = z.record(
  z.string(),
  z.object({
    encryption_private_key: z.string().min(1),
    signing_public_key: z.string().optional(),
  }),
);

export interface KeyringEntry {
  encryptionPrivateKey: string;
  signingPublicKey?: string;
}

export class Keyring {
  private readonly entries = new Map<string, KeyringEntry>();

  private constructor(entries: Map<string, KeyringEntry>) {
    this.entries = entries;
  }

  static async fromFile(path: string): Promise<Keyring> {
    const raw = await readFile(path, 'utf-8');
    const parsed = keyringSchema.parse(JSON.parse(raw));
    const entries = new Map<string, KeyringEntry>();
    for (const [agentId, fields] of Object.entries(parsed)) {
      entries.set(agentId, {
        encryptionPrivateKey: fields.encryption_private_key,
        signingPublicKey: fields.signing_public_key,
      });
    }
    return new Keyring(entries);
  }

  static fromMap(entries: Record<string, KeyringEntry>): Keyring {
    return new Keyring(new Map(Object.entries(entries)));
  }

  holdsKeyFor(agentId: string): boolean {
    return this.entries.has(agentId);
  }

  /**
   * Attempt to decrypt an envelope addressed to an agent we hold the
   * private key for. Resolves the sender's signing key via the given
   * resolver so signature verification can happen.
   *
   * Returns the plaintext on success, null on any failure (unknown
   * recipient, bad sig, bad MAC, resolver error). The monitor's
   * revealer treats all failure modes the same: the envelope stays
   * ciphertext.
   */
  async tryDecrypt(envelope: Envelope, resolver: ResolverClient): Promise<string | null> {
    const entry = this.entries.get(envelope.to);
    if (!entry) return null;
    try {
      const senderDoc = await resolver.resolve(envelope.from);
      const opened = await openEnvelope({
        envelope,
        recipientEncryptionPrivateKey: entry.encryptionPrivateKey,
        senderSigningPublicKey: senderDoc.keys.signing.public_key,
      });
      return opened.body;
    } catch {
      return null;
    }
  }
}

export { HttpResolverClient };
