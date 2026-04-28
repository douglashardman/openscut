import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import type { Address } from 'viem';
import type { RegisterConfig } from './config.js';
import { RegisterDb } from './db.js';
import { RegistryClient } from './registry-client.js';
import { registerRegisterRoute } from './routes/register.js';
import { registerUpdateRoute } from './routes/update.js';
import { registerTransferRoute } from './routes/transfer.js';
import { registerHealthRoute } from './routes/health.js';

export interface RegisterServer {
  app: FastifyInstance;
  close: () => Promise<void>;
}

export async function createRegisterServer(config: RegisterConfig): Promise<RegisterServer> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    trustProxy: true,
    bodyLimit: 64 * 1024,
  });

  const db = new RegisterDb(config.storage.dbPath);
  const registry = new RegistryClient({
    rpcUrl: config.chain.rpcUrl,
    contractAddress: config.chain.contractAddress as Address,
    walletKey: config.chain.walletKey as `0x${string}`,
    confirmations: config.chain.confirmations,
  });

  await app.register(rateLimit, {
    max: config.rateLimit.perIpPerHour,
    timeWindow: '1 hour',
    allowList: () => false,
    keyGenerator: (req) => req.ip,
  });

  registerRegisterRoute(app, { config, db, registry });
  registerUpdateRoute(app, { db, registry });
  registerTransferRoute(app, { db, registry });
  registerHealthRoute(app, { db, registry });

  app.get('/', async () => ({
    service: 'scut-register',
    version: '0.1.0',
    docs: 'https://github.com/douglashardman/openscut/tree/main/packages/register',
  }));

  return {
    app,
    close: async () => {
      await app.close();
      db.close();
    },
  };
}
