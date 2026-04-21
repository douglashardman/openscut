import { readFileSync } from 'node:fs';
import { z } from 'zod';

const DEFAULT_BASE_RPC_URL = 'https://mainnet.base.org';
const DEFAULT_BASE_CHAIN_ID = 8453;

const configSchema = z.object({
  listen: z
    .object({
      host: z.string().default('0.0.0.0'),
      port: z.number().int().positive().default(8444),
    })
    .default({ host: '0.0.0.0', port: 8444 }),
  registry: z
    .object({
      backend: z.enum(['json-file', 'sii']).default('json-file'),
      path: z.string().optional(),
      contractAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/u, 'must be a 0x-prefixed 40-char hex address')
        .optional(),
      chainId: z.number().int().positive().default(DEFAULT_BASE_CHAIN_ID),
      rpcUrl: z.string().url().default(DEFAULT_BASE_RPC_URL),
      ipfsGateway: z.string().url().default('https://ipfs.io/ipfs/'),
    })
    .superRefine((registry, ctx) => {
      if (registry.backend === 'json-file' && !registry.path) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'registry.path is required when backend is "json-file"',
          path: ['path'],
        });
      }
      if (registry.backend === 'sii' && !registry.contractAddress) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'registry.contractAddress is required when backend is "sii"',
          path: ['contractAddress'],
        });
      }
    }),
  cache: z
    .object({
      ttlSeconds: z.number().int().positive().default(300),
    })
    .default({ ttlSeconds: 300 }),
});

export type ResolverConfig = z.infer<typeof configSchema>;

export { DEFAULT_BASE_CHAIN_ID, DEFAULT_BASE_RPC_URL };

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
    registry: {
      backend: env.SCUT_RESOLVER_REGISTRY_BACKEND,
      path: env.SCUT_RESOLVER_REGISTRY_PATH,
      contractAddress: env.SCUT_RESOLVER_CONTRACT_ADDRESS,
      chainId: env.SCUT_RESOLVER_CHAIN_ID
        ? Number(env.SCUT_RESOLVER_CHAIN_ID)
        : DEFAULT_BASE_CHAIN_ID,
      rpcUrl: env.SCUT_RESOLVER_BASE_RPC_URL ?? DEFAULT_BASE_RPC_URL,
      ipfsGateway: env.SCUT_RESOLVER_IPFS_GATEWAY,
    },
    cache: {
      ttlSeconds: env.SCUT_RESOLVER_CACHE_TTL_SECONDS
        ? Number(env.SCUT_RESOLVER_CACHE_TTL_SECONDS)
        : undefined,
    },
  });
}
