/**
 * ERC-8004 on-chain registry backend for scut-resolver.
 *
 * Read-only client of the OpenPub ERC-8004 identity contract on Base
 * mainnet. Given an agent_id, the resolver calls the contract for the
 * agent's metadata URI, fetches the identity document from that URI,
 * validates it against identityDocumentSchema, and returns it.
 *
 * STUB: awaiting ABI and contract surface details from Doug. The
 * viem client is wired so only `lookup` needs to be filled in once
 * the contract function signature is known.
 */
import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import type { IdentityDocument } from '@openscut/core';
import type { Registry } from '../registry.js';

// We intentionally do not pin the client to the Base chain via viem/chains;
// readContract only needs a transport pointed at the Base RPC, and leaving
// chain unset keeps the PublicClient type generic for dependency injection
// in tests. If a future code path needs gas estimation or a Base-specific
// RPC method, reintroduce `chain: base` then.
export interface Erc8004RegistryOptions {
  contractAddress: Address;
  rpcUrl: string;
  /** Optional dependency-injected client for tests that mock readContract. */
  client?: PublicClient;
  /** Optional custom URI fetcher; defaults to global fetch with ipfs:// support. */
  fetchImpl?: typeof fetch;
}

export class Erc8004Registry implements Registry {
  private readonly client: PublicClient;
  private readonly contractAddress: Address;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: Erc8004RegistryOptions) {
    this.contractAddress = opts.contractAddress;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.client = opts.client ?? createPublicClient({ transport: http(opts.rpcUrl) });
  }

  async lookup(_agentId: string): Promise<IdentityDocument | undefined> {
    throw new Error(
      'Erc8004Registry.lookup is not yet implemented; awaiting ABI and contract surface details',
    );
  }
}
