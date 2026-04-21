import { readFileSync } from 'node:fs';
import { z } from 'zod';

const configSchema = z.object({
  listen: z
    .object({
      host: z.string().default('0.0.0.0'),
      port: z.number().int().positive().default(8444),
    })
    .default({ host: '0.0.0.0', port: 8444 }),
  registry: z.object({
    path: z.string(),
  }),
  cache: z
    .object({
      ttlSeconds: z.number().int().positive().default(300),
    })
    .default({ ttlSeconds: 300 }),
});

export type ResolverConfig = z.infer<typeof configSchema>;

export function loadConfigFromFile(path: string): ResolverConfig {
  const raw = readFileSync(path, 'utf-8');
  return configSchema.parse(JSON.parse(raw));
}

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ResolverConfig {
  return configSchema.parse({
    listen: {
      host: env.SCUT_RESOLVER_HOST,
      port: env.SCUT_RESOLVER_PORT ? Number(env.SCUT_RESOLVER_PORT) : undefined,
    },
    registry: { path: env.SCUT_RESOLVER_REGISTRY_PATH },
    cache: {
      ttlSeconds: env.SCUT_RESOLVER_CACHE_TTL_SECONDS
        ? Number(env.SCUT_RESOLVER_CACHE_TTL_SECONDS)
        : undefined,
    },
  });
}
