import sodium from 'libsodium-wrappers';
import {
  buildEnvelope,
  formatScutUri,
  generateEncryptionKeypair,
  generateSigningKeypair,
  type Envelope,
  type ScutUri,
  type SiiDocument,
} from '@openscut/core';
import type { RelayConfig } from '../src/config.js';
import { createRelayServer, type RelayServer } from '../src/server.js';
import type { Resolver } from '../src/keystore.js';
import { ackChallenge, pickupChallenge } from '../src/auth.js';

const TEST_CONTRACT = '0x0000000000000000000000000000000000001111';
const TEST_CHAIN_ID = 8453;
let nextTestTokenId = 1;

export interface TestAgent {
  ref: ScutUri;
  agentRef: { contract: string; tokenId: string; chainId: number };
  signing: { publicKey: string; privateKey: string };
  encryption: { publicKey: string; privateKey: string };
  identity: SiiDocument;
}

export async function makeTestAgent(label?: string): Promise<TestAgent> {
  const tokenId = String(nextTestTokenId++);
  const agentRef = { contract: TEST_CONTRACT, tokenId, chainId: TEST_CHAIN_ID };
  const ref = formatScutUri(agentRef);
  const signing = await generateSigningKeypair();
  const encryption = await generateEncryptionKeypair();
  const identity: SiiDocument = {
    siiVersion: 1,
    agentRef,
    keys: {
      signing: { algorithm: 'ed25519', publicKey: signing.publicKey },
      encryption: { algorithm: 'x25519', publicKey: encryption.publicKey },
    },
    relays: [{ host: 'relay.test', priority: 10, protocols: ['scut/1'] }],
    capabilities: ['scut/1'],
    displayName: label,
    updatedAt: new Date().toISOString(),
    v2Reserved: {
      ratchetSupported: false,
      onionSupported: false,
      groupSupported: false,
    },
  };
  return { ref, agentRef, signing, encryption, identity };
}

export class InMemoryResolver implements Resolver {
  private readonly registry = new Map<string, SiiDocument>();

  register(agent: TestAgent): void {
    this.registry.set(agent.ref, agent.identity);
  }

  async resolve(ref: ScutUri): Promise<SiiDocument> {
    const doc = this.registry.get(ref);
    if (!doc) throw new Error(`unknown ref ${ref}`);
    return doc;
  }
}

export const TEST_EVENTS_TOKEN = 'test-events-token-12345';

export function makeTestConfig(overrides: Partial<RelayConfig> = {}): RelayConfig {
  return {
    listen: { host: '127.0.0.1', port: 0 },
    database: { path: ':memory:' },
    resolver: { url: 'http://unused', cacheTtlSeconds: 300 },
    limits: {
      maxEnvelopeBytes: 102_400,
      maxTtlSeconds: 604_800,
      ratePerSenderPerMinute: 60,
      rateGlobalPerMinute: 60_000,
      pickupNonceWindowSeconds: 300,
      clockSkewSeconds: 300,
    },
    events: { token: TEST_EVENTS_TOKEN, heartbeatSeconds: 20 },
    eviction: { intervalSeconds: 3600 },
    ...overrides,
  };
}

export async function startTestRelay(
  overrides: Partial<RelayConfig> = {},
  extras: { resolver?: Resolver } = {},
): Promise<RelayServer & { baseUrl: string }> {
  process.env.SCUT_RELAY_LOG = 'silent';
  const config = makeTestConfig(overrides);
  const server = await createRelayServer(config, { resolver: extras.resolver });
  const address = await server.app.listen({ host: '127.0.0.1', port: 0 });
  return Object.assign(server, { baseUrl: address });
}

export async function buildEnvelopeFor(
  from: TestAgent,
  to: TestAgent,
  body: string,
  ttlSeconds = 3600,
): Promise<Envelope> {
  return buildEnvelope({
    from: from.ref,
    to: to.ref,
    body,
    senderSigningPrivateKey: from.signing.privateKey,
    recipientEncryptionPublicKey: to.encryption.publicKey,
    ttlSeconds,
  });
}

export async function signedHeader(
  agent: TestAgent,
  challenge: string,
  ts: string,
  nonce: string,
): Promise<string> {
  await sodium.ready;
  const sk = sodium.from_base64(agent.signing.privateKey, sodium.base64_variants.ORIGINAL);
  const sig = sodium.crypto_sign_detached(challenge, sk);
  const sigB64 = sodium.to_base64(sig, sodium.base64_variants.ORIGINAL);
  return `SCUT-Signature agent_id=${agent.ref},ts=${ts},nonce=${nonce},sig=${sigB64}`;
}

export async function pickupHeader(agent: TestAgent): Promise<string> {
  await sodium.ready;
  const ts = new Date().toISOString();
  const nonce = sodium.to_base64(
    sodium.randombytes_buf(16),
    sodium.base64_variants.ORIGINAL,
  );
  return signedHeader(agent, pickupChallenge(agent.ref, ts, nonce), ts, nonce);
}

export async function ackHeader(agent: TestAgent, envelopeIds: readonly string[]): Promise<string> {
  await sodium.ready;
  const ts = new Date().toISOString();
  const nonce = sodium.to_base64(
    sodium.randombytes_buf(16),
    sodium.base64_variants.ORIGINAL,
  );
  return signedHeader(agent, ackChallenge(agent.ref, ts, nonce, envelopeIds), ts, nonce);
}
