import type { FastifyInstance } from 'fastify';
import { canonicalizeToBytes, encodeSiiDocumentToDataUri, type SiiDocument } from '@openscut/core';
import sodium from 'libsodium-wrappers';
import { updateRequestSchema } from '../schemas.js';
import type { RegisterDb } from '../db.js';
import type { RegistryClient } from '../registry-client.js';

export interface UpdateDeps {
  db: RegisterDb;
  registry: RegistryClient;
}

export function registerUpdateRoute(app: FastifyInstance, deps: UpdateDeps): void {
  app.post('/scut/v1/update', async (req, reply) => {
    const parsed = updateRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'invalid request body', details: parsed.error.flatten() });
    }
    const { tokenId, newSiiDoc, signature } = parsed.data;

    const row = deps.db.findByTokenId(tokenId);
    if (!row) {
      return reply
        .code(404)
        .send({ error: 'token not registered with this service', tokenId });
    }
    if (row.custodial === 0) {
      return reply.code(409).send({
        error: 'token has been transferred to user custody; updates must be made directly',
        tokenId,
      });
    }

    await sodium.ready;
    let valid = false;
    try {
      const canonical = canonicalizeToBytes(newSiiDoc);
      const sigBytes = Buffer.from(signature, 'base64');
      const pubBytes = Buffer.from(row.ed25519PublicKey, 'base64');
      valid = sodium.crypto_sign_verify_detached(sigBytes, canonical, pubBytes);
    } catch (err) {
      return reply
        .code(400)
        .send({ error: 'signature verification failed', detail: (err as Error).message });
    }
    if (!valid) {
      return reply.code(401).send({ error: 'signature does not match registered ed25519 key' });
    }

    const doc = newSiiDoc as SiiDocument;
    if (doc.agentRef?.tokenId !== tokenId) {
      return reply.code(400).send({
        error: 'newSiiDoc.agentRef.tokenId does not match the request tokenId',
        expected: tokenId,
        got: doc.agentRef?.tokenId,
      });
    }

    const finalUri = encodeSiiDocumentToDataUri(doc);
    let txHash;
    try {
      txHash = await deps.registry.updateIdentity(BigInt(tokenId), finalUri);
    } catch (err) {
      req.log.error({ err, tokenId }, 'updateIdentityURI on-chain call failed');
      return reply
        .code(502)
        .send({ error: 'on-chain update failed', detail: (err as Error).message });
    }

    const newPubkey = doc.keys?.signing?.publicKey;
    const newEnckey = doc.keys?.encryption?.publicKey;
    deps.db.updateAfterMutation(tokenId, txHash, {
      ed25519PublicKey: newPubkey,
      x25519PublicKey: newEnckey,
    });

    return reply.code(200).send({
      tokenId,
      txHash,
      basescan: `https://basescan.org/tx/${txHash}`,
    });
  });
}
