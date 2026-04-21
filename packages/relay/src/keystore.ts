import type { ScutUri, SiiDocument } from '@openscut/core';

export interface Resolver {
  resolve(ref: ScutUri): Promise<SiiDocument>;
}

export class HttpResolver implements Resolver {
  constructor(private readonly baseUrl: string) {}

  async resolve(ref: ScutUri): Promise<SiiDocument> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/scut/v1/resolve?ref=${encodeURIComponent(ref)}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`resolver returned ${res.status} for ${ref}`);
    }
    const body = (await res.json()) as { document: SiiDocument };
    return body.document;
  }
}

interface CacheEntry {
  signingPublicKey: string;
  encryptionPublicKey: string;
  fetchedAt: number;
}

export class Keystore {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly resolver: Resolver,
    private readonly ttlMs: number,
  ) {}

  async getSigningPublicKey(ref: ScutUri): Promise<string> {
    const cached = this.cache.get(ref);
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) {
      return cached.signingPublicKey;
    }
    const doc = await this.resolver.resolve(ref);
    this.cache.set(ref, {
      signingPublicKey: doc.keys.signing.publicKey,
      encryptionPublicKey: doc.keys.encryption.publicKey,
      fetchedAt: Date.now(),
    });
    return doc.keys.signing.publicKey;
  }

  invalidate(ref: ScutUri): void {
    this.cache.delete(ref);
  }
}
