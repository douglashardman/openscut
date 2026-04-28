import { z } from 'zod';

const base64Pattern = /^[A-Za-z0-9+/=]+$/u;

export const ed25519PublicKeySchema = z
  .string()
  .regex(base64Pattern, 'must be base64')
  .refine((s) => Buffer.from(s, 'base64').length === 32, 'ed25519 public key must be 32 bytes');

export const x25519PublicKeySchema = z
  .string()
  .regex(base64Pattern, 'must be base64')
  .refine((s) => Buffer.from(s, 'base64').length === 32, 'x25519 public key must be 32 bytes');

const relayEntrySchema = z.object({
  host: z.string().min(1).max(253),
  priority: z.number().int().min(0).max(1000),
  protocols: z.array(z.string().min(1).max(32)).min(1).max(8),
});

export const registerRequestSchema = z.object({
  keys: z.object({
    signing: z.object({
      algorithm: z.literal('ed25519'),
      publicKey: ed25519PublicKeySchema,
    }),
    encryption: z.object({
      algorithm: z.literal('x25519'),
      publicKey: x25519PublicKeySchema,
    }),
  }),
  relays: z.array(relayEntrySchema).min(1).max(8).optional(),
  capabilities: z.array(z.string().min(1).max(64)).max(32).optional(),
  displayName: z.string().min(1).max(64).optional(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const updateRequestSchema = z.object({
  tokenId: z.string().regex(/^\d+$/u),
  newSiiDoc: z.unknown(),
  signature: z.string().regex(base64Pattern, 'must be base64'),
});

export type UpdateRequest = z.infer<typeof updateRequestSchema>;

export const transferRequestSchema = z.object({
  tokenId: z.string().regex(/^\d+$/u),
  newOwner: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/u, 'must be a 0x-prefixed 40-char hex address'),
  signature: z.string().regex(base64Pattern, 'must be base64'),
});

export type TransferRequest = z.infer<typeof transferRequestSchema>;
