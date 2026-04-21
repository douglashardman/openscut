#!/usr/bin/env node
import { loadConfigFromEnv, loadConfigFromFile, type ResolverConfig } from './config.js';
import { JsonFileRegistry } from './registry.js';
import { SIIRegistry } from './registry/sii.js';
import { createResolverServer } from './server.js';
import type { Registry } from './registry.js';

async function buildRegistry(config: ResolverConfig): Promise<Registry> {
  if (config.registry.backend === 'sii') {
    if (!config.registry.contractAddress) {
      throw new Error('sii backend requires registry.contractAddress');
    }
    return new SIIRegistry({
      chainId: config.registry.chainId,
      contractAddress: config.registry.contractAddress as `0x${string}`,
      rpcUrl: config.registry.rpcUrl,
      ipfsGateway: config.registry.ipfsGateway,
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
