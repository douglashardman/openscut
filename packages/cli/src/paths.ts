import { homedir } from 'node:os';
import { resolve as resolvePath } from 'node:path';

export const SCUT_HOME_ENV = 'SCUT_HOME';

/** Default SCUT_HOME: ~/.scut. Overridable via SCUT_HOME env var for tests. */
export function scutHome(env: NodeJS.ProcessEnv = process.env): string {
  return env[SCUT_HOME_ENV] ?? resolvePath(homedir(), '.scut');
}

export function configPath(env?: NodeJS.ProcessEnv): string {
  return resolvePath(scutHome(env), 'config.json');
}

export function keysPath(env?: NodeJS.ProcessEnv): string {
  return resolvePath(scutHome(env), 'keys.json');
}
