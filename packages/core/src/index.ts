export const VERSION = '0.2.0';
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
  AgentRef,
  Ed25519KeyPair,
  Envelope,
  EnvelopeV2Reserved,
  IdentityDocument,
  RelayEntry,
  ScutCryptoErrorCode,
  ScutUri,
  SiiDocument,
  X25519KeyPair,
} from './types.js';
export {
  formatScutUri,
  isScutUri,
  parseScutUri,
} from './agent-ref.js';
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
export {
  ACK_CHALLENGE_PREFIX,
  PICKUP_CHALLENGE_PREFIX,
  ackChallenge,
  buildAckAuthorization,
  buildPickupAuthorization,
  formatSignatureHeader,
  parseSignatureHeader,
  pickupChallenge,
  verifyChallengeSignature,
  type SignatureHeaderFields,
} from './auth-header.js';
export {
  HttpResolverClient,
  ScutClient,
  ScutClientError,
  type ResolverClient,
  type ScutClientOptions,
  type SendResult,
} from './client.js';
export {
  decodeSiiDocumentFromDataUri,
  encodeSiiDocumentToDataUri,
} from './sii-data-uri.js';
