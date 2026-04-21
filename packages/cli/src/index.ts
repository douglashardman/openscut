#!/usr/bin/env node
import { Command } from 'commander';
import { VERSION } from '@openscut/core';
import { registerAckCommand } from './commands/ack.js';
import { registerIdentityCommand } from './commands/identity.js';
import { registerInitCommand } from './commands/init.js';
import { registerPingCommand } from './commands/ping.js';
import { registerRecvCommand } from './commands/recv.js';
import { registerRelayCommand } from './commands/relay.js';
import { registerResolveCommand } from './commands/resolve.js';
import { registerSendCommand } from './commands/send.js';
import { EXIT, ScutCliError } from './errors.js';

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('scut')
    .description('SCUT command-line tool. Send, receive, and manage agent identity.')
    .version(VERSION);

  registerInitCommand(program);
  registerIdentityCommand(program);
  registerSendCommand(program);
  registerRecvCommand(program);
  registerAckCommand(program);
  registerRelayCommand(program);
  registerResolveCommand(program);
  registerPingCommand(program);

  // Disable commander's default error handling so we own exit codes.
  program.exitOverride((err) => {
    if (err.code === 'commander.help' || err.code === 'commander.version') {
      process.exit(EXIT.SUCCESS);
    }
    if (err.code === 'commander.helpDisplayed') {
      process.exit(EXIT.SUCCESS);
    }
    console.error(err.message);
    process.exit(EXIT.GENERIC);
  });

  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    if (err instanceof ScutCliError) {
      console.error(`scut: ${err.message}`);
      process.exit(err.exitCode);
    }
    console.error(`scut: unexpected error: ${(err as Error).message}`);
    process.exit(EXIT.GENERIC);
  }
}

main().catch((err) => {
  console.error('scut: fatal:', err);
  process.exit(EXIT.GENERIC);
});
