import { readFile, watch } from 'node:fs/promises';
import type { IdentityDocument } from '@openscut/core';
import { identityDocumentSchema } from './schema.js';

export interface Registry {
  lookup(agentId: string): Promise<IdentityDocument | undefined>;
}

/**
 * Registry backed by a JSON file mapping agent_id → identity document.
 * Reloads the file on mtime change so the demo orchestrator can edit
 * identities without bouncing the resolver.
 */
export class JsonFileRegistry implements Registry {
  private entries: Map<string, IdentityDocument> = new Map();
  private lastLoadedAt = 0;

  constructor(
    private readonly path: string,
    private readonly reloadEveryMs = 5_000,
  ) {}

  async load(): Promise<void> {
    const raw = await readFile(this.path, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = new Map<string, IdentityDocument>();
    for (const [agentId, doc] of Object.entries(parsed)) {
      const validated = identityDocumentSchema.parse(doc);
      if (validated.agent_id !== agentId) {
        throw new Error(
          `registry key ${agentId} does not match document agent_id ${validated.agent_id}`,
        );
      }
      next.set(agentId, validated as IdentityDocument);
    }
    this.entries = next;
    this.lastLoadedAt = Date.now();
  }

  async lookup(agentId: string): Promise<IdentityDocument | undefined> {
    if (Date.now() - this.lastLoadedAt > this.reloadEveryMs) {
      try {
        await this.load();
      } catch {
        // Swallow reload failures to keep serving the last good snapshot.
      }
    }
    return this.entries.get(agentId);
  }

  /** Test helper: install a watch that reloads on file change. */
  async watch(signal: AbortSignal): Promise<void> {
    const watcher = watch(this.path, { signal });
    for await (const _ of watcher) {
      try {
        await this.load();
      } catch {
        // ignored
      }
    }
  }
}

export class InMemoryRegistry implements Registry {
  private readonly entries = new Map<string, IdentityDocument>();

  set(agentId: string, doc: IdentityDocument): void {
    this.entries.set(agentId, doc);
  }

  async lookup(agentId: string): Promise<IdentityDocument | undefined> {
    return this.entries.get(agentId);
  }
}
