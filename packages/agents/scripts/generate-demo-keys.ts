#!/usr/bin/env tsx
/**
 * Generate the five demo agent keypairs for the OpenSCUT terminal
 * demo, then emit:
 *   - a keys file on disk (private + public keys; stays on the
 *     operator's machine, never committed, never shown to Garfield)
 *   - five public SII documents ready to upload to
 *     openscut.ai/registry/{1..5}.json
 *   - a stdout summary with only the public keys, safe to paste
 *     back to Garfield for SII-document cross-checking.
 *
 * Run:
 *   pnpm --filter @openscut/agents run keygen -- \
 *     --registry 0x199b48E27a28881502b251B0068F388Ce750feff \
 *     --chain-id 8453 \
 *     --keys-out ~/.scut/demo-keys.json \
 *     --docs-out ~/.scut/demo-sii-docs
 *
 * Idempotent: the script WILL overwrite existing files at the given
 * paths. Running it twice generates fresh keys; old keys are lost.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve as resolvePath } from 'node:path';
import { homedir } from 'node:os';
import {
  generateEncryptionKeypair,
  generateSigningKeypair,
} from '@openscut/core';

interface AgentSlot {
  tokenId: number;
  label: string;
}

const AGENTS: readonly AgentSlot[] = [
  { tokenId: 1, label: "Alice's assistant" },
  { tokenId: 2, label: "Bob's assistant" },
  { tokenId: 3, label: 'Delivery service' },
  { tokenId: 4, label: 'HVAC service' },
  { tokenId: 5, label: 'Kitchen contractor' },
];

interface CliArgs {
  registry: string;
  chainId: number;
  keysOut: string;
  docsOut: string;
  primaryRelay: string;
  issuerName: string;
  issuerUrl: string;
}

function expand(p: string): string {
  if (p.startsWith('~/')) return resolvePath(homedir(), p.slice(2));
  return resolvePath(p);
}

function parseArgs(argv: readonly string[]): CliArgs {
  const get = (flag: string, fallback?: string): string => {
    const idx = argv.indexOf(flag);
    if (idx < 0) {
      if (fallback !== undefined) return fallback;
      throw new Error(`missing required flag: ${flag}`);
    }
    const v = argv[idx + 1];
    if (!v) throw new Error(`${flag} requires a value`);
    return v;
  };
  const registry = get('--registry').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(registry)) {
    throw new Error('--registry must be a 0x-prefixed 40-char hex address');
  }
  return {
    registry,
    chainId: Number(get('--chain-id', '8453')),
    keysOut: expand(get('--keys-out')),
    docsOut: expand(get('--docs-out')),
    primaryRelay: get('--relay', 'relay.openscut.ai'),
    issuerName: get('--issuer-name', 'OpenSCUT Registry'),
    issuerUrl: get('--issuer-url', 'https://openscut.ai'),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  await mkdir(dirname(args.keysOut), { recursive: true });
  await mkdir(args.docsOut, { recursive: true });

  const keysFile: {
    chainId: number;
    contractAddress: string;
    generatedAt: string;
    agents: Array<{
      tokenId: number;
      label: string;
      agentRef: string;
      keys: {
        signing: { publicKey: string; privateKey: string };
        encryption: { publicKey: string; privateKey: string };
      };
    }>;
  } = {
    chainId: args.chainId,
    contractAddress: args.registry,
    generatedAt: new Date().toISOString(),
    agents: [],
  };

  for (const slot of AGENTS) {
    const signing = await generateSigningKeypair();
    const encryption = await generateEncryptionKeypair();
    const agentRef = `scut://${args.chainId}/${args.registry}/${slot.tokenId}`;

    keysFile.agents.push({
      tokenId: slot.tokenId,
      label: slot.label,
      agentRef,
      keys: {
        signing: { publicKey: signing.publicKey, privateKey: signing.privateKey },
        encryption: {
          publicKey: encryption.publicKey,
          privateKey: encryption.privateKey,
        },
      },
    });

    const siiDoc = {
      siiVersion: 1,
      agentRef: {
        contract: args.registry,
        tokenId: String(slot.tokenId),
        chainId: args.chainId,
      },
      keys: {
        signing: { algorithm: 'ed25519', publicKey: signing.publicKey },
        encryption: { algorithm: 'x25519', publicKey: encryption.publicKey },
      },
      relays: [{ host: args.primaryRelay, priority: 10, protocols: ['scut/1'] }],
      capabilities: ['scut/1'],
      displayName: slot.label,
      updatedAt: new Date().toISOString(),
      issuer: { name: args.issuerName, url: args.issuerUrl },
      v2Reserved: {
        ratchetSupported: false,
        onionSupported: false,
        groupSupported: false,
      },
    };

    const docPath = resolvePath(args.docsOut, `${slot.tokenId}.json`);
    await writeFile(docPath, JSON.stringify(siiDoc, null, 2) + '\n');
  }

  await writeFile(args.keysOut, JSON.stringify(keysFile, null, 2) + '\n');

  console.log('');
  console.log(`keys file (PRIVATE, stays with you): ${args.keysOut}`);
  console.log(`SII documents (public):              ${args.docsOut}/{1..5}.json`);
  console.log('');
  console.log('Public key summary — safe to paste to Garfield:');
  console.log('------------------------------------------------');
  for (const a of keysFile.agents) {
    console.log(`Agent ${a.tokenId} — ${a.label}`);
    console.log(`  agentRef:          ${a.agentRef}`);
    console.log(`  signing pubkey:    ${a.keys.signing.publicKey}`);
    console.log(`  encryption pubkey: ${a.keys.encryption.publicKey}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error('generate-demo-keys failed:', err);
  process.exit(1);
});
