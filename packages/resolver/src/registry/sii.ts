import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import type { IdentityDocument } from '@openscut/core';
import type { Registry } from '../registry.js';
import { siiDocumentSchema, type AgentRef, type SiiDocument } from '../schema/sii.js';

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
 * SII-aware registry. Given an AgentRef, calls scutIdentityURI on the
 * specified contract, fetches the returned URI, validates the returned
 * JSON against the SII document schema, and returns the document.
 *
 * Scope note: returns the SII document shape, not the legacy v0.1
 * IdentityDocument shape. The adapter layer that bridges SII documents
 * into the existing core IdentityDocument type lives in resolver/src/
 * registry.ts during the v0.1→v0.2 cascade; once the cascade lands,
 * the core IdentityDocument will be replaced by SiiDocument.
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
    this.ipfsGateway = (opts.ipfsGateway ?? 'https://ipfs.io/ipfs/').replace(/\/$/, '/') ;
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
      parsed = siiDocumentSchema.parse(JSON.parse(body));
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
   * Legacy Registry.lookup entry point. Accepts either a bare tokenId or
   * a scut:// URI; returns the SII document in the v0.1 IdentityDocument
   * shape (for backwards compatibility with the existing resolver route).
   *
   * During the v0.2 cascade, callers migrate to lookupRef and this
   * method goes away.
   */
  async lookup(agentId: string): Promise<IdentityDocument | undefined> {
    const ref = agentId.startsWith('scut://')
      ? parseScutUriOrThrow(agentId)
      : ({ chainId: this.chainId, contract: this.contractAddress, tokenId: agentId } as AgentRef);

    const doc = await this.lookupRef(ref);
    if (!doc) return undefined;
    return toLegacyIdentityDocument(doc);
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

function parseScutUriOrThrow(uri: string): AgentRef {
  const match = /^scut:\/\/(\d+)\/(0x[a-fA-F0-9]{40})\/(\d+)$/u.exec(uri);
  if (!match) {
    throw new SIIRegistryError(`invalid scut:// URI: ${uri}`, 'bad_ref');
  }
  return {
    chainId: Number(match[1]),
    contract: match[2]!.toLowerCase(),
    tokenId: match[3]!,
  };
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

/**
 * Transitional shape bridge: SII documents use camelCase and nest
 * agentRef, while the current core IdentityDocument is the v0.1
 * snake-case shape. Map the subset the existing resolver route and
 * clients need. The Day-3-afternoon cascade replaces
 * IdentityDocument with SiiDocument throughout.
 */
function toLegacyIdentityDocument(doc: SiiDocument): IdentityDocument {
  return {
    protocol_version: 1,
    agent_id: `scut://${doc.agentRef.chainId}/${doc.agentRef.contract}/${doc.agentRef.tokenId}`,
    keys: {
      signing: {
        algorithm: doc.keys.signing.algorithm,
        public_key: doc.keys.signing.publicKey,
      },
      encryption: {
        algorithm: doc.keys.encryption.algorithm,
        public_key: doc.keys.encryption.publicKey,
      },
    },
    relays: doc.relays,
    capabilities: doc.capabilities,
    updated_at: doc.updatedAt ?? new Date().toISOString(),
    v2_reserved: {
      ratchet_supported: doc.v2Reserved?.ratchetSupported ?? false,
      onion_supported: doc.v2Reserved?.onionSupported ?? false,
      group_supported: doc.v2Reserved?.groupSupported ?? false,
    },
  };
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
