import { z } from 'zod';

/**
 * SII v1 identity document schema per SPEC.md §4.3.
 *
 * Camel-case throughout (siiVersion, publicKey, updatedAt, v2Reserved,
 * agentRef) to match the spec. This is intentionally distinct from the
 * v0.1 snake-case identityDocumentSchema — v0.1 has no deployed users
 * and is being retired alongside the SII pivot.
 */
export const agentRefSchema = z.object({
  contract: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/u, 'must be a 0x-prefixed 40-char hex address'),
  tokenId: z.string().regex(/^\d+$/u, 'must be a decimal token id'),
  chainId: z.number().int().positive(),
});

export const siiDocumentSchema = z.object({
  siiVersion: z.literal(1),
  agentRef: agentRefSchema,
  keys: z.object({
    signing: z.object({
      algorithm: z.literal('ed25519'),
      publicKey: z.string().min(1),
    }),
    encryption: z.object({
      algorithm: z.literal('x25519'),
      publicKey: z.string().min(1),
    }),
  }),
  relays: z
    .array(
      z.object({
        host: z.string().min(1),
        priority: z.number().int(),
        protocols: z.array(z.string()),
      }),
    )
    .min(1),
  capabilities: z.array(z.string()),
  displayName: z.string().optional(),
  updatedAt: z.string().optional(),
  issuer: z
    .object({
      name: z.string().optional(),
      url: z.string().url().optional(),
    })
    .optional(),
  v2Reserved: z
    .object({
      ratchetSupported: z.boolean(),
      onionSupported: z.boolean(),
      groupSupported: z.boolean(),
    })
    .optional(),
});

export type SiiDocument = z.infer<typeof siiDocumentSchema>;
export type AgentRef = z.infer<typeof agentRefSchema>;

/**
 * Parse a scut://<chainId>/<contract>/<tokenId> URI. Returns null on
 * any parse failure so callers can surface a 400 rather than crashing.
 */
export function parseScutUri(uri: string): AgentRef | null {
  const match = /^scut:\/\/(\d+)\/(0x[a-fA-F0-9]{40})\/(\d+)$/u.exec(uri);
  if (!match) return null;
  return {
    chainId: Number(match[1]),
    contract: match[2]!.toLowerCase(),
    tokenId: match[3]!,
  };
}

export function formatScutUri(ref: AgentRef): string {
  return `scut://${ref.chainId}/${ref.contract.toLowerCase()}/${ref.tokenId}`;
}
