#!/usr/bin/env node
import { loadConfigFromEnv, loadConfigFromFile } from './config.js';
import { createRelayServer } from './server.js';

async function main(): Promise<void> {
  const configArgIndex = process.argv.indexOf('--config');
  const config =
    configArgIndex >= 0 && process.argv[configArgIndex + 1]
      ? loadConfigFromFile(process.argv[configArgIndex + 1]!)
      : loadConfigFromEnv();

  const server = await createRelayServer(config);
  await server.app.listen({ host: config.listen.host, port: config.listen.port });

  const shutdown = async (): Promise<void> => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('scut-relay failed to start:', err);
  process.exit(1);
});
