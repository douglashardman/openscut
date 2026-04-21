import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_BIN = resolve(__dirname, '..', 'dist', 'index.js');

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

async function runCli(args: readonly string[], env: NodeJS.ProcessEnv): Promise<RunResult> {
  return new Promise((res, rej) => {
    const child = spawn('node', [CLI_BIN, ...args], {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b) => (stdout += b.toString()));
    child.stderr.on('data', (b) => (stderr += b.toString()));
    child.on('error', rej);
    child.on('close', (code) => res({ code: code ?? -1, stdout, stderr }));
  });
}

describe('scut CLI — end-to-end', () => {
  let scutHome: string;
  let env: NodeJS.ProcessEnv;

  beforeEach(() => {
    scutHome = mkdtempSync(join(tmpdir(), 'scut-cli-e2e-'));
    env = { SCUT_HOME: scutHome };
  });

  afterEach(() => {
    rmSync(scutHome, { recursive: true, force: true });
  });

  it('--version prints the core version', async () => {
    const result = await runCli(['--version'], env);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('init → identity show produces a valid SII document', async () => {
    const init = await runCli(
      [
        'init',
        '--contract',
        '0x199b48e27a28881502b251b0068f388ce750feff',
        '--token-id',
        '42',
      ],
      env,
    );
    expect(init.code).toBe(0);
    expect(init.stdout).toContain('scut identity initialized');

    const show = await runCli(['identity', 'show', '--json'], env);
    expect(show.code).toBe(0);
    const doc = JSON.parse(show.stdout) as {
      siiVersion: number;
      agentRef: { tokenId: string; contract: string; chainId: number };
      keys: {
        signing: { algorithm: string; publicKey: string };
        encryption: { algorithm: string; publicKey: string };
      };
    };
    expect(doc.siiVersion).toBe(1);
    expect(doc.agentRef.tokenId).toBe('42');
    expect(doc.agentRef.contract).toBe('0x199b48e27a28881502b251b0068f388ce750feff');
    expect(doc.keys.signing.algorithm).toBe('ed25519');
    expect(doc.keys.encryption.algorithm).toBe('x25519');
  });

  it('relay add / list / remove round-trips', async () => {
    await runCli(
      ['init', '--contract', '0x199b48e27a28881502b251b0068f388ce750feff'],
      env,
    );

    const add = await runCli(['relay', 'add', 'relay.example.com', '--priority', '20'], env);
    expect(add.code).toBe(0);
    expect(add.stdout).toContain('added relay relay.example.com');

    const list = await runCli(['relay', 'list'], env);
    expect(list.stdout).toContain('relay.example.com');
    expect(list.stdout).toContain('20');

    const remove = await runCli(['relay', 'remove', 'relay.example.com'], env);
    expect(remove.code).toBe(0);

    const empty = await runCli(['relay', 'list'], env);
    expect(empty.stdout).toContain('no relays configured');
  });

  it('identity show fails with config exit code when no config exists', async () => {
    const result = await runCli(['identity', 'show'], env);
    expect(result.code).toBe(2); // EXIT.CONFIG
    expect(result.stderr).toContain('No config found');
  });

  it('refuses send without a valid scut URI', async () => {
    await runCli(
      ['init', '--contract', '0x199b48e27a28881502b251b0068f388ce750feff'],
      env,
    );
    const result = await runCli(['send', '0xNotAScutUri', 'hi'], env);
    expect(result.code).toBe(5); // EXIT.UNRESOLVABLE
  });
});
