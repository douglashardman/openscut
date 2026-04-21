import { describe, it } from 'vitest';
import { Erc8004Registry } from '../src/registry/erc8004.js';

/**
 * Test stubs for Erc8004Registry. Each test is marked TODO and
 * currently skipped — they will be written once the ABI and the
 * contract read-function signature are known.
 *
 * The unit-test philosophy for this backend:
 *   - Mock the RPC layer (viem PublicClient) via dependency injection.
 *     Never hit a real Base RPC endpoint in a unit test.
 *   - Mock the URI fetcher (fetchImpl) for both ipfs:// and https://
 *     paths. Never hit a real IPFS gateway or HTTP host.
 *   - The contract itself is assumed correct; our tests verify the
 *     resolver's behavior given a set of simulated contract responses.
 */
describe('Erc8004Registry', () => {
  it('can be constructed with a contract address and RPC URL', () => {
    const registry = new Erc8004Registry({
      contractAddress: '0x0000000000000000000000000000000000000000',
      rpcUrl: 'http://unused',
    });
    void registry;
  });

  it.todo('resolves a known agent_id to an identity document via the contract and URI fetcher');

  it.todo('returns undefined when the contract reports the agent_id is not registered');

  it.todo('surfaces RPC transport failures as errors (no silent undefined)');

  it.todo('fetches and returns an identity document from an ipfs:// metadata URI via gateway');

  it.todo('fetches and returns an identity document from an https:// metadata URI directly');

  it.todo('rejects an identity document whose agent_id field does not match the lookup key');

  it.todo('validates the fetched document against identityDocumentSchema and rejects malformed');

  it.todo('passes through a dependency-injected PublicClient for test mocking');

  it.todo('passes through a dependency-injected fetch implementation for test mocking');
});
