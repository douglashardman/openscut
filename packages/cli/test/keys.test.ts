import { chmodSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadKeys, saveKeys, type KeyStore } from '../src/keys.js';
import { ScutCliError } from '../src/errors.js';

const sample: KeyStore = {
  signing: {
    algorithm: 'ed25519',
    publicKey: 'c2lnbmluZ19wdWJfYmFzZTY0X3BsYWNlaG9sZGVyX3ZhbHVlX29rX29r',
    privateKey: 'c2lnbmluZ19wcml2X2Jhc2U2NF9wbGFjZWhvbGRlcl92YWx1ZV9vcmVk',
  },
  encryption: {
    algorithm: 'x25519',
    publicKey: 'ZW5jcnlwdGlvbl9wdWJfYmFzZTY0X3BsYWNlaG9sZGVyX3ZhbHVl',
    privateKey: 'ZW5jcnlwdGlvbl9wcml2X2Jhc2U2NF9wbGFjZWhvbGRlcl92YWx1ZQ==',
  },
};

describe('keys file', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scut-keys-'));
    path = join(dir, 'keys.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves with mode 0600', async () => {
    await saveKeys(path, sample);
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('round-trips', async () => {
    await saveKeys(path, sample);
    const loaded = await loadKeys(path);
    expect(loaded).toEqual(sample);
  });

  it('refuses a keys file whose perms are world-readable', async () => {
    await saveKeys(path, sample);
    chmodSync(path, 0o644);
    const err = await loadKeys(path).catch((e) => e);
    expect(err).toBeInstanceOf(ScutCliError);
    expect((err as ScutCliError).message).toContain('600');
  });

  it('refuses malformed JSON', async () => {
    writeFileSync(path, 'not json', { mode: 0o600 });
    await expect(loadKeys(path)).rejects.toBeInstanceOf(ScutCliError);
  });

  it('refuses schema mismatch', async () => {
    writeFileSync(path, JSON.stringify({ signing: { algorithm: 'wrong' } }), { mode: 0o600 });
    await expect(loadKeys(path)).rejects.toBeInstanceOf(ScutCliError);
  });
});
