import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const configSchema = z.object({
  listen: z
    .object({
      host: z.string().default('0.0.0.0'),
      port: z.number().int().positive().default(8443),
    })
    .default({ host: '0.0.0.0', port: 8443 }),
  database: z
    .object({
      path: z.string().default(':memory:'),
    })
    .default({ path: ':memory:' }),
  resolver: z.object({
    url: z.string().url(),
    cacheTtlSeconds: z.number().int().positive().default(300),
  }),
  limits: z
    .object({
      maxEnvelopeBytes: z.number().int().positive().default(102_400),
      maxTtlSeconds: z.number().int().positive().default(604_800),
      ratePerSenderPerMinute: z.number().int().positive().default(60),
      rateGlobalPerMinute: z.number().int().positive().default(60_000),
      pickupNonceWindowSeconds: z.number().int().positive().default(300),
      clockSkewSeconds: z.number().int().positive().default(300),
    })
    .default({
      maxEnvelopeBytes: 102_400,
      maxTtlSeconds: 604_800,
      ratePerSenderPerMinute: 60,
      rateGlobalPerMinute: 60_000,
      pickupNonceWindowSeconds: 300,
      clockSkewSeconds: 300,
    }),
  events: z.object({
    token: z.string().min(16, 'events token must be at least 16 chars'),
    heartbeatSeconds: z.number().int().positive().default(20),
  }),
  eviction: z
    .object({
      intervalSeconds: z.number().int().positive().default(60),
    })
    .default({ intervalSeconds: 60 }),
});

export type RelayConfig = z.infer<typeof configSchema>;

export function loadConfigFromFile(path: string): RelayConfig {
  const raw = readFileSync(path, 'utf-8');
  const parsed = parseYaml(raw) as unknown;
  return configSchema.parse(parsed);
}

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RelayConfig {
  return configSchema.parse({
    listen: {
      host: env.SCUT_RELAY_HOST,
      port: env.SCUT_RELAY_PORT ? Number(env.SCUT_RELAY_PORT) : undefined,
    },
    database: { path: env.SCUT_RELAY_DB },
    resolver: {
      url: env.SCUT_RELAY_RESOLVER_URL,
      cacheTtlSeconds: env.SCUT_RELAY_RESOLVER_CACHE_TTL
        ? Number(env.SCUT_RELAY_RESOLVER_CACHE_TTL)
        : undefined,
    },
    events: {
      token: env.SCUT_RELAY_EVENTS_TOKEN,
      heartbeatSeconds: env.SCUT_RELAY_EVENTS_HEARTBEAT
        ? Number(env.SCUT_RELAY_EVENTS_HEARTBEAT)
        : undefined,
    },
  });
}
