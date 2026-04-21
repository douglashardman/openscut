export const PROTOCOL_VERSION = 1 as const;

/** Canonical wire form of an agent's identifier: scut://<chainId>/<contract>/<tokenId>. See SPEC §4.6. */
export type ScutUri = string;

/**
 * Back-compat alias. v0.1 code called this `AgentId` and carried a
 * short hex string; in v0.2 an "agent id" is a scut:// URI.
 * Retained as a type alias to keep existing imports stable.
 */
export type AgentId = ScutUri;

/** Structured form of an agent's on-chain reference. See SPEC §4.3. */
export interface AgentRef {
  /** Lowercase 0x-prefixed 40-char hex contract address. */
  contract: string;
  /** Decimal token id. */
  tokenId: string;
  /** EIP-155 chain id. Base mainnet = 8453. */
  chainId: number;
}

export interface Envelope {
  protocol_version: 1;
  envelope_id: string;
  /** Sender's scut:// URI (see §4.6). */
  from: ScutUri;
  /** Recipient's scut:// URI (see §4.6). */
  to: ScutUri;
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

/**
 * SII v1 identity document. Camel-case throughout per SPEC §4.3.
 * `agentRef` replaces v0.1's `agent_id` string: it self-identifies
 * the contract, tokenId, and chain so clients can cross-check that
 * a fetched document matches the lookup triple.
 */
export interface SiiDocument {
  siiVersion: 1;
  agentRef: AgentRef;
  keys: {
    signing: { algorithm: 'ed25519'; publicKey: string };
    encryption: { algorithm: 'x25519'; publicKey: string };
  };
  relays: RelayEntry[];
  capabilities: string[];
  displayName?: string;
  updatedAt?: string;
  issuer?: { name?: string; url?: string };
  v2Reserved?: {
    ratchetSupported: boolean;
    onionSupported: boolean;
    groupSupported: boolean;
  };
}

/**
 * Back-compat alias. v0.1 called the identity document
 * `IdentityDocument` with snake_case fields. v0.2 renamed to
 * `SiiDocument` with camelCase per SPEC §4.3. Alias kept so
 * existing imports compile while callers migrate.
 */
export type IdentityDocument = SiiDocument;

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
