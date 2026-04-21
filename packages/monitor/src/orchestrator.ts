import type { ResolverClient } from '@openscut/core';
import type { Keyring } from './keyring.js';
import type { MonitorStore } from './store.js';
import type { StreamEntry } from './types.js';

export interface RevealScriptEntry {
  at_ms_from_start: number;
  match: { from?: string; to?: string };
}

export type OrchestratorMode =
  | { kind: 'auto'; intervalMs?: number }
  | { kind: 'script'; script: readonly RevealScriptEntry[]; startedAt?: number };

export interface OrchestratorDeps {
  store: MonitorStore;
  keyring: Keyring;
  resolver: ResolverClient;
}

export class Orchestrator {
  private queue: Array<{ entry: StreamEntry; plaintext: string }> = [];
  private inProgress = false;
  private unsubStore: (() => void) | null = null;
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly deps: OrchestratorDeps,
    private readonly mode: OrchestratorMode,
  ) {}

  start(): () => void {
    this.unsubStore = this.deps.store.subscribe(() => this.onStoreChange());
    if (this.mode.kind === 'script') {
      this.scheduleScript(this.mode.script, this.mode.startedAt ?? Date.now());
    } else {
      this.scheduleAuto(this.mode.intervalMs ?? 10_000);
    }
    return () => this.stop();
  }

  stop(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.unsubStore) {
      this.unsubStore();
      this.unsubStore = null;
    }
  }

  private scheduleScript(script: readonly RevealScriptEntry[], startedAt: number): void {
    for (const entry of script) {
      const fireAt = startedAt + entry.at_ms_from_start;
      const delay = Math.max(0, fireAt - Date.now());
      const timer = setTimeout(() => {
        void this.pickAndQueue(entry.match);
      }, delay);
      timer.unref?.();
      this.timers.push(timer);
    }
  }

  private scheduleAuto(intervalMs: number): void {
    const timer = setInterval(() => {
      void this.pickAndQueue({});
    }, intervalMs);
    timer.unref?.();
    this.timers.push(timer);
  }

  private async pickAndQueue(match: { from?: string; to?: string }): Promise<void> {
    const target = this.deps.store.findDecryptableFor(match);
    if (!target) return;
    const plaintext = await this.deps.keyring.tryDecrypt(target.envelope, this.deps.resolver);
    if (!plaintext) return;
    this.queue.push({ entry: target, plaintext });
    this.popQueue();
  }

  private onStoreChange(): void {
    const snap = this.deps.store.getSnapshot();
    if (!snap.reveal && this.inProgress) {
      this.inProgress = false;
      this.popQueue();
    }
  }

  private popQueue(): void {
    if (this.inProgress) return;
    const next = this.queue.shift();
    if (!next) return;
    this.inProgress = true;
    this.deps.store.startReveal({
      envelopeId: next.entry.envelope.envelope_id,
      plaintext: next.plaintext,
      startedAt: Date.now(),
    });
  }
}
