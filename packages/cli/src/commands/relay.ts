import { Command } from 'commander';
import { loadConfig, saveConfig } from '../config.js';
import { EXIT, fail } from '../errors.js';

export function registerRelayCommand(program: Command): void {
  const group = program.command('relay').description('Manage the local relay preference list');

  group
    .command('add')
    .description('Add a relay to the local list (not published on-chain in v1)')
    .argument('<host>', 'relay hostname (or host:port)')
    .option('--priority <n>', 'MX-style priority; lower is preferred', (v) => Number(v), 10)
    .option('--protocols <csv>', 'comma-separated protocol list to advertise', 'scut/1')
    .action(async (host: string, opts: { priority?: number; protocols?: string }) => {
      const protocols = (opts.protocols ?? 'scut/1').split(',').map((s) => s.trim()).filter(Boolean);
      await addRelay(host, opts.priority ?? 10, protocols);
    });

  group
    .command('list')
    .description('Print the current relay preference list')
    .action(async () => {
      await listRelays();
    });

  group
    .command('remove')
    .description('Remove a relay by host')
    .argument('<host>', 'relay hostname to drop')
    .action(async (host: string) => {
      await removeRelay(host);
    });
}

async function addRelay(host: string, priority: number, protocols: string[]): Promise<void> {
  if (!host) fail('host is required', EXIT.GENERIC);
  const config = await loadConfig();
  const existing = config.relays.find((r) => r.host === host);
  if (existing) {
    fail(`relay ${host} is already in the list`, EXIT.GENERIC);
  }
  config.relays.push({ host, priority, protocols });
  config.relays.sort((a, b) => a.priority - b.priority);
  await saveConfig(config);
  console.log(`added relay ${host} (priority ${priority})`);
}

async function listRelays(): Promise<void> {
  const config = await loadConfig();
  if (config.relays.length === 0) {
    console.log('no relays configured');
    console.log('(recipients will see `relay.openscut.ai` as the default in your SII document)');
    return;
  }
  for (const relay of config.relays) {
    console.log(
      `  priority ${relay.priority.toString().padStart(3, ' ')}  ${relay.host}  [${relay.protocols.join(', ')}]`,
    );
  }
}

async function removeRelay(host: string): Promise<void> {
  const config = await loadConfig();
  const idx = config.relays.findIndex((r) => r.host === host);
  if (idx < 0) {
    fail(`relay ${host} is not in the list`, EXIT.GENERIC);
  }
  config.relays.splice(idx, 1);
  await saveConfig(config);
  console.log(`removed relay ${host}`);
}
