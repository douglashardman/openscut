import { Command } from 'commander';
import { HttpResolverClient, ScutClient, type OpenedEnvelope } from '@openscut/core';
import { loadConfig } from '../config.js';
import { loadKeys } from '../keys.js';

export function registerRecvCommand(program: Command): void {
  program
    .command('recv')
    .description('Poll configured relays, decrypt incoming envelopes, print them')
    .option('--watch', 'long-poll: loop until SIGINT', false)
    .option('--interval-seconds <seconds>', 'poll interval when --watch is set', (v) => Number(v), 5)
    .option('--since <iso>', 'only fetch envelopes received after this ISO 8601 timestamp')
    .action(
      async (options: { watch?: boolean; intervalSeconds?: number; since?: string }) => {
        await runRecv(options);
      },
    );
}

async function runRecv(options: {
  watch?: boolean;
  intervalSeconds?: number;
  since?: string;
}): Promise<void> {
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

  let since: Date | undefined = options.since ? new Date(options.since) : undefined;

  const pollOnce = async (): Promise<void> => {
    const messages = await client.receive({ since });
    for (const msg of messages) printEnvelope(msg);
    if (messages.length > 0) {
      since = new Date();
    }
  };

  if (!options.watch) {
    await pollOnce();
    return;
  }

  const intervalMs = (options.intervalSeconds ?? 5) * 1000;
  process.on('SIGINT', () => {
    console.error('');
    console.error('scut recv: stopping');
    process.exit(0);
  });
  for (;;) {
    try {
      await pollOnce();
    } catch (err) {
      console.error(`scut recv: poll failed: ${(err as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function printEnvelope(msg: OpenedEnvelope): void {
  console.log('----- envelope -----');
  console.log(`  envelope_id: ${msg.envelopeId}`);
  console.log(`  from:        ${msg.from}`);
  console.log(`  to:          ${msg.to}`);
  console.log(`  sent_at:     ${msg.sentAt.toISOString()}`);
  console.log('');
  console.log(msg.body);
  console.log('');
}
