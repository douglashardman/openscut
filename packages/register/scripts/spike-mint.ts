/**
 * Spike: end-to-end mint-then-update pipeline against Base mainnet.
 *
 * 1. Generate Ed25519 + X25519 keys via @openscut/core.
 * 2. Mint into OpenSCUTRegistry with a placeholder URI.
 * 3. Parse the tokenId from the SCUTIdentityRegistered event.
 * 4. Construct the full SII document with the correct agentRef.tokenId.
 * 5. Encode as a data: URI and call updateIdentityURI.
 * 6. Resolve via https://resolver.openscut.ai and confirm the round-trip.
 *
 * No Pinata. No service. No persistence. The point is to validate
 * the on-chain pipeline against live mainnet before wrapping the
 * service around it.
 *
 * Run:
 *   pnpm --filter scut-register spike:mint
 *
 * Requires .env.local at the repo root containing:
 *   SCUT_DEPLOYER_PRIVATE_KEY=0x...
 */
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
import {
  generateSigningKeypair,
  generateEncryptionKeypair,
  formatScutUri,
} from '@openscut/core';
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_RPC_URL,
  REGISTRY_ABI,
  REGISTRY_ADDRESS,
  RELAY_HOST,
  RESOLVER_URL,
} from '../src/abi.js';

const PLACEHOLDER_URI = 'data:application/json;base64,eyJzcGlrZSI6dHJ1ZX0=';
// {"spike":true} — non-empty, identifiable, gets replaced by the
// real SII data: URI in step 5. The contract refuses empty strings;
// any non-empty string passes the constructor's only validation.

interface SiiDocument {
  siiVersion: 1;
  agentRef: { chainId: number; contract: string; tokenId: string };
  keys: {
    signing: { algorithm: 'ed25519'; publicKey: string };
    encryption: { algorithm: 'x25519'; publicKey: string };
  };
  relays: { host: string; priority: number; protocols: string[] }[];
  capabilities: string[];
  displayName: string;
  updatedAt: string;
}

