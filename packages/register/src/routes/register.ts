import type { FastifyInstance } from 'fastify';
import {
  encodeSiiDocumentToDataUri,
  formatScutUri,
  type SiiDocument,
} from '@openscut/core';
import { registerRequestSchema } from '../schemas.js';
import type { RegisterDb } from '../db.js';
import type { RegisterConfig } from '../config.js';
import type { RegistryClient } from '../registry-client.js';

export interface RegisterDeps {
  config: RegisterConfig;
  db: RegisterDb;
  registry: RegistryClient;
}

export function registerRegisterRoute(app: FastifyInstance, deps: RegisterDeps): void {
  app.post('/scut/v1/register', async (req, reply) => {
    const parsed = registerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: 'invalid request body', details: parsed.error.flatten() });
    }
    const body = parsed.data;

    if (body.displayName) {
      const dailyForName = deps.db.countByDisplayNameToday(body.displayName);
      if (dailyForName >= 1) {
        return reply
          .code(429)
          .send({ error: 'display name already used today', displayName: body.displayName });
      }
    }
    const globalToday = deps.db.countToday();
    if (globalToday >= deps.config.rateLimit.globalPerDay) {
      return reply
        .code(503)
        .send({ error: 'global daily registration cap reached, try tomorrow' });
    }

    const relays = body.relays ?? [
      { host: deps.config.defaults.relayHost, priority: 0, protocols: ['https'] },
    ];
    const capabilities = body.capabilities ?? [];

    const partialDoc = {
      siiVersion: 1 as const,
      keys: body.keys,
      relays,
      capabilities,
      ...(body.displayName ? { displayName: body.displayName } : {}),
    };

    let mintResult;
    try {
      mintResult = await deps.registry.mintPlaceholder();
    } catch (err) {
      req.log.error({ err }, 'mint placeholder failed');
      return reply
        .code(502)
        .send({ error: 'on-chain mint failed', detail: (err as Error).message });
    }
    // Build the real SII doc with the correct agentRef.tokenId, then
    // update the on-chain URI to the real document.
    const siiDoc: SiiDocument = {
      ...partialDoc,
      agentRef: {
        chainId: deps.config.chain.chainId,
        contract: deps.config.chain.contractAddress.toLowerCase(),
        tokenId: mintResult.tokenId.toString(),
      },
      updatedAt: new Date().toISOString(),
    } as SiiDocument;
    const finalUri = encodeSiiDocumentToDataUri(siiDoc);

    let updateTxHash;
    try {
      updateTxHash = await deps.registry.updateIdentity(mintResult.tokenId, finalUri);
    } catch (err) {
      req.log.error(
        { err, tokenId: mintResult.tokenId.toString() },
        'updateIdentityURI to final URI failed; token left with placeholder',
      );
      return reply.code(502).send({
        error: 'on-chain update failed',
        detail: (err as Error).message,
        tokenId: mintResult.tokenId.toString(),
        mintTxHash: mintResult.mintTxHash,
      });
    }

    const ref = formatScutUri(siiDoc.agentRef);
    deps.db.insertRegistration({
      tokenId: mintResult.tokenId.toString(),
      ed25519PublicKey: body.keys.signing.publicKey,
      x25519PublicKey: body.keys.encryption.publicKey,
      displayName: body.displayName ?? null,
      createdAt: Math.floor(Date.now() / 1000),
      clientIp: req.ip ?? null,
      mintTxHash: mintResult.mintTxHash,
      lastUpdateTxHash: updateTxHash,
    });
    deps.db.incrementToday();

    return reply.code(201).send({
      ref,
      agentRef: siiDoc.agentRef,
      txHashes: { mint: mintResult.mintTxHash, update: updateTxHash },
      basescan: {
        mint: `https://basescan.org/tx/${mintResult.mintTxHash}`,
        update: `https://basescan.org/tx/${updateTxHash}`,
      },
      document: siiDoc,
    });
  });
}
