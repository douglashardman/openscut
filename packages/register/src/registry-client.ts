import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  type Address,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { REGISTRY_ABI } from './abi.js';

export interface RegistryClientOptions {
  rpcUrl: string;
  contractAddress: Address;
  walletKey: `0x${string}`;
  confirmations?: number;
}

export interface MintResult {
  tokenId: bigint;
  mintTxHash: Hash;
}

const PLACEHOLDER_URI = 'data:application/json;base64,e30=';
// {} ... non-empty (the contract refuses empty), minimal in size, gets
// replaced by the real SII data: URI on the update step.

export class RegistryClient {
  readonly account;
  readonly contractAddress: Address;
  readonly publicClient;
  readonly walletClient;
  private readonly confirmations: number;

  constructor(opts: RegistryClientOptions) {
    this.account = privateKeyToAccount(opts.walletKey);
    this.contractAddress = opts.contractAddress.toLowerCase() as Address;
    this.confirmations = opts.confirmations ?? 1;
    const transport = http(opts.rpcUrl);
    this.publicClient = createPublicClient({ chain: base, transport });
    this.walletClient = createWalletClient({ chain: base, transport, account: this.account });
  }

  /**
   * Mint with a placeholder URI. Returns the tokenId parsed from the
   * SCUTIdentityRegistered event and the mint tx hash. After this
   * resolves, ownerOf(tokenId) is observable to all RPC backends; it
   * is safe to issue a follow-up updateIdentityURI without seeing a
   * stale-backend ERC721NonexistentToken revert.
   */
  async mintPlaceholder(): Promise<MintResult> {
    const mintTxHash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: REGISTRY_ABI,
      functionName: 'mint',
      args: [this.account.address, PLACEHOLDER_URI],
    });
    const mintReceipt = await this.publicClient.waitForTransactionReceipt({
      hash: mintTxHash,
      confirmations: this.confirmations,
    });
    if (mintReceipt.status !== 'success') {
      throw new Error(`mint transaction reverted: ${mintTxHash}`);
    }
    const tokenId = parseRegisteredTokenId(mintReceipt.logs, this.contractAddress);
    await this.waitForOwnerVisible(tokenId);
    return { tokenId, mintTxHash };
  }

  async updateIdentity(tokenId: bigint, newUri: string): Promise<Hash> {
    const txHash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: REGISTRY_ABI,
      functionName: 'updateIdentityURI',
      args: [tokenId, newUri],
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: this.confirmations,
    });
    if (receipt.status !== 'success') {
      throw new Error(`updateIdentityURI reverted: ${txHash}`);
    }
    return txHash;
  }

  async transfer(tokenId: bigint, newOwner: Address): Promise<Hash> {
    const txHash = await this.walletClient.writeContract({
      address: this.contractAddress,
      abi: [
        {
          type: 'function',
          name: 'transferFrom',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'tokenId', type: 'uint256' },
          ],
          outputs: [],
        },
      ] as const,
      functionName: 'transferFrom',
      args: [this.account.address, newOwner, tokenId],
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: this.confirmations,
    });
    if (receipt.status !== 'success') {
      throw new Error(`transferFrom reverted: ${txHash}`);
    }
    return txHash;
  }

  async getBalance(): Promise<bigint> {
    return this.publicClient.getBalance({ address: this.account.address });
  }

  /**
   * Public load-balanced RPCs serve from multiple backends; some can
   * lag a fresh write by 1-2 blocks. Poll ownerOf until a backend
   * sees the just-minted token before issuing follow-up txs (whose
   * pre-flight simulation would otherwise revert with
   * ERC721NonexistentToken from a stale backend).
   */
  private async waitForOwnerVisible(tokenId: bigint): Promise<void> {
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const owner = (await this.publicClient.readContract({
          address: this.contractAddress,
          abi: REGISTRY_ABI,
          functionName: 'ownerOf',
          args: [tokenId],
        })) as Address;
        if (owner.toLowerCase() === this.account.address.toLowerCase()) return;
      } catch {
        // Stale backend... keep polling.
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error(`ownerOf(${tokenId}) never converged`);
  }
}

function parseRegisteredTokenId(
  logs: readonly { address: string; data: string; topics: string[] }[],
  contractAddress: Address,
): bigint {
  const lower = contractAddress.toLowerCase();
  for (const log of logs) {
    if (log.address.toLowerCase() !== lower) continue;
    try {
      const decoded = decodeEventLog({
        abi: REGISTRY_ABI,
        data: log.data as `0x${string}`,
        topics: log.topics as [signature: `0x${string}`, ...args: `0x${string}`[]],
      });
      if (decoded.eventName === 'SCUTIdentityRegistered') {
        return decoded.args.tokenId as bigint;
      }
    } catch {
      // not one of our events
    }
  }
  throw new Error('SCUTIdentityRegistered event not found in mint receipt');
}
