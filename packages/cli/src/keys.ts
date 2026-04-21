import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { EXIT, fail } from './errors.js';

export const keyStoreSchema = z.object({
  signing: z.object({
    algorithm: z.literal('ed25519'),
    publicKey: z.string().min(1),
    privateKey: z.string().min(1),
  }),
  encryption: z.object({
    algorithm: z.literal('x25519'),
    publicKey: z.string().min(1),
    privateKey: z.string().min(1),
  }),
});

export type KeyStore = z.infer<typeof keyStoreSchema>;

export async function saveKeys(path: string, keys: KeyStore): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(keys, null, 2) + '\n', { mode: 0o600 });
}

export async function loadKeys(path: string): Promise<KeyStore> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      fail(`Keys file not found at ${path}. Run \`scut init\` first.`, EXIT.CONFIG);
    }
    throw err;
  }

  // Reject world-readable key files with a clear warning rather than a silent
  // decrypt that trains the operator to ignore permission drift.
  if (process.platform !== 'win32') {
    const info = await stat(path);
    const mode = info.mode & 0o777;
    if (mode & 0o077) {
      fail(
        `Keys file at ${path} has permissions ${mode.toString(8)} — group/world-readable. ` +
          `Run: chmod 600 ${path}`,
        EXIT.CONFIG,
      );
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(`Keys file at ${path} is not valid JSON.`, EXIT.CONFIG);
  }
  const result = keyStoreSchema.safeParse(parsed);
  if (!result.success) {
    fail(`Keys file at ${path} failed validation.`, EXIT.CRYPTO);
  }
  return result.data;
}
