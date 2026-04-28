import type { FastifyInstance } from 'fastify';
import type { RegisterDb } from '../db.js';
import type { RegistryClient } from '../registry-client.js';

export interface HealthDeps {
  db: RegisterDb;
  registry: RegistryClient;
}

const TYPICAL_GAS_PER_REGISTRATION = 630_000n; // mint + update on data: URI

export function registerHealthRoute(app: FastifyInstance, deps: HealthDeps): void {
  app.get('/scut/v1/health', async (_req, reply) => {
    let balance: bigint;
    try {
      balance = await deps.registry.getBalance();
    } catch (err) {
      return reply
        .code(503)
        .send({ status: 'degraded', error: 'rpc unreachable', detail: (err as Error).message });
    }

    // Use a conservative gas-price assumption for the runway estimate.
    // 0.05 gwei = 5e7 wei. Real-world Base base fees are usually
    // lower; this errs on the side of underestimating runway.
    const conservativeGasPriceWei = 50_000_000n;
    const weiPerRegistration = TYPICAL_GAS_PER_REGISTRATION * conservativeGasPriceWei;
    const runway = weiPerRegistration === 0n ? 0n : balance / weiPerRegistration;

    return reply.code(200).send({
      status: 'ok',
      wallet: {
        address: deps.registry.account.address,
        balanceWei: balance.toString(),
        balanceEth: (Number(balance) / 1e18).toFixed(8),
      },
      runway: {
        registrationsAtConservativeGas: Number(runway),
        gasPerRegistrationEstimate: TYPICAL_GAS_PER_REGISTRATION.toString(),
      },
      registrationsCount: deps.db.countAll(),
      version: '0.1.0',
    });
  });
}
