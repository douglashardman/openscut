import {
  formatScutUri,
  generateEncryptionKeypair,
  generateSigningKeypair,
  HttpResolverClient,
  parseScutUri,
  ScutClient,
  type ScutUri,
  type SiiDocument,
} from '@openscut/core';
import { createRelayServer, type RelayServer } from 'scut-relay/src/server.js';
import { InMemoryRegistry } from 'scut-resolver/src/registry.js';
import { createResolverServer, type ResolverServer } from 'scut-resolver/src/server.js';
import type { Registry } from 'scut-resolver/src/registry.js';
import { SCENARIOS, type Scenario } from './scenarios.js';

export interface AgentKeys {
  signing: { publicKey: string; privateKey: string };
  encryption: { publicKey: string; privateKey: string };
}

export interface DemoAgent {
  ref: ScutUri;
  label?: string;
  keys: AgentKeys;
  identity: SiiDocument;
  client: ScutClient;
}

export interface DemoHandles {
  relay: RelayServer & { baseUrl: string };
  resolver: ResolverServer & { baseUrl: string };
  agentsByRef: Map<ScutUri, DemoAgent>;
  eventsToken: string;
  startedAt: number;
  close: () => Promise<void>;
}

export interface DemoConfig {
  eventsToken?: string;
  scenarios?: readonly Scenario[];
  /**
   * Pre-generated keys keyed by scut:// URI. When provided, the
   * orchestrator uses these keys instead of generating fresh ones
   * at boot. Required when agents are registered on-chain and the
   * in-process demo must sign as those real identities.
   */
  keys?: ReadonlyMap<ScutUri, AgentKeys>;
  /**
   * Registry override for the in-process resolver. Defaults to an
   * InMemoryRegistry populated with the agents' identity documents
   * (hermetic; for tests). Pass a SIIRegistry to read real on-chain
   * documents during the live demo.
   */
  registry?: Registry;
}

export async function startDemoStack(config: DemoConfig = {}): Promise<DemoHandles> {
  process.env.SCUT_RELAY_LOG ??= 'silent';
  process.env.SCUT_RESOLVER_LOG ??= 'silent';

  const scenarios = config.scenarios ?? SCENARIOS;
  const eventsToken = config.eventsToken ?? 'scut-demo-events-token-default';

  const registry = config.registry ?? new InMemoryRegistry();
  const hermetic = registry instanceof InMemoryRegistry;

  const resolverServer = await createResolverServer(
    {
      listen: { host: '127.0.0.1', port: 0 },
      registry: {
        backend: 'json-file' as const,
        path: '/unused',
        chainId: 8453,
        rpcUrl: 'https://mainnet.base.org',
        ipfsGateway: 'https://ipfs.io/ipfs/',
      },
      cache: { ttlSeconds: 60 },
    },
    registry,
  );
  const resolverUrl = await resolverServer.app.listen({ host: '127.0.0.1', port: 0 });

  const relayServer = await createRelayServer({
    listen: { host: '127.0.0.1', port: 0 },
    database: { path: ':memory:' },
    resolver: { url: resolverUrl, cacheTtlSeconds: 300 },
    limits: {
      maxEnvelopeBytes: 102_400,
      maxTtlSeconds: 604_800,
      ratePerSenderPerMinute: 120,
      rateGlobalPerMinute: 120_000,
      pickupNonceWindowSeconds: 300,
      clockSkewSeconds: 300,
    },
    events: { token: eventsToken, heartbeatSeconds: 20 },
    eviction: { intervalSeconds: 3600 },
  });
  const relayUrl = await relayServer.app.listen({ host: '127.0.0.1', port: 0 });

  const uniqueRefs = new Set<ScutUri>();
  for (const scenario of scenarios) {
    uniqueRefs.add(scenario.a.ref);
    uniqueRefs.add(scenario.b.ref);
  }

  const agentsByRef = new Map<ScutUri, DemoAgent>();
  for (const ref of uniqueRefs) {
    const preset = config.keys?.get(ref);
    const keys = preset ?? (await freshKeys());
    const agent = await buildAgent(ref, keys, relayUrl, resolverUrl);
    agentsByRef.set(ref, agent);
    if (hermetic) {
      (registry as InMemoryRegistry).set(agent.identity);
    }
  }

  return {
    relay: Object.assign(relayServer, { baseUrl: relayUrl }),
    resolver: Object.assign(resolverServer, { baseUrl: resolverUrl }),
    agentsByRef,
    eventsToken,
    startedAt: Date.now(),
    async close() {
      await relayServer.close();
      await resolverServer.close();
    },
  };
}

async function freshKeys(): Promise<AgentKeys> {
  const signing = await generateSigningKeypair();
  const encryption = await generateEncryptionKeypair();
  return { signing, encryption };
}

async function buildAgent(
  ref: ScutUri,
  keys: AgentKeys,
  relayUrl: string,
  resolverUrl: string,
): Promise<DemoAgent> {
  const agentRef = parseScutUri(ref);
  if (!agentRef) {
    throw new Error(`scenario ref is not a valid scut:// URI: ${ref}`);
  }
  const identity: SiiDocument = {
    siiVersion: 1,
    agentRef,
    keys: {
      signing: { algorithm: 'ed25519', publicKey: keys.signing.publicKey },
      encryption: { algorithm: 'x25519', publicKey: keys.encryption.publicKey },
    },
    relays: [{ host: relayUrl, priority: 10, protocols: ['scut/1'] }],
    capabilities: ['scut/1'],
    updatedAt: new Date().toISOString(),
  };
  const client = new ScutClient({
    agentRef: formatScutUri(agentRef),
    signingPrivateKey: keys.signing.privateKey,
    signingPublicKey: keys.signing.publicKey,
    encryptionPrivateKey: keys.encryption.privateKey,
    encryptionPublicKey: keys.encryption.publicKey,
    resolver: new HttpResolverClient(resolverUrl),
    // Demo stack always routes through the in-process relay regardless of
    // what the recipient's SII document advertises. The on-chain SII docs
    // list relay.openscut.ai (forward-looking, not yet live); the demo
    // ships envelopes over the local relay where both sender and receiver
    // are attached.
    outboundRelayOverride: [relayUrl],
    // Inbox override: poll the same in-process relay, not the advertised one.
    relays: [relayUrl],
  });
  return { ref, keys, identity, client };
}

export async function runScenario(
  scenario: Scenario,
  agentsByRef: ReadonlyMap<ScutUri, DemoAgent>,
  startedAt: number,
): Promise<void> {
  const a = agentsByRef.get(scenario.a.ref);
  const b = agentsByRef.get(scenario.b.ref);
  if (!a || !b) {
    throw new Error(`scenario ${scenario.id} references unknown agent(s)`);
  }
  for (const turn of scenario.turns) {
    const fireAt = startedAt + scenario.startOffsetMs + turn.sendOffsetMs;
    const delay = fireAt - Date.now();
    if (delay > 0) await sleep(delay);
    const sender = turn.fromRole === 'A' ? a : b;
    const recipient = turn.fromRole === 'A' ? b : a;
    await sender.client.send({ to: recipient.ref, body: turn.body });
  }
}

export async function runAllScenarios(handles: DemoHandles): Promise<void> {
  await Promise.all(
    SCENARIOS.map((scenario) => runScenario(scenario, handles.agentsByRef, handles.startedAt)),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
