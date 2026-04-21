import {
  generateEncryptionKeypair,
  generateSigningKeypair,
  HttpResolverClient,
  ScutClient,
  type IdentityDocument,
} from '@openscut/core';
import { createRelayServer, type RelayServer } from 'scut-relay/src/server.js';
import { InMemoryRegistry } from 'scut-resolver/src/registry.js';
import { createResolverServer, type ResolverServer } from 'scut-resolver/src/server.js';
import { SCENARIOS, type Role, type Scenario } from './scenarios.js';

export interface DemoAgent {
  id: string;
  role: Role;
  scenarioId: number;
  signing: { publicKey: string; privateKey: string };
  encryption: { publicKey: string; privateKey: string };
  client: ScutClient;
  identity: IdentityDocument;
}

export interface DemoHandles {
  relay: RelayServer & { baseUrl: string };
  resolver: ResolverServer & { baseUrl: string };
  agents: DemoAgent[];
  eventsToken: string;
  startedAt: number;
  close: () => Promise<void>;
}

export interface DemoConfig {
  eventsToken?: string;
  scenarios?: readonly Scenario[];
  warmupMs?: number;
}

export async function startDemoStack(config: DemoConfig = {}): Promise<DemoHandles> {
  process.env.SCUT_RELAY_LOG ??= 'silent';
  process.env.SCUT_RESOLVER_LOG ??= 'silent';

  const scenarios = config.scenarios ?? SCENARIOS;
  const eventsToken = config.eventsToken ?? 'scut-demo-events-token-default';

  const registry = new InMemoryRegistry();

  const resolverServer = await createResolverServer(
    {
      listen: { host: '127.0.0.1', port: 0 },
      registry: {
        backend: 'json-file' as const,
        path: '/unused',
        rpcUrl: 'https://mainnet.base.org',
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

  const agents: DemoAgent[] = [];
  for (const scenario of scenarios) {
    for (const role of ['A', 'B'] as const) {
      const agent = await mintAgent(
        role === 'A' ? scenario.a.id : scenario.b.id,
        role,
        scenario.id,
        relayUrl,
        resolverUrl,
        registry,
      );
      agents.push(agent);
    }
  }

  return {
    relay: Object.assign(relayServer, { baseUrl: relayUrl }),
    resolver: Object.assign(resolverServer, { baseUrl: resolverUrl }),
    agents,
    eventsToken,
    startedAt: Date.now(),
    async close() {
      await relayServer.close();
      await resolverServer.close();
    },
  };
}

async function mintAgent(
  id: string,
  role: Role,
  scenarioId: number,
  relayUrl: string,
  resolverUrl: string,
  registry: InMemoryRegistry,
): Promise<DemoAgent> {
  const signing = await generateSigningKeypair();
  const encryption = await generateEncryptionKeypair();
  const identity: IdentityDocument = {
    protocol_version: 1,
    agent_id: id,
    keys: {
      signing: { algorithm: 'ed25519', public_key: signing.publicKey },
      encryption: { algorithm: 'x25519', public_key: encryption.publicKey },
    },
    relays: [{ host: relayUrl, priority: 10, protocols: ['scut/1'] }],
    capabilities: ['scut/1'],
    updated_at: new Date().toISOString(),
    v2_reserved: {
      ratchet_supported: false,
      onion_supported: false,
      group_supported: false,
    },
  };
  registry.set(id, identity);
  const client = new ScutClient({
    agentId: id,
    signingPrivateKey: signing.privateKey,
    signingPublicKey: signing.publicKey,
    encryptionPrivateKey: encryption.privateKey,
    encryptionPublicKey: encryption.publicKey,
    resolver: new HttpResolverClient(resolverUrl),
  });
  return { id, role, scenarioId, signing, encryption, client, identity };
}

export async function runScenario(
  scenario: Scenario,
  agents: { A: DemoAgent; B: DemoAgent },
  startedAt: number,
): Promise<void> {
  for (const turn of scenario.turns) {
    const fireAt = startedAt + scenario.startOffsetMs + turn.sendOffsetMs;
    const delay = fireAt - Date.now();
    if (delay > 0) await sleep(delay);
    const sender = turn.fromRole === 'A' ? agents.A : agents.B;
    const recipient = turn.fromRole === 'A' ? agents.B : agents.A;
    await sender.client.send({ to: recipient.id, body: turn.body });
  }
}

export async function runAllScenarios(handles: DemoHandles): Promise<void> {
  const pairs = groupByScenario(handles.agents);
  await Promise.all(
    [...pairs.entries()].map(async ([scenarioId, agents]) => {
      const scenario = SCENARIOS.find((s) => s.id === scenarioId);
      if (!scenario) return;
      await runScenario(scenario, agents, handles.startedAt);
    }),
  );
}

function groupByScenario(agents: readonly DemoAgent[]): Map<number, { A: DemoAgent; B: DemoAgent }> {
  const out = new Map<number, Partial<{ A: DemoAgent; B: DemoAgent }>>();
  for (const agent of agents) {
    const existing = out.get(agent.scenarioId) ?? {};
    existing[agent.role] = agent;
    out.set(agent.scenarioId, existing);
  }
  const final = new Map<number, { A: DemoAgent; B: DemoAgent }>();
  for (const [id, pair] of out.entries()) {
    if (pair.A && pair.B) final.set(id, pair as { A: DemoAgent; B: DemoAgent });
  }
  return final;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
