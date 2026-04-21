#!/usr/bin/env node
/**
 * One-command demo stack.
 *
 *   tsx packages/agents/src/run-demo.ts \
 *     [--events-token <token>] \
 *     [--keys-out <path>] \
 *     [--script-out <path>]
 *
 * Starts relay + resolver in-process, mints 10 scripted agents across
 * 5 scenarios, writes a monitor keyring and a reveal script to disk,
 * and prints the relay/resolver URLs the operator should point
 * `scut-monitor` at. Scenarios kick off immediately; SIGINT tears
 * everything down.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolve as resolvePath } from 'node:path';
import { tmpdir } from 'node:os';
import { runAllScenarios, startDemoStack } from './orchestrator.js';
import { revealScriptFromScenarios, SCENARIOS } from './scenarios.js';
import { VERSION } from '@openscut/core';

interface DemoCliArgs {
  eventsToken: string;
  keysOut: string;
  scriptOut: string;
}

function parseArgs(argv: readonly string[]): DemoCliArgs {
  const get = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    if (idx < 0) return fallback;
    const v = argv[idx + 1];
    if (!v) throw new Error(`${flag} requires a value`);
    return v;
  };
  const defaultDir = resolvePath(tmpdir(), 'scut-demo');
  return {
    eventsToken: get('--events-token', 'scut-demo-events-token-default'),
    keysOut: resolvePath(get('--keys-out', resolvePath(defaultDir, 'demo-keys.json'))),
    scriptOut: resolvePath(get('--script-out', resolvePath(defaultDir, 'demo-reveal-script.json'))),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.error(`scut demo · core v${VERSION} · booting...`);

  const handles = await startDemoStack({ eventsToken: args.eventsToken });

  await mkdir(dirname(args.keysOut), { recursive: true });
  await mkdir(dirname(args.scriptOut), { recursive: true });

  const keyring: Record<string, { encryption_private_key: string; signing_public_key: string }> = {};
  for (const agent of handles.agents) {
    keyring[agent.id] = {
      encryption_private_key: agent.encryption.privateKey,
      signing_public_key: agent.signing.publicKey,
    };
  }
  await writeFile(args.keysOut, JSON.stringify(keyring, null, 2));

  const revealScript = { reveals: revealScriptFromScenarios(SCENARIOS) };
  await writeFile(args.scriptOut, JSON.stringify(revealScript, null, 2));

  console.error('');
  console.error(`relay    ${handles.relay.baseUrl}`);
  console.error(`resolver ${handles.resolver.baseUrl}`);
  console.error(`events   ${handles.eventsToken}`);
  console.error(`keys     ${args.keysOut}`);
  console.error(`script   ${args.scriptOut}`);
  console.error('');
  console.error('step 1 — in a second terminal, run:');
  console.error('');
  console.error(
    `  pnpm --filter scut-monitor run dev -- --relay ${handles.relay.baseUrl} --token '${args.eventsToken}' --keys ${args.keysOut} --resolver ${handles.resolver.baseUrl} --script ${args.scriptOut}`,
  );
  console.error('');
  console.error('step 2 — come back here and press enter to start the scenarios.');
  console.error('         (the monitor must be connected first or the reveals will fire into nothing.)');
  console.error('         SIGINT in this terminal stops the whole stack.');

  const shutdown = async (): Promise<void> => {
    await handles.close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await new Promise<void>((resolve) => {
    const onData = (): void => {
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
      resolve();
    };
    if (process.stdin.isTTY) {
      process.stdin.resume();
      process.stdin.once('data', onData);
    } else {
      setTimeout(resolve, 3_000);
    }
  });

  await runAllScenarios(handles);
  console.error('all scenarios completed. SIGINT to exit.');
}

main().catch((err) => {
  console.error('scut demo failed:', err);
  process.exit(1);
});
