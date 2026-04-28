import type { FastifyInstance } from 'fastify';
import sodium from 'libsodium-wrappers';
import { transferRequestSchema } from '../schemas.js';
import type { RegisterDb } from '../db.js';
import type { RegistryClient } from '../registry-client.js';

export interface TransferDeps {
  db: RegisterDb;
  registry: RegistryClient;
}

const TRANSFER_CHALLENGE_PREFIX = 'scut/v1/transfer:';

export function registerTransferRoute(app: FastifyInstance, deps: TransferDeps): void {
  app.post('/scut/v1/transfer', async (req, reply) => {
    const parsed = transferRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'invalid request body', details: parsed.error.flatten() });
    }
    const { tokenId, newOwner, signature } = parsed.data;

    const row = deps.db.findByTokenId(tokenId);
    if (!row) {
      return reply
        .code(404)
        .send({ error: 'token not registered with this service', tokenId });
    }
    if (row.custodial === 0) {
      return reply
        .code(409)
        .send({ error: 'token already transferred to user custody', tokenId });
    }

    await sodium.ready;
    const challenge = `${TRANSFER_CHALLENGE_PREFIX}${tokenId}:${newOwner.toLowerCase()}`;
    const sigBytes = Buffer.from(signature, 'base64');
    const pubBytes = Buffer.from(row.ed25519PublicKey, 'base64');
    const valid = sodium.crypto_sign_verify_detached(
      sigBytes,
      Buffer.from(challenge, 'utf-8'),
      pubBytes,
    );
    if (!valid) {
      return reply
        .code(401)
        .send({ error: 'signature does not authorize this transfer', expectedChallenge: challenge });
    }

    let txHash;
    try {
      txHash = await deps.registry.transfer(
        BigInt(tokenId),
        newOwner.toLowerCase() as `0x${string}`,
      );
    } catch (err) {
      req.log.error({ err, tokenId, newOwner }, 'transferFrom on-chain call failed');
      return reply
        .code(502)
        .send({ error: 'on-chain transfer failed', detail: (err as Error).message });
    }

    deps.db.updateAfterMutation(tokenId, txHash, { custodial: 0 });

    return reply.code(200).send({
      tokenId,
      newOwner: newOwner.toLowerCase(),
      txHash,
      basescan: `https://basescan.org/tx/${txHash}`,
    });
  });
}
