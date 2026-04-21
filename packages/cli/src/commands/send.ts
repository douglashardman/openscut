import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { HttpResolverClient, isScutUri, ScutClient } from '@openscut/core';
import { loadConfig } from '../config.js';
import { loadKeys } from '../keys.js';
import { EXIT, fail } from '../errors.js';

export function registerSendCommand(program: Command): void {
  program
    .command('send')
    .description("Send a message to another agent")
    .argument('<scut_uri>', 'recipient scut:// URI')
    .argument('[message]', 'inline message text (omit when using --file)')
    .option('--file <path>', 'read the message body from a file instead of an argument')
    .option('--ttl-seconds <seconds>', 'envelope TTL', (v) => Number(v))
    .action(
      async (
        ref: string,
        message: string | undefined,
        options: { file?: string; ttlSeconds?: number },
      ) => {
        await runSend(ref, message, options);
      },
    );
}

async function runSend(
  ref: string,
  inlineMessage: string | undefined,
  options: { file?: string; ttlSeconds?: number },
): Promise<void> {
  if (!isScutUri(ref)) {
    fail(`${ref} is not a valid scut:// URI`, EXIT.UNRESOLVABLE);
  }

  const body = await resolveBody(inlineMessage, options.file);

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

  try {
    const result = await client.send({ to: ref, body, ttlSeconds: options.ttlSeconds });
    console.log(`sent to ${ref}`);
    console.log(`  envelope_id: ${result.envelopeId}`);
    console.log(`  relay:       ${result.relay}`);
    console.log(`  stored_at:   ${result.storedAt}`);
    if (result.idempotent) console.log('  (idempotent: relay already had this envelope_id)');
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'not_found') fail(`recipient ${ref} is not registered`, EXIT.UNRESOLVABLE);
    if (code === 'no_relays') fail(`recipient has no relays`, EXIT.UNRESOLVABLE);
    if (code === 'all_relays_failed') {
      fail(`push failed across every relay in the recipient's list`, EXIT.NETWORK);
    }
    throw err;
  }
}

async function resolveBody(
  inline: string | undefined,
  filePath: string | undefined,
): Promise<string> {
  if (inline && filePath) {
    fail('pass either an inline message or --file, not both', EXIT.GENERIC);
  }
  if (filePath) {
    try {
      return await readFile(filePath, 'utf-8');
    } catch (err) {
      fail(`could not read --file ${filePath}: ${(err as Error).message}`, EXIT.GENERIC);
    }
  }
  if (inline === undefined || inline === '') {
    fail('message body is required (inline arg or --file)', EXIT.GENERIC);
  }
  return inline;
}
