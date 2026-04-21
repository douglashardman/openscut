import { EventEmitter } from 'node:events';
import type { Envelope } from '@openscut/core';

export type RelayEvent =
  | {
      kind: 'envelope_received';
      at: string;
      envelope: Envelope;
      received_at: string;
      expires_at: string;
    }
  | {
      kind: 'envelope_acked';
      at: string;
      envelope_ids: string[];
      by: string;
    }
  | {
      kind: 'envelope_expired';
      at: string;
      envelope_id: string;
      recipient_id: string;
    };

export class RelayEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(1000);
  }

  publish(event: RelayEvent): void {
    this.emitter.emit('event', event);
  }

  subscribe(listener: (event: RelayEvent) => void): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }
}
