import { Command } from 'commander';
import {
  formatScutUri,
  generateEncryptionKeypair,
  generateSigningKeypair,
  isScutUri,
} from '@openscut/core';
import { configExists, saveConfig, scutHome, type ScutConfig } from '../config.js';
import { saveKeys, type KeyStore } from '../keys.js';
import { keysPath } from '../paths.js';
import { EXIT, fail } from '../errors.js';

export interface InitOptions {
  agentRef?: string;
  contract?: string;
  tokenId?: string;
  chainId?: string;
  resolver?: string;
  force?: boolean;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Generate a keypair and write ~/.scut/config.json and ~/.scut/keys.json')
    .option('--agent-ref <scut_uri>', 'Pre-existing scut:// URI this keypair is bound to')
    .option(
      '--contract <address>',
      'If --agent-ref is omitted: the SII contract address the identity will be minted against',
    )
    .option('--token-id <id>', 'If --agent-ref is omitted: the token id in that contract', '1')
    .option('--chain-id <id>', 'If --agent-ref is omitted: EIP-155 chain id', '8453')
    .option('--resolver <url>', 'Resolver URL to use for identity lookups', 'https://resolver.openscut.ai')
    .option('--force', 'Overwrite an existing ~/.scut/config.json if present')
    .action(async (options: InitOptions) => {
      await runInit(options);
    });
}

export async function runInit(options: InitOptions): Promise<void> {
  if (!options.force && (await configExists())) {
    fail(
      `~/.scut/config.json already exists. Pass --force to overwrite, or edit the file directly.`,
      EXIT.CONFIG,
    );
  }

  const agentRef = resolveAgentRef(options);

  const signing = await generateSigningKeypair();
  const encryption = await generateEncryptionKeypair();

  const keys: KeyStore = {
    signing: {
      algorithm: 'ed25519',
      publicKey: signing.publicKey,
      privateKey: signing.privateKey,
    },
    encryption: {
      algorithm: 'x25519',
      publicKey: encryption.publicKey,
      privateKey: encryption.privateKey,
    },
  };
  const keysFilePath = keysPath();
  await saveKeys(keysFilePath, keys);

  const config: ScutConfig = {
    agent_ref: agentRef,
    resolver: options.resolver ?? 'https://resolver.openscut.ai',
    keys_path: keysFilePath,
    relays: [],
  };
  const configFilePath = await saveConfig(config);

  console.log(`scut identity initialized in ${scutHome()}`);
  console.log(`  config:   ${configFilePath}`);
  console.log(`  keys:     ${keysFilePath} (0600)`);
  console.log(`  agentRef: ${agentRef}`);
  console.log('');
  console.log('Public keys (share these; publish as your SII document):');
  console.log(`  signing (ed25519):    ${signing.publicKey}`);
  console.log(`  encryption (x25519):  ${encryption.publicKey}`);
  console.log('');
  console.log(
    `To publish your identity on-chain, mint a token on an SII-compliant contract ` +
      `with a metadata URI pointing at a JSON document containing the two public keys ` +
      `above. See \`scut identity show\` to preview the document.`,
  );
}

function resolveAgentRef(options: InitOptions): string {
  if (options.agentRef) {
    if (!isScutUri(options.agentRef)) {
      fail('--agent-ref must be a valid scut:// URI', EXIT.CONFIG);
    }
    return options.agentRef;
  }
  if (!options.contract) {
    fail(
      'either --agent-ref or --contract must be provided; a scut identity is always bound to a contract + tokenId + chainId',
      EXIT.CONFIG,
    );
  }
  const contract = options.contract.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(contract)) {
    fail('--contract must be a 0x-prefixed 40-char hex address', EXIT.CONFIG);
  }
  const chainId = Number(options.chainId ?? '8453');
  if (!Number.isFinite(chainId) || chainId <= 0) {
    fail('--chain-id must be a positive integer', EXIT.CONFIG);
  }
  const tokenId = options.tokenId ?? '1';
  if (!/^\d+$/.test(tokenId)) {
    fail('--token-id must be a decimal integer', EXIT.CONFIG);
  }
  return formatScutUri({ contract, tokenId, chainId });
}
