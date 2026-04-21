import { Command } from 'commander';
import { HttpResolverClient, ScutClient } from '@openscut/core';
import { loadConfig } from '../config.js';
import { loadKeys } from '../keys.js';
import { EXIT, fail } from '../errors.js';

export function registerAckCommand(program: Command): void {
  program
    .command('ack')
    .description('Acknowledge one or more envelopes so the relay can drop them')
    .argument('<envelope_ids...>', 'envelope ids to acknowledge')
    .action(async (envelopeIds: string[]) => {
      await runAck(envelopeIds);
    });
}

async function runAck(envelopeIds: string[]): Promise<void> {
  if (envelopeIds.length === 0) {
    fail('at least one envelope_id is required', EXIT.GENERIC);
  }
  const config = await loadConfig();
  const keys = await loadKeys(config.keys_path);
  const client = new ScutClient({
    agentRef: config.agent_ref,
    signingPrivateKey: keys.signing.privateKey,
    signingPublicKey: keys.signing.publicKey,
    encryptionPrivateKey: keys.encryption.privateKey,
    encryptionPublicKey: keys.encryption.publicKey,
    resolver: new HttpResolverClient(config.resolver),
    relays: config.relays.length > 0 ? config.relays.map((r) => r.host) : undefined,
  });
  const dropped = await client.ack(envelopeIds);
  if (dropped.length === 0) {
    console.log('no envelopes were dropped (unknown ids or not yours)');
    return;
  }
  console.log(`dropped ${dropped.length} envelope(s):`);
  for (const id of dropped) console.log(`  ${id}`);
}
