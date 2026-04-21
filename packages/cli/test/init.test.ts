import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInit } from '../src/commands/init.js';
import { loadConfig } from '../src/config.js';
import { loadKeys } from '../src/keys.js';
import { ScutCliError } from '../src/errors.js';

describe('scut init', () => {
  let dir: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scut-init-'));
    env = { SCUT_HOME: dir } as NodeJS.ProcessEnv;
    process.env.SCUT_HOME = dir;
  });

  afterEach(() => {
    delete process.env.SCUT_HOME;
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes config and keys with --contract + default token and chain', async () => {
    await runInit({
      contract: '0x199b48E27a28881502b251B0068F388Ce750feff',
    });
    expect(existsSync(join(dir, 'config.json'))).toBe(true);
    expect(existsSync(join(dir, 'keys.json'))).toBe(true);

    const config = await loadConfig(env);
    expect(config.agent_ref).toBe(
      'scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/1',
    );

    const keys = await loadKeys(join(dir, 'keys.json'));
    expect(keys.signing.algorithm).toBe('ed25519');
    expect(keys.encryption.algorithm).toBe('x25519');
  });

  it('accepts --agent-ref directly', async () => {
    await runInit({
      agentRef: 'scut://8453/0x0000000000000000000000000000000000001234/42',
    });
    const config = await loadConfig(env);
    expect(config.agent_ref).toBe(
      'scut://8453/0x0000000000000000000000000000000000001234/42',
    );
  });

  it('refuses to overwrite an existing config without --force', async () => {
    await runInit({ contract: '0x199b48e27a28881502b251b0068f388ce750feff' });
    await expect(
      runInit({ contract: '0x199b48e27a28881502b251b0068f388ce750feff' }),
    ).rejects.toBeInstanceOf(ScutCliError);
  });

  it('permits overwrite with --force', async () => {
    await runInit({ contract: '0x199b48e27a28881502b251b0068f388ce750feff' });
    await runInit({
      contract: '0x199b48e27a28881502b251b0068f388ce750feff',
      tokenId: '7',
      force: true,
    });
    const config = await loadConfig(env);
    expect(config.agent_ref).toBe(
      'scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/7',
    );
  });

  it('rejects a non-hex contract address', async () => {
    await expect(runInit({ contract: 'not-hex' })).rejects.toBeInstanceOf(ScutCliError);
  });

  it('writes keys with 0600 mode', async () => {
    await runInit({ contract: '0x199b48e27a28881502b251b0068f388ce750feff' });
    const mode = statSync(join(dir, 'keys.json')).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
