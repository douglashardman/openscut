export const PROTOCOL_VERSION = 1 as const;

export type AgentId = string;

export interface Envelope {
  protocol_version: 1;
  envelope_id: string;
  from: AgentId;
  to: AgentId;
  sent_at: string;
  ttl_seconds: number;
  ciphertext: string;
  ephemeral_pubkey: string;
  signature: string;
  v2_reserved: EnvelopeV2Reserved;
}

export interface EnvelopeV2Reserved {
  ratchet_state: null;
  relay_path: null;
  recipient_hint: null;
  attachments: [];
  recipient_set: null;
}

export const EMPTY_V2_RESERVED: EnvelopeV2Reserved = Object.freeze({
  ratchet_state: null,
  relay_path: null,
  recipient_hint: null,
  attachments: [] as [],
  recipient_set: null,
}) as EnvelopeV2Reserved;

export interface RelayEntry {
  host: string;
  priority: number;
  protocols: string[];
}

export interface IdentityDocument {
  protocol_version: 1;
  agent_id: AgentId;
  keys: {
    signing: { algorithm: 'ed25519'; public_key: string };
    encryption: { algorithm: 'x25519'; public_key: string };
  };
  relays: RelayEntry[];
  capabilities: string[];
  updated_at: string;
  v2_reserved: {
    ratchet_supported: boolean;
    onion_supported: boolean;
    group_supported: boolean;
  };
}

export interface Ed25519KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface X25519KeyPair {
  publicKey: string;
  privateKey: string;
}

export class ScutCryptoError extends Error {
  constructor(
    message: string,
    public readonly code: ScutCryptoErrorCode,
  ) {
    super(message);
    this.name = 'ScutCryptoError';
  }
}

export type ScutCryptoErrorCode =
  | 'bad_signature'
  | 'bad_ciphertext'
  | 'bad_envelope_schema'
  | 'payload_too_large'
  | 'invalid_key';

export const ENVELOPE_ID_BYTES = 32;
export const XCHACHA20_NONCE_BYTES = 24;
export const MAX_CIPHERTEXT_BYTES = 64 * 1024;
export const MAX_ENVELOPE_BYTES = 100 * 1024;
export const DEFAULT_TTL_SECONDS = 604800;
export const HKDF_INFO = 'scut/v1/msg';
