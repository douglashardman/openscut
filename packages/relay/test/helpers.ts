import sodium from 'libsodium-wrappers';
import {
  buildEnvelope,
  generateEncryptionKeypair,
  generateSigningKeypair,
  type Envelope,
  type IdentityDocument,
} from '@openscut/core';
import type { RelayConfig } from '../src/config.js';
import { createRelayServer, type RelayServer } from '../src/server.js';
import type { Resolver } from '../src/keystore.js';
import { ackChallenge, pickupChallenge } from '../src/auth.js';

export interface TestAgent {
  id: string;
  signing: { publicKey: string; privateKey: string };
  encryption: { publicKey: string; privateKey: string };
  identity: IdentityDocument;
}

export async function makeTestAgent(id: string): Promise<TestAgent> {
  const signing = await generateSigningKeypair();
  const encryption = await generateEncryptionKeypair();
  const identity: IdentityDocument = {
    protocol_version: 1,
    agent_id: id,
    keys: {
      signing: { algorithm: 'ed25519', public_key: signing.publicKey },
      encryption: { algorithm: 'x25519', public_key: encryption.publicKey },
    },
    relays: [{ host: 'relay.test', priority: 10, protocols: ['scut/1'] }],
    capabilities: ['scut/1'],
    updated_at: new Date().toISOString(),
    v2_reserved: {
      ratchet_supported: false,
      onion_supported: false,
      group_supported: false,
    },
  };
  return { id, signing, encryption, identity };
}

export class InMemoryResolver implements Resolver {
  private readonly registry = new Map<string, IdentityDocument>();

  register(agent: TestAgent): void {
    this.registry.set(agent.id, agent.identity);
  }

  async resolve(agentId: string): Promise<IdentityDocument> {
    const doc = this.registry.get(agentId);
    if (!doc) throw new Error(`unknown agent_id ${agentId}`);
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
    from: from.id,
    to: to.id,
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
  return `SCUT-Signature agent_id=${agent.id},ts=${ts},nonce=${nonce},sig=${sigB64}`;
}

export async function pickupHeader(agent: TestAgent): Promise<string> {
  await sodium.ready;
  const ts = new Date().toISOString();
  const nonce = sodium.to_base64(
    sodium.randombytes_buf(16),
    sodium.base64_variants.ORIGINAL,
  );
  return signedHeader(agent, pickupChallenge(agent.id, ts, nonce), ts, nonce);
}

export async function ackHeader(agent: TestAgent, envelopeIds: readonly string[]): Promise<string> {
  await sodium.ready;
  const ts = new Date().toISOString();
  const nonce = sodium.to_base64(
    sodium.randombytes_buf(16),
    sodium.base64_variants.ORIGINAL,
  );
  return signedHeader(agent, ackChallenge(agent.id, ts, nonce, envelopeIds), ts, nonce);
}
