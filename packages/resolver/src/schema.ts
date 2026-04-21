import { z } from 'zod';

export const identityDocumentSchema = z.object({
  protocol_version: z.literal(1),
  agent_id: z.string().min(1),
  keys: z.object({
    signing: z.object({
      algorithm: z.literal('ed25519'),
      public_key: z.string().min(1),
    }),
    encryption: z.object({
      algorithm: z.literal('x25519'),
      public_key: z.string().min(1),
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
  updated_at: z.string().min(1),
  v2_reserved: z.object({
    ratchet_supported: z.boolean(),
    onion_supported: z.boolean(),
    group_supported: z.boolean(),
  }),
});

export type ValidatedIdentityDocument = z.infer<typeof identityDocumentSchema>;
