import { z } from 'zod';

export const envelopeSchema = z.object({
  protocol_version: z.literal(1),
  envelope_id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  sent_at: z.string().min(1),
  ttl_seconds: z.number().int().positive(),
  ciphertext: z.string().min(1),
  ephemeral_pubkey: z.string().min(1),
  signature: z.string().min(1),
  v2_reserved: z
    .object({
      ratchet_state: z.null(),
      relay_path: z.null(),
      recipient_hint: z.null(),
      attachments: z.array(z.unknown()).length(0),
      recipient_set: z.null(),
    })
    .strict(),
});

export const ackRequestSchema = z.object({
  envelope_ids: z.array(z.string().min(1)).min(1),
});