async function main(): Promise<void> {
  const privateKey = process.env.SCUT_DEPLOYER_PRIVATE_KEY;
  if (!privateKey || !privateKey.startsWith('0x')) {
    throw new Error(
      'SCUT_DEPLOYER_PRIVATE_KEY missing or malformed. ' +
        'Drop a 0x-prefixed key into .env.local at the repo root.',
    );
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const transport = http(BASE_RPC_URL);
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({ chain: base, transport, account });

  console.log('--- spike-mint ---');
  console.log('account:        ', account.address);
  console.log('registry:       ', REGISTRY_ADDRESS);
  console.log('chain id:       ', BASE_MAINNET_CHAIN_ID);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log('balance (wei):  ', balance.toString());
  console.log('balance (ETH):  ', (Number(balance) / 1e18).toFixed(8));

  // Step 1: generate the agent's keypairs.
  const [signing, encryption] = await Promise.all([
    generateSigningKeypair(),
    generateEncryptionKeypair(),
  ]);
  console.log('\nstep 1: generated keypairs');
  console.log('  ed25519 pub:  ', signing.publicKey);
  console.log('  x25519 pub:   ', encryption.publicKey);

  // Step 2: mint with a placeholder URI, OR resume an existing
  // orphan token (one that was minted by a previous run that
  // crashed before the update step).
  let tokenId: bigint;
  let mintHash: Hash | null = null;
  const existing = process.env.SPIKE_EXISTING_TOKEN_ID;
  if (existing) {
    tokenId = BigInt(existing);
    console.log('\nstep 2: resuming existing orphan token');
    console.log('  tokenId:      ', tokenId.toString());
  } else {
    console.log('\nstep 2: mint with placeholder URI');
    console.log('  uri:          ', PLACEHOLDER_URI);
    mintHash = await walletClient.writeContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'mint',
      args: [account.address, PLACEHOLDER_URI],
    });
    console.log('  tx submitted: ', mintHash);
    const mintReceipt = await publicClient.waitForTransactionReceipt({ hash: mintHash });
    console.log('  block:        ', mintReceipt.blockNumber.toString());
    console.log('  status:       ', mintReceipt.status);
    console.log('  gas used:     ', mintReceipt.gasUsed.toString());
    if (mintReceipt.status !== 'success') {
      throw new Error(`mint transaction reverted: ${mintHash}`);
    }

    // Step 3: parse the tokenId from the SCUTIdentityRegistered event.
    tokenId = parseRegisteredTokenId(mintReceipt.logs);
    console.log('\nstep 3: parsed tokenId from logs');
    console.log('  tokenId:      ', tokenId.toString());
  }

  // Public Base RPC is load-balanced; backends can lag the just-mined
  // mint by a block or two. Poll ownerOf(tokenId) until it returns
  // our address before proceeding so the next tx's pre-flight
  // simulation doesn't hit a stale backend and revert with
  // ERC721NonexistentToken.
  console.log('\nstep 3b: wait for ownerOf(tokenId) to propagate');
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const owner = (await publicClient.readContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'ownerOf',
        args: [tokenId],
      })) as Address;
      if (owner.toLowerCase() === account.address.toLowerCase()) {
        console.log('  owner visible after', attempt + 1, 'attempt(s)');
        break;
      }
    } catch {
      // ERC721NonexistentToken from a stale backend; keep polling.
    }
    await new Promise((r) => setTimeout(r, 1500));
    if (attempt === 19) throw new Error('ownerOf never converged');
  }

  const agentRef = {
    chainId: BASE_MAINNET_CHAIN_ID,
    contract: REGISTRY_ADDRESS.toLowerCase(),
    tokenId: tokenId.toString(),
  };
  const scutUri = formatScutUri(agentRef);
  console.log('  scut uri:     ', scutUri);

  // Step 4: build the full SII document with the correct agentRef.
  const siiDoc: SiiDocument = {
    siiVersion: 1,
    agentRef,
    keys: {
      signing: { algorithm: 'ed25519', publicKey: signing.publicKey },
      encryption: { algorithm: 'x25519', publicKey: encryption.publicKey },
    },
    relays: [{ host: RELAY_HOST, priority: 0, protocols: ['https'] }],
    capabilities: ['spike-test'],
    displayName: 'garfield-spike-2026-04-28',
    updatedAt: new Date().toISOString(),
  };
  const siiJson = JSON.stringify(siiDoc);
  const finalUri =
    'data:application/json;base64,' + Buffer.from(siiJson, 'utf-8').toString('base64');
  console.log('\nstep 4: built SII document');
  console.log('  doc bytes:    ', siiJson.length);
  console.log('  uri bytes:    ', finalUri.length);

  // Step 5: updateIdentityURI to replace the placeholder.
  console.log('\nstep 5: updateIdentityURI to final URI');
  const updateHash: Hash = await walletClient.writeContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'updateIdentityURI',
    args: [tokenId, finalUri],
  });
  console.log('  tx submitted: ', updateHash);
  const updateReceipt = await publicClient.waitForTransactionReceipt({ hash: updateHash });
  console.log('  block:        ', updateReceipt.blockNumber.toString());
  console.log('  status:       ', updateReceipt.status);
  console.log('  gas used:     ', updateReceipt.gasUsed.toString());
  if (updateReceipt.status !== 'success') {
    throw new Error(`updateIdentityURI reverted: ${updateHash}`);
  }

  // Step 6: confirm via on-chain view that the URI is in fact updated.
  // Same load-balancer race as step 3b... poll until a backend with
  // the post-update state answers.
  console.log('\nstep 6: scutIdentityURI() readback (poll for convergence)');
  let onChainUri = '';
  for (let attempt = 0; attempt < 20; attempt++) {
    onChainUri = (await publicClient.readContract({
      address: REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'scutIdentityURI',
      args: [tokenId],
    })) as string;
    if (onChainUri === finalUri) {
      console.log('  matches after', attempt + 1, 'attempt(s)');
      break;
    }
    await new Promise((r) => setTimeout(r, 1500));
    if (attempt === 19) {
      throw new Error('on-chain URI never converged on what we wrote');
    }
  }

  // Step 7: resolve via the public resolver and confirm the document
  // we get back matches what we encoded.
  console.log('\nstep 7: resolve via resolver.openscut.ai');
  const resolveUrl =
    `${RESOLVER_URL}/scut/v1/resolve?ref=` + encodeURIComponent(scutUri);
  console.log('  url:          ', resolveUrl);
  const resp = await fetch(resolveUrl, { headers: { accept: 'application/json' } });
  console.log('  status:       ', resp.status);
  const body = await resp.json();
  if (resp.status !== 200) {
    console.log('  body:', JSON.stringify(body, null, 2));
    throw new Error(`resolver returned ${resp.status}`);
  }
  const resolved = (body as { document: SiiDocument }).document;
  const ok =
    resolved.agentRef.tokenId === tokenId.toString() &&
    resolved.keys.signing.publicKey === signing.publicKey &&
    resolved.keys.encryption.publicKey === encryption.publicKey;
  console.log('  round-trip ok:', ok);
  if (!ok) {
    console.log('  resolved:', JSON.stringify(resolved, null, 2));
    throw new Error('resolver returned a document that does not match what we wrote');
  }

  console.log('\n--- spike succeeded ---');
  if (mintHash) console.log('basescan mint:    https://basescan.org/tx/' + mintHash);
  console.log('basescan update:  https://basescan.org/tx/' + updateHash);
  console.log('scut uri:         ' + scutUri);
}

function parseRegisteredTokenId(
  logs: readonly { address: string; data: string; topics: string[] }[],
): bigint {
  for (const log of logs) {
    if (log.address.toLowerCase() !== REGISTRY_ADDRESS.toLowerCase()) continue;
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
      // Not one of our events; keep scanning.
    }
  }
  throw new Error('SCUTIdentityRegistered event not found in mint receipt');
}

main().catch((err) => {
  console.error('\nspike failed:', err);
  process.exit(1);
});
