#!/usr/bin/env node
/**
 * One-command demo stack.
 *
 *   tsx packages/agents/src/run-demo.ts \
 *     [--events-token <token>] \
 *     [--keys-in <path>] \
 *     [--keys-out <path>] \
 *     [--script-out <path>] \
 *     [--on-chain] [--against-prod]
 *
 * Modes:
 *   hermetic (default): generates fresh keys, spawns in-process relay
 *     and resolver, registers agent documents in InMemory. No network.
 *   --on-chain: loads keys from --keys-in, spawns an in-process
 *     resolver that reads real SII documents from Base mainnet, spawns
 *     an in-process relay; agents sign as real on-chain identities but
 *     traffic stays local. Useful for development without load on the
 *     public relay.
 *   --on-chain --against-prod: loads keys from --keys-in, points at
 *     the production relay (relay.openscut.ai) and resolver
 *     (resolver.openscut.ai). No in-process services; traffic flows
 *     through the real public infrastructure.
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { resolve as resolvePath } from 'node:path';
import { tmpdir } from 'node:os';
import { homedir } from 'node:os';
import { VERSION, type ScutUri } from '@openscut/core';
import { SIIRegistry } from 'scut-resolver/src/registry/sii.js';
import {
  runAllScenarios,
  startDemoStack,
  type AgentKeys,
  type DemoConfig,
} from './orchestrator.js';
import { DEMO_CHAIN_ID, DEMO_REGISTRY_ADDRESS, revealScriptFromScenarios, SCENARIOS } from './scenarios.js';

const PROD_RELAY_URL = 'https://relay.openscut.ai';
const PROD_RESOLVER_URL = 'https://resolver.openscut.ai';

interface DemoCliArgs {
  eventsToken: string;
  keysIn: string | null;
  monitorKeysOut: string;
  scriptOut: string;
  onChain: boolean;
  againstProd: boolean;
}

function expand(p: string): string {
  if (p.startsWith('~/')) return resolvePath(homedir(), p.slice(2));
  return resolvePath(p);
}

function parseArgs(argv: readonly string[]): DemoCliArgs {
  const has = (flag: string): boolean => argv.includes(flag);
  const get = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    if (idx < 0) return fallback;
    const v = argv[idx + 1];
    if (!v) throw new Error(`${flag} requires a value`);
    return v;
  };
  const getOpt = (flag: string): string | null => {
    const idx = argv.indexOf(flag);
    if (idx < 0) return null;
    const v = argv[idx + 1];
    if (!v) throw new Error(`${flag} requires a value`);
    return v;
  };
  const defaultDir = resolvePath(tmpdir(), 'scut-demo');
  return {
    eventsToken: get('--events-token', 'scut-demo-events-token-default'),
    keysIn: getOpt('--keys-in'),
    monitorKeysOut: expand(get('--keys-out', resolvePath(defaultDir, 'monitor-keys.json'))),
    scriptOut: expand(get('--script-out', resolvePath(defaultDir, 'demo-reveal-script.json'))),
    onChain: has('--on-chain'),
    againstProd: has('--against-prod'),
  };
}

interface KeysFileAgent {
  tokenId: number;
  label: string;
  agentRef: string;
  keys: {
    signing: { publicKey: string; privateKey: string };
    encryption: { publicKey: string; privateKey: string };
  };
}

async function loadKeysIn(path: string): Promise<Map<ScutUri, AgentKeys>> {
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw) as { agents: KeysFileAgent[] };
  const map = new Map<ScutUri, AgentKeys>();
  for (const agent of parsed.agents) {
    map.set(agent.agentRef, {
      signing: agent.keys.signing,
      encryption: agent.keys.encryption,
    });
  }
  return map;
}

function modeLabel(onChain: boolean, againstProd: boolean): string {
  if (againstProd) return 'on-chain, against-prod (Base mainnet + relay.openscut.ai)';
  if (onChain) return 'on-chain, in-process (Base mainnet, local relay + resolver)';
  return 'hermetic (InMemory, local relay + resolver)';
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.againstProd && !args.onChain) {
    throw new Error('--against-prod implies --on-chain; pass both or neither');
  }
  if (args.onChain && !args.keysIn) {
    throw new Error(
      '--on-chain requires --keys-in: signing as real on-chain agents needs their private keys',
    );
  }
  if (args.againstProd && args.eventsToken === 'scut-demo-events-token-default') {
    throw new Error(
      '--against-prod requires --events-token: the production relay rejects the default token. ' +
        'Fetch the production token via: ssh garfield@openscut sudo cat /etc/scut/relay.env | grep EVENTS',
    );
  }

  console.error(`scut demo · core v${VERSION} · booting (${modeLabel(args.onChain, args.againstProd)})...`);

  const config: DemoConfig = { eventsToken: args.eventsToken };

  if (args.keysIn) {
    console.error(`loading agent keys from ${expand(args.keysIn)}`);
    config.keys = await loadKeysIn(expand(args.keysIn));
  }

  if (args.againstProd) {
    // Use the real public relay + resolver. No in-process services spawn.
    config.externalEndpoints = {
      relayUrl: PROD_RELAY_URL,
      resolverUrl: PROD_RESOLVER_URL,
    };
  } else if (args.onChain) {
    // In-process resolver reads real on-chain SII documents from Base mainnet.
    config.registry = new SIIRegistry({
      chainId: DEMO_CHAIN_ID,
      contractAddress: DEMO_REGISTRY_ADDRESS as `0x${string}`,
      rpcUrl: 'https://mainnet.base.org',
    });
  }

  const handles = await startDemoStack(config);

  await mkdir(dirname(args.monitorKeysOut), { recursive: true });
  await mkdir(dirname(args.scriptOut), { recursive: true });

  const monitorKeyring: Record<string, { encryption_private_key: string; signing_public_key: string }> =
    {};
  for (const [ref, agent] of handles.agentsByRef) {
    monitorKeyring[ref] = {
      encryption_private_key: agent.keys.encryption.privateKey,
      signing_public_key: agent.keys.signing.publicKey,
    };
  }
  await writeFile(args.monitorKeysOut, JSON.stringify(monitorKeyring, null, 2));

  const revealScript = { reveals: revealScriptFromScenarios(SCENARIOS) };
  await writeFile(args.scriptOut, JSON.stringify(revealScript, null, 2));

  console.error('');
  console.error(`relay           ${handles.relay.baseUrl}`);
  console.error(`resolver        ${handles.resolver.baseUrl}`);
  console.error(`events token    ${args.againstProd ? '(production — fetch from server)' : handles.eventsToken}`);
  console.error(`monitor keys    ${args.monitorKeysOut}`);
  console.error(`reveal script   ${args.scriptOut}`);
  console.error(`mode            ${modeLabel(args.onChain, args.againstProd)}`);
  console.error(`agents          ${handles.agentsByRef.size}`);
  console.error('');
  console.error('step 1 — in a second terminal, run:');
  console.error('');
  console.error(
    `  pnpm --filter scut-monitor run dev -- --relay ${handles.relay.baseUrl} --token '${args.eventsToken}' --keys ${args.monitorKeysOut} --resolver ${handles.resolver.baseUrl} --script ${args.scriptOut}`,
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
