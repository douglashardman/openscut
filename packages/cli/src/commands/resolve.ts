import { Command } from 'commander';
import { HttpResolverClient, isScutUri } from '@openscut/core';
import { loadConfig } from '../config.js';
import { EXIT, fail } from '../errors.js';

export function registerResolveCommand(program: Command): void {
  program
    .command('resolve')
    .description('Fetch and print another agent\'s SII document from the configured resolver')
    .argument('<scut_uri>', 'scut:// URI of the agent to resolve')
    .option('--json', 'Emit only the document JSON', false)
    .action(async (ref: string, options: { json?: boolean }) => {
      await runResolve(ref, Boolean(options.json));
    });
}

async function runResolve(ref: string, jsonOnly: boolean): Promise<void> {
  if (!isScutUri(ref)) {
    fail(`${ref} is not a valid scut:// URI`, EXIT.UNRESOLVABLE);
  }
  const config = await loadConfig();
  const resolver = new HttpResolverClient(config.resolver);
  let doc;
  try {
    doc = await resolver.resolve(ref);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'not_found') {
      fail(`${ref} is not registered at ${config.resolver}`, EXIT.UNRESOLVABLE);
    }
    if (code === 'resolver_error') {
      fail(`resolver at ${config.resolver} failed: ${(err as Error).message}`, EXIT.NETWORK);
    }
    throw err;
  }
  if (jsonOnly) {
    console.log(JSON.stringify(doc, null, 2));
    return;
  }
  console.log(`Resolved ${ref} via ${config.resolver}:`);
  console.log('');
  console.log(JSON.stringify(doc, null, 2));
}
