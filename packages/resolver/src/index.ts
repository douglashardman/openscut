#!/usr/bin/env node
import { loadConfigFromEnv, loadConfigFromFile, type ResolverConfig } from './config.js';
import { JsonFileRegistry } from './registry.js';
import { Erc8004Registry } from './registry/erc8004.js';
import { createResolverServer } from './server.js';
import type { Registry } from './registry.js';

async function buildRegistry(config: ResolverConfig): Promise<Registry> {
  if (config.registry.backend === 'erc8004') {
    if (!config.registry.contractAddress) {
      throw new Error('erc8004 backend requires registry.contractAddress');
    }
    return new Erc8004Registry({
      contractAddress: config.registry.contractAddress as `0x${string}`,
      rpcUrl: config.registry.rpcUrl,
    });
  }
  if (!config.registry.path) {
    throw new Error('json-file backend requires registry.path');
  }
  const registry = new JsonFileRegistry(config.registry.path);
  await registry.load();
  return registry;
}

async function main(): Promise<void> {
  const configArgIndex = process.argv.indexOf('--config');
  const config =
    configArgIndex >= 0 && process.argv[configArgIndex + 1]
      ? loadConfigFromFile(process.argv[configArgIndex + 1]!)
      : loadConfigFromEnv();

  const registry = await buildRegistry(config);

  const server = await createResolverServer(config, registry);
  await server.app.listen({ host: config.listen.host, port: config.listen.port });

  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('scut-resolver failed to start:', err);
  process.exit(1);
});
