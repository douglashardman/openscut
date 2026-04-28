import { readFileSync } from 'node:fs';
import { z } from 'zod';

const DEFAULT_BASE_RPC_URL = 'https://mainnet.base.org';
const DEFAULT_BASE_CHAIN_ID = 8453;
const DEFAULT_REGISTRY_ADDRESS = '0x199b48E27a28881502b251B0068F388Ce750feff';

const configSchema = z.object({
  listen: z
    .object({
      host: z.string().default('0.0.0.0'),
      port: z.number().int().positive().default(8445),
    })
    .default({ host: '0.0.0.0', port: 8445 }),
  chain: z
    .object({
      chainId: z.number().int().positive().default(DEFAULT_BASE_CHAIN_ID),
      rpcUrl: z.string().url().default(DEFAULT_BASE_RPC_URL),
      contractAddress: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/u, 'must be a 0x-prefixed 40-char hex address')
        .default(DEFAULT_REGISTRY_ADDRESS),
      walletKey: z
        .string()
        .regex(/^0x[a-fA-F0-9]{64}$/u, 'must be a 0x-prefixed 64-char hex private key'),
      confirmations: z.number().int().min(1).max(10).default(1),
    }),
  storage: z
    .object({
      dbPath: z.string().default('/var/lib/scut/register.db'),
    })
    .default({ dbPath: '/var/lib/scut/register.db' }),
  rateLimit: z
    .object({
      perIpPerHour: z.number().int().positive().default(10),
      globalPerDay: z.number().int().positive().default(1000),
    })
    .default({ perIpPerHour: 10, globalPerDay: 1000 }),
  defaults: z
    .object({
      relayHost: z.string().default('relay.openscut.ai'),
    })
    .default({ relayHost: 'relay.openscut.ai' }),
});

export type RegisterConfig = z.infer<typeof configSchema>;

export { DEFAULT_BASE_CHAIN_ID, DEFAULT_BASE_RPC_URL, DEFAULT_REGISTRY_ADDRESS };

export function loadConfigFromFile(path: string): RegisterConfig {
  const raw = readFileSync(path, 'utf-8');
  return configSchema.parse(JSON.parse(raw));
}

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): RegisterConfig {
  const walletKey = env.SCUT_REGISTER_WALLET_KEY;
  if (!walletKey) {
    throw new Error(
      'SCUT_REGISTER_WALLET_KEY is required. Set it in /etc/scut/register.env ' +
        '(or .env.local for development).',
    );
  }
  return configSchema.parse({
    listen: {
      host: env.SCUT_REGISTER_HOST,
      port: env.SCUT_REGISTER_PORT ? Number(env.SCUT_REGISTER_PORT) : undefined,
    },
    chain: {
      chainId: env.SCUT_REGISTER_CHAIN_ID
        ? Number(env.SCUT_REGISTER_CHAIN_ID)
        : DEFAULT_BASE_CHAIN_ID,
      rpcUrl: env.SCUT_REGISTER_RPC_URL ?? DEFAULT_BASE_RPC_URL,
      contractAddress: env.SCUT_REGISTER_CONTRACT_ADDRESS ?? DEFAULT_REGISTRY_ADDRESS,
      walletKey,
      confirmations: env.SCUT_REGISTER_CONFIRMATIONS
        ? Number(env.SCUT_REGISTER_CONFIRMATIONS)
        : undefined,
    },
    storage: {
      dbPath: env.SCUT_REGISTER_DB_PATH,
    },
    rateLimit: {
      perIpPerHour: env.SCUT_REGISTER_RATE_LIMIT_PER_IP
        ? Number(env.SCUT_REGISTER_RATE_LIMIT_PER_IP)
        : undefined,
      globalPerDay: env.SCUT_REGISTER_RATE_LIMIT_GLOBAL
        ? Number(env.SCUT_REGISTER_RATE_LIMIT_GLOBAL)
        : undefined,
    },
    defaults: {
      relayHost: env.SCUT_REGISTER_DEFAULT_RELAY,
    },
  });
}
