/**
 * ABI fragments for OpenSCUTRegistry. Hand-curated to the surface the
 * registration service actually uses; not the full ERC-721 surface.
 */
export const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'identityURI', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'updateIdentityURI',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'newURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'scutIdentityURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'event',
    name: 'SCUTIdentityRegistered',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'uri', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SCUTIdentityUpdated',
    inputs: [
      { name: 'tokenId', type: 'uint256', indexed: true },
      { name: 'uri', type: 'string', indexed: false },
    ],
  },
] as const;

export const BASE_MAINNET_CHAIN_ID = 8453;
export const REGISTRY_ADDRESS = '0x199b48E27a28881502b251B0068F388Ce750feff' as const;
export const BASE_RPC_URL = 'https://mainnet.base.org';
export const RESOLVER_URL = 'https://resolver.openscut.ai';
export const RELAY_HOST = 'relay.openscut.ai';
