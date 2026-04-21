import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { RelayConfig } from './config.js';
import { openDatabase, type SqliteDb } from './db.js';
import { startEvictionJob } from './eviction.js';
import { RelayEventBus } from './events.js';
import { HttpResolver, Keystore, type Resolver } from './keystore.js';
import { EnvelopeRepo, NonceRepo } from './repo.js';
import { registerAckRoute } from './routes/ack.js';
import { registerCapabilitiesRoute } from './routes/capabilities.js';
import { registerEventsRoute } from './routes/events.js';
import { registerHealthRoute } from './routes/health.js';
import { registerPickupRoute } from './routes/pickup.js';
import { registerPushRoute } from './routes/push.js';

export interface RelayServerOverrides {
  db?: SqliteDb;
  resolver?: Resolver;
  bus?: RelayEventBus;
}

export interface RelayServer {
  app: FastifyInstance;
  bus: RelayEventBus;
  repo: EnvelopeRepo;
  db: SqliteDb;
  stopEviction: () => void;
  close: () => Promise<void>;
}

export async function createRelayServer(
  config: RelayConfig,
  overrides: RelayServerOverrides = {},
): Promise<RelayServer> {
  const db = overrides.db ?? openDatabase(config.database.path);
  const bus = overrides.bus ?? new RelayEventBus();
  const repo = new EnvelopeRepo(db);
  const nonces = new NonceRepo(db, config.limits.pickupNonceWindowSeconds);
  const resolver: Resolver = overrides.resolver ?? new HttpResolver(config.resolver.url);
  const keystore = new Keystore(resolver, config.resolver.cacheTtlSeconds * 1000);

  const app = Fastify({
    bodyLimit: config.limits.maxEnvelopeBytes,
    logger: process.env.SCUT_RELAY_LOG === 'silent' ? false : true,
  });

  await app.register(rateLimit, {
    max: config.limits.rateGlobalPerMinute,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', '::1'],
  });

  registerHealthRoute(app);
  registerCapabilitiesRoute(app, config);
  registerPushRoute(app, { config, repo, keystore, bus });
  registerPickupRoute(app, { config, repo, nonces, keystore });
  registerAckRoute(app, { config, repo, nonces, keystore, bus });
  registerEventsRoute(app, { config, bus });

  const stopEviction = startEvictionJob(
    repo,
    bus,
    config.eviction.intervalSeconds * 1000,
  );

  return {
    app,
    bus,
    repo,
    db,
    stopEviction,
    async close() {
      stopEviction();
      await app.close();
      db.close();
    },
  };
}
