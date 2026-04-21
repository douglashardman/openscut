import { readFileSync } from 'node:fs';
import type { OrchestratorMode, RevealScriptEntry } from './orchestrator.js';

export interface CliArgs {
  relay: string;
  token: string;
  keys: string;
  resolver: string;
  script: string | null;
  autoIntervalMs: number;
}

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

function readStringArg(argv: readonly string[], flag: string): string | null {
  const idx = argv.indexOf(flag);
  if (idx < 0) return null;
  const value = argv[idx + 1];
  if (!value) throw new CliError(`${flag} requires a value`);
  return value;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const relay = readStringArg(argv, '--relay');
  const token = readStringArg(argv, '--token') ?? process.env.SCUT_MONITOR_EVENTS_TOKEN ?? null;
  const keys = readStringArg(argv, '--keys');
  const resolver = readStringArg(argv, '--resolver');
  const script = readStringArg(argv, '--script');
  const autoRaw = readStringArg(argv, '--auto-interval');

  if (!relay) throw new CliError('--relay <url> is required');
  if (!token) throw new CliError('--token <token> is required (or set SCUT_MONITOR_EVENTS_TOKEN)');
  if (!keys) throw new CliError('--keys <path> is required');
  if (!resolver) throw new CliError('--resolver <url> is required');

  const autoIntervalMs = autoRaw ? Number(autoRaw) : 10_000;
  if (!Number.isFinite(autoIntervalMs) || autoIntervalMs <= 0) {
    throw new CliError('--auto-interval must be a positive number of milliseconds');
  }

  return { relay, token, keys, resolver, script, autoIntervalMs };
}

export function loadRevealScript(path: string): RevealScriptEntry[] {
  const raw = readFileSync(path, 'utf-8');
  const parsed = JSON.parse(raw) as { reveals?: RevealScriptEntry[] } | RevealScriptEntry[];
  const entries = Array.isArray(parsed) ? parsed : parsed.reveals ?? [];
  for (const entry of entries) {
    if (typeof entry.at_ms_from_start !== 'number') {
      throw new CliError('reveal script entry missing at_ms_from_start');
    }
  }
  return entries;
}

export function buildMode(args: CliArgs): OrchestratorMode {
  if (args.script) {
    return {
      kind: 'script',
      script: loadRevealScript(args.script),
      startedAt: Date.now(),
    };
  }
  return { kind: 'auto', intervalMs: args.autoIntervalMs };
}
