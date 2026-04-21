import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, saveConfig, type ScutConfig } from '../src/config.js';
import { ScutCliError } from '../src/errors.js';

describe('config round-trip', () => {
  let dir: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scut-cli-'));
    env = { SCUT_HOME: dir } as NodeJS.ProcessEnv;
    process.env.SCUT_HOME = dir;
  });

  afterEach(() => {
    delete process.env.SCUT_HOME;
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves and loads a config', async () => {
    const config: ScutConfig = {
      agent_ref: 'scut://8453/0x199b48e27a28881502b251b0068f388ce750feff/1',
      resolver: 'https://resolver.openscut.ai',
      keys_path: join(dir, 'keys.json'),
      relays: [{ host: 'relay.openscut.ai', priority: 10, protocols: ['scut/1'] }],
    };
    await saveConfig(config);
    const loaded = await loadConfig(env);
    expect(loaded).toEqual(config);
  });

  it('rejects a non-scut agent_ref', async () => {
    const bad = {
      agent_ref: '0xNotAScutUri',
      resolver: 'https://resolver.openscut.ai',
      keys_path: join(dir, 'keys.json'),
      relays: [],
    } as unknown as ScutConfig;
    await saveConfig(bad);
    await expect(loadConfig(env)).rejects.toBeInstanceOf(ScutCliError);
  });

  it('surfaces ENOENT as a CONFIG exit code', async () => {
    const other = mkdtempSync(join(tmpdir(), 'scut-cli-empty-'));
    try {
      const err = await loadConfig({ SCUT_HOME: other } as NodeJS.ProcessEnv).catch((e) => e);
      expect(err).toBeInstanceOf(ScutCliError);
      expect((err as ScutCliError).exitCode).toBe(2);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });
});
