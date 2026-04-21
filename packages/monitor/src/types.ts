import type { Envelope } from '@openscut/core';

export type EntryStatus = 'stored' | 'acked' | 'expired';

export interface StreamEntry {
  receivedAt: number;
  envelope: Envelope;
  sizeBytes: number;
  status: EntryStatus;
  decryptable: boolean;
  revealedAt: number | null;
}

export interface RevealTarget {
  envelopeId: string;
  plaintext: string;
  startedAt: number;
}

export interface RelayEnvelopeReceived {
  kind: 'envelope_received';
  at: string;
  envelope: Envelope;
  received_at: string;
  expires_at: string;
}

export interface RelayEnvelopeAcked {
  kind: 'envelope_acked';
  at: string;
  envelope_ids: string[];
  by: string;
}

export interface RelayEnvelopeExpired {
  kind: 'envelope_expired';
  at: string;
  envelope_id: string;
  recipient_id: string;
}

export type RelayEvent = RelayEnvelopeReceived | RelayEnvelopeAcked | RelayEnvelopeExpired;
