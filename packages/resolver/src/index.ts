#!/usr/bin/env node
import { loadConfigFromEnv, loadConfigFromFile } from './config.js';
import { JsonFileRegistry } from './registry.js';
import { createResolverServer } from './server.js';

async function main(): Promise<void> {
  const configArgIndex = process.argv.indexOf('--config');
  const config =
    configArgIndex >= 0 && process.argv[configArgIndex + 1]
      ? loadConfigFromFile(process.argv[configArgIndex + 1]!)
      : loadConfigFromEnv();

  const registry = new JsonFileRegistry(config.registry.path);
  await registry.load();

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
