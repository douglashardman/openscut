import type { RelayEventBus } from './events.js';
import type { EnvelopeRepo } from './repo.js';

export function startEvictionJob(
  repo: EnvelopeRepo,
  bus: RelayEventBus,
  intervalMs: number,
): () => void {
  const timer = setInterval(() => runEviction(repo, bus), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

export function runEviction(repo: EnvelopeRepo, bus: RelayEventBus, now: Date = new Date()): void {
  const evicted = repo.evictExpired(now.getTime());
  const at = now.toISOString();
  for (const row of evicted) {
    bus.publish({
      kind: 'envelope_expired',
      at,
      envelope_id: row.envelope_id,
      recipient_id: row.recipient_id,
    });
  }
}
