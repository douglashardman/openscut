import { Command } from 'commander';
import { HttpResolverClient, isScutUri, ScutClient } from '@openscut/core';
import { loadConfig } from '../config.js';
import { loadKeys } from '../keys.js';
import { EXIT, fail } from '../errors.js';

export function registerPingCommand(program: Command): void {
  program
    .command('ping')
    .description('Send a timestamped test message and measure relay-accept round trip')
    .argument('<scut_uri>', 'recipient scut:// URI')
    .action(async (ref: string) => {
      await runPing(ref);
    });
}

async function runPing(ref: string): Promise<void> {
  if (!isScutUri(ref)) fail(`${ref} is not a valid scut:// URI`, EXIT.UNRESOLVABLE);
  const config = await loadConfig();
  const keys = await loadKeys(config.keys_path);
  const client = new ScutClient({
    agentRef: config.agent_ref,
    signingPrivateKey: keys.signing.privateKey,
    signingPublicKey: keys.signing.publicKey,
    encryptionPrivateKey: keys.encryption.privateKey,
    encryptionPublicKey: keys.encryption.publicKey,
    resolver: new HttpResolverClient(config.resolver),
  });
  const body = `ping at ${new Date().toISOString()}`;
  const start = Date.now();
  const result = await client.send({ to: ref, body, ttlSeconds: 60 });
  const elapsedMs = Date.now() - start;
  console.log(`ping ${ref}`);
  console.log(`  envelope_id: ${result.envelopeId}`);
  console.log(`  relay:       ${result.relay}`);
  console.log(`  round trip:  ${elapsedMs} ms (client → resolver → encrypt → relay → 202)`);
}
