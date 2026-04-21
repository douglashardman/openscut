import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { isScutUri } from '@openscut/core';
import { configPath, scutHome } from './paths.js';
import { EXIT, fail } from './errors.js';

const relaySchema = z.object({
  host: z.string().min(1),
  priority: z.number().int(),
  protocols: z.array(z.string()).default(['scut/1']),
});

export const configSchema = z.object({
  agent_ref: z
    .string()
    .refine((v) => isScutUri(v), 'agent_ref must be a valid scut:// URI'),
  resolver: z.string().url(),
  keys_path: z.string().min(1),
  relays: z.array(relaySchema).default([]),
});

export type ScutConfig = z.infer<typeof configSchema>;

export async function loadConfig(env?: NodeJS.ProcessEnv): Promise<ScutConfig> {
  const path = configPath(env);
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      fail(
        `No config found at ${path}. Run \`scut init\` first to create an identity.`,
        EXIT.CONFIG,
      );
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(`Config at ${path} is not valid JSON.`, EXIT.CONFIG);
  }
  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    fail(`Config at ${path} failed validation: ${issues}`, EXIT.CONFIG);
  }
  return result.data;
}

export async function saveConfig(config: ScutConfig, env?: NodeJS.ProcessEnv): Promise<string> {
  const path = configPath(env);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  return path;
}

export function configExists(env?: NodeJS.ProcessEnv): Promise<boolean> {
  return readFile(configPath(env))
    .then(() => true)
    .catch(() => false);
}

export { scutHome };
