#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { HttpResolverClient } from '@openscut/core';
import { App } from './App.js';
import { buildMode, CliError, parseArgs } from './cli.js';
import { Keyring } from './keyring.js';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const keyring = await Keyring.fromFile(args.keys);
  const resolver = new HttpResolverClient(args.resolver);
  const mode = buildMode(args);

  render(
    <App
      opts={{
        relayUrl: args.relay,
        eventsToken: args.token,
        keyring,
        resolver,
        mode,
      }}
    />,
  );
}

main().catch((err) => {
  if (err instanceof CliError) {
    console.error(`scut-monitor: ${err.message}`);
  } else {
    console.error('scut-monitor failed to start:', err);
  }
  process.exit(1);
});
