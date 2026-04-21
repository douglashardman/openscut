import { readFile, watch } from 'node:fs/promises';
import type { SiiDocument } from '@openscut/core';
import { formatScutUri } from '@openscut/core';
import { siiDocumentSchema } from './schema/sii.js';

export interface Registry {
  /**
   * Look up an SII document by `ref`. `ref` may be a scut:// URI
   * (canonical form) or any backend-specific key — JSON-file registries
   * use the scut:// URI as the map key.
   */
  lookup(ref: string): Promise<SiiDocument | undefined>;
}

/**
 * Registry backed by a JSON file mapping scut:// URI → SII document.
 * Reloads the file on mtime change so the demo orchestrator can edit
 * identities without bouncing the resolver.
 *
 * The JSON file is an object keyed by the canonical scut:// URI; each
 * value is a full SII document (see SPEC §4.3).
 */
export class JsonFileRegistry implements Registry {
  private entries: Map<string, SiiDocument> = new Map();
  private lastLoadedAt = 0;

  constructor(
    private readonly path: string,
    private readonly reloadEveryMs = 5_000,
  ) {}

  async load(): Promise<void> {
    const raw = await readFile(this.path, 'utf-8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next = new Map<string, SiiDocument>();
    for (const [key, doc] of Object.entries(parsed)) {
      const validated = siiDocumentSchema.parse(doc);
      const canonical = formatScutUri(validated.agentRef);
      if (key !== canonical) {
        throw new Error(
          `registry key ${key} does not match document agentRef ${canonical}`,
        );
      }
      next.set(canonical, validated as SiiDocument);
    }
    this.entries = next;
    this.lastLoadedAt = Date.now();
  }

  async lookup(ref: string): Promise<SiiDocument | undefined> {
    if (Date.now() - this.lastLoadedAt > this.reloadEveryMs) {
      try {
        await this.load();
      } catch {
        // Swallow reload failures to keep serving the last good snapshot.
      }
    }
    return this.entries.get(ref);
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
  private readonly entries = new Map<string, SiiDocument>();

  /**
   * Register an SII document. The key is the document's agentRef in
   * scut:// URI form, computed from the document itself — callers
   * don't pass it explicitly.
   */
  set(doc: SiiDocument): void {
    const ref = formatScutUri(doc.agentRef);
    this.entries.set(ref, doc);
  }

  async lookup(ref: string): Promise<SiiDocument | undefined> {
    return this.entries.get(ref);
  }
}
