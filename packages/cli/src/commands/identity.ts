import { Command } from 'commander';
import { parseScutUri, type SiiDocument } from '@openscut/core';
import { loadConfig } from '../config.js';
import { loadKeys } from '../keys.js';
import { EXIT, fail } from '../errors.js';

export function registerIdentityCommand(program: Command): void {
  const group = program.command('identity').description("Operate on this client's SII identity");

  group
    .command('show')
    .description('Print the SII document this client advertises (local config + keys)')
    .option('--json', 'Emit only the document JSON (no decoration)', false)
    .action(async (options: { json?: boolean }) => {
      await runShow(Boolean(options.json));
    });

  group
    .command('publish')
    .description('v1 placeholder: emit the SII document JSON to publish via wallet or admin portal')
    .action(async () => {
      await runPublish();
    });
}

async function buildDocument(): Promise<SiiDocument> {
  const config = await loadConfig();
  const keys = await loadKeys(config.keys_path);

  const agentRef = parseScutUri(config.agent_ref);
  if (!agentRef) {
    fail(`config agent_ref is not a valid scut:// URI`, EXIT.CONFIG);
  }

  const relays =
    config.relays.length > 0
      ? config.relays.map((r) => ({ ...r, protocols: r.protocols ?? ['scut/1'] }))
      : [{ host: 'relay.openscut.ai', priority: 10, protocols: ['scut/1'] }];

  return {
    siiVersion: 1,
    agentRef,
    keys: {
      signing: { algorithm: 'ed25519', publicKey: keys.signing.publicKey },
      encryption: { algorithm: 'x25519', publicKey: keys.encryption.publicKey },
    },
    relays,
    capabilities: ['scut/1'],
    updatedAt: new Date().toISOString(),
  };
}

async function runShow(jsonOnly: boolean): Promise<void> {
  const doc = await buildDocument();
  if (jsonOnly) {
    console.log(JSON.stringify(doc, null, 2));
    return;
  }
  console.log(`SII document for ${doc.agentRef.chainId}/${doc.agentRef.contract}/${doc.agentRef.tokenId}:`);
  console.log('');
  console.log(JSON.stringify(doc, null, 2));
}

async function runPublish(): Promise<void> {
  const doc = await buildDocument();
  console.error('v1 placeholder: `scut identity publish` does not write on-chain.');
  console.error('Host the following JSON at the URI referenced by your SII contract token,');
  console.error('or paste it into the OpenSCUT admin portal when that ships.');
  console.error('');
  console.log(JSON.stringify(doc, null, 2));
}
