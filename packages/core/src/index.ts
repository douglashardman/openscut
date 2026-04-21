export const VERSION = '0.1.0';
export {
  DEFAULT_TTL_SECONDS,
  EMPTY_V2_RESERVED,
  ENVELOPE_ID_BYTES,
  HKDF_INFO,
  MAX_CIPHERTEXT_BYTES,
  MAX_ENVELOPE_BYTES,
  PROTOCOL_VERSION,
  ScutCryptoError,
  XCHACHA20_NONCE_BYTES,
} from './types.js';
export type {
  AgentId,
  Ed25519KeyPair,
  Envelope,
  EnvelopeV2Reserved,
  IdentityDocument,
  RelayEntry,
  ScutCryptoErrorCode,
  X25519KeyPair,
} from './types.js';
export {
  canonicalizeToBytes,
  canonicalizeToString,
} from './canonicalize.js';
export {
  generateSigningKeypair,
  generateEncryptionKeypair,
} from './keys.js';
export {
  buildEnvelope,
  openEnvelope,
  type BuildEnvelopeParams,
  type OpenEnvelopeParams,
  type OpenedEnvelope,
} from './envelope.js';
export { canonicalBytesForSigning } from './sign.js';
