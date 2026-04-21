import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import { parseScutUri, type SiiDocument } from '@openscut/core';
import type { Registry } from '../registry.js';
import { siiDocumentSchema, type AgentRef } from '../schema/sii.js';

export interface SiiRegistryOptions {
  /** EIP-155 chain id the resolver is reading from (e.g. 8453 for Base mainnet). */
  chainId: number;
  /** Default contract to read from when the caller supplies a bare token id. */
  contractAddress: Address;
  /** JSON-RPC endpoint for the chain. */
  rpcUrl: string;
  /** Optional dependency-injected viem client for tests. */
  client?: PublicClient;
  /** Optional custom fetch for URI retrieval. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Optional IPFS gateway. Applied to ipfs:// URIs. Default: https://ipfs.io/ipfs/ */
  ipfsGateway?: string;
}

const SII_ABI = [
  {
    name: 'scutIdentityURI',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
] as const;

/**
 * SII-aware registry. Given an AgentRef (or scut:// URI), calls
 * `scutIdentityURI` on the specified contract, fetches the returned
 * URI, validates against the SII document schema, and returns the
 * SII document. No adapter layer — the document shape that flows
 * upward IS the SII shape all the way to clients.
 */
export class SIIRegistry implements Registry {
  private readonly client: PublicClient;
  private readonly chainId: number;
  private readonly contractAddress: Address;
  private readonly fetchImpl: typeof fetch;
  private readonly ipfsGateway: string;

  constructor(opts: SiiRegistryOptions) {
    this.chainId = opts.chainId;
    this.contractAddress = opts.contractAddress.toLowerCase() as Address;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.ipfsGateway = (opts.ipfsGateway ?? 'https://ipfs.io/ipfs/').replace(/\/$/, '/');
    this.client = opts.client ?? createPublicClient({ transport: http(opts.rpcUrl) });
  }

  async lookupRef(ref: AgentRef): Promise<SiiDocument | undefined> {
    if (ref.chainId !== this.chainId) {
      throw new SIIRegistryError(
        `chainId ${ref.chainId} not supported by this resolver (configured for ${this.chainId})`,
        'chain_not_supported',
      );
    }

    let uri: string;
    try {
      uri = await this.client.readContract({
        address: ref.contract as Address,
        abi: SII_ABI,
        functionName: 'scutIdentityURI',
        args: [BigInt(ref.tokenId)],
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (/nonexistent|reverted/i.test(msg)) return undefined;
      throw new SIIRegistryError(`RPC readContract failed: ${msg}`, 'rpc_error');
    }

    if (uri === '') return undefined;

    const body = await this.fetchUri(uri);
    let parsed: SiiDocument;
    try {
      parsed = siiDocumentSchema.parse(JSON.parse(body)) as SiiDocument;
    } catch (err) {
      throw new SIIRegistryError(
        `SII document at ${uri} failed schema validation: ${(err as Error).message}`,
        'schema_invalid',
      );
    }

    if (
      parsed.agentRef.chainId !== ref.chainId ||
      parsed.agentRef.contract.toLowerCase() !== ref.contract.toLowerCase() ||
      parsed.agentRef.tokenId !== ref.tokenId
    ) {
      throw new SIIRegistryError(
        `SII document's agentRef does not match lookup triple`,
        'ref_mismatch',
      );
    }

    return parsed;
  }

  /**
   * Registry interface entry point. Accepts a scut:// URI or a bare
   * tokenId (which is resolved against the configured default
   * contract). Returns the SII document in its native camelCase
   * shape — no legacy bridging.
   */
  async lookup(ref: string): Promise<SiiDocument | undefined> {
    const parsed = parseScutUri(ref);
    const agentRef: AgentRef = parsed ?? {
      chainId: this.chainId,
      contract: this.contractAddress,
      tokenId: ref,
    };
    if (!parsed && !/^\d+$/.test(ref)) {
      throw new SIIRegistryError(
        `lookup expected a scut:// URI or a decimal token id, got ${ref}`,
        'bad_ref',
      );
    }
    return this.lookupRef(agentRef);
  }

  private async fetchUri(uri: string): Promise<string> {
    const resolved = this.resolveUriForFetch(uri);
    if (resolved.startsWith('data:')) {
      return decodeDataUri(resolved);
    }
    const res = await this.fetchImpl(resolved, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      throw new SIIRegistryError(
        `SII document fetch returned ${res.status} for ${uri}`,
        'fetch_error',
      );
    }
    return res.text();
  }

  private resolveUriForFetch(uri: string): string {
    if (uri.startsWith('ipfs://')) {
      return this.ipfsGateway + uri.slice('ipfs://'.length);
    }
    return uri;
  }
}

function decodeDataUri(uri: string): string {
  const comma = uri.indexOf(',');
  if (comma < 0) throw new SIIRegistryError('malformed data: URI', 'fetch_error');
  const header = uri.slice(5, comma);
  const payload = uri.slice(comma + 1);
  if (header.includes(';base64')) {
    return Buffer.from(payload, 'base64').toString('utf-8');
  }
  return decodeURIComponent(payload);
}

export type SIIRegistryErrorCode =
  | 'chain_not_supported'
  | 'rpc_error'
  | 'fetch_error'
  | 'schema_invalid'
  | 'ref_mismatch'
  | 'bad_ref';

export class SIIRegistryError extends Error {
  constructor(
    message: string,
    public readonly code: SIIRegistryErrorCode,
  ) {
    super(message);
    this.name = 'SIIRegistryError';
  }
}
