import type { IdentityDocument } from '@openscut/core';

export interface Resolver {
  resolve(agentId: string): Promise<IdentityDocument>;
}

export class HttpResolver implements Resolver {
  constructor(private readonly baseUrl: string) {}

  async resolve(agentId: string): Promise<IdentityDocument> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/scut/v1/resolve?agent_id=${encodeURIComponent(agentId)}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`resolver returned ${res.status} for ${agentId}`);
    }
    const body = (await res.json()) as { document: IdentityDocument };
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

  async getSigningPublicKey(agentId: string): Promise<string> {
    const cached = this.cache.get(agentId);
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) {
      return cached.signingPublicKey;
    }
    const doc = await this.resolver.resolve(agentId);
    this.cache.set(agentId, {
      signingPublicKey: doc.keys.signing.public_key,
      encryptionPublicKey: doc.keys.encryption.public_key,
      fetchedAt: Date.now(),
    });
    return doc.keys.signing.public_key;
  }

  invalidate(agentId: string): void {
    this.cache.delete(agentId);
  }
}
