import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { runCli } from '../../src/v2/cli/main';
import { configure, failure, invoke, jsonRun, makeKb } from './helpers';

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('v2 CLI contract', () => {
  it('prints the version in text and JSON', async () => {
    expect(await invoke(root, ['--version'])).toEqual({ code: 0, stdout: 'knowlery 2.0.0-dev (kf 2.0)\n', stderr: '' });
    const result = await jsonRun(root, ['--version']);
    expect(result).toEqual({ contract: '2.0', ok: true, command: 'version', kit: '2.0.0-dev', kf: '2.0' });
  });

  it('prints help on stdout, but no command is an invocation error with usage on stderr', async () => {
    const help = await invoke(root, ['--help']);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('Usage:');
    expect(help.stderr).toBe('');
    expect((await jsonRun(root, ['--help'])).usage).toContain('Usage:');
    const empty = await invoke(root, []);
    expect(empty).toMatchObject({ code: 2, stdout: '' });
    expect(empty.stderr).toContain('Usage:');
    expect(empty.stderr).toContain('error [invalid_invocation]:');
    await failure(root, [], 'invalid_invocation', 2);
  });

  it.each([
    ['unknown'], ['inventory', '--bogus'], ['inventory', '--dir'], ['inventory', '--scope'],
    ['inventory', '--limit'], ['inventory', '--offset'], ['inventory', '--snapshot'],
    ['inventory', '--paths'], ['inventory', '--limit', '0'], ['inventory', '--offset', '-1'],
    ['inventory', '--limit', '2x'], ['inventory', '--offset', '1.5'], ['inventory', 'extra'],
  ])('rejects invalid invocation %j', async (...argv) => {
    await failure(root, argv, 'invalid_invocation', 2);
  });

  it('accepts global flags before and after the command and resolves --dir against io.cwd', async () => {
    const before = await jsonRun(root, ['--dir', '.', 'inventory']);
    const after = await jsonRun(root, ['inventory', '--dir', '.']);
    expect(after.items).toEqual(before.items);
    expect((await invoke(root, ['--dir', '.', '--json', 'inventory'])).code).toBe(0);
  });

  it('reports a missing directory, non-directory root, and missing config', async () => {
    await failure(root, ['--dir', 'missing', 'inventory'], 'not_found', 1);
    await failure(root, ['--dir', 'Notes/meeting.md', 'inventory'], 'not_found', 1);
    await rm(join(root, '.knowlery/config.json'));
    await failure(root, ['inventory'], 'not_found', 1);
    const result = await invoke(root, ['inventory']);
    expect(result).toMatchObject({ code: 1, stdout: '' });
    expect(result.stderr).toContain('not a knowledge base');
    expect(result.stderr).toContain('recovery:');
  });

  it('rejects broken JSON and every wrong config field type', async () => {
    await writeFile(join(root, '.knowlery/config.json'), '{broken');
    await failure(root, ['inventory'], 'invalid_config', 1);
    for (const config of [null, [], 'text', {}, { kf: 2 }, { kf: '2.0', ignore: 'x' }, { kf: '2.0', ignore: [3] }, { kf: '2.0', ignore: null }, { kf: '2.0', mcp: [] }, { kf: '2.0', mcp: null }, { kf: '2.0', mcp: { raw: 'yes' } }]) {
      await configure(root, config);
      await failure(root, ['inventory'], 'invalid_config', 1);
    }
  });

  it('rejects unsupported schema but ignores unknown keys and accepts mcp.raw false', async () => {
    await configure(root, { kf: '3.0' });
    await failure(root, ['inventory'], 'unsupported_schema', 1);
    await configure(root, { kf: '2.0', future: 123, mcp: { raw: false, other: 'ignored' } });
    expect((await jsonRun(root)).counts.total).toBe(5);
  });

  it('converts an unexpected filesystem exception to internal', async () => {
    await rm(join(root, '.knowlery/config.json'));
    await mkdir(join(root, '.knowlery/config.json'));
    await failure(root, ['inventory'], 'internal', 1);
    const text = await invoke(root, ['inventory']);
    expect(text.stdout).toBe('');
    expect(text.stderr).toContain('error [internal]:');
  });

  it('starts the real process entry with npx tsx', async () => {
    const configBefore = await readFile(join(root, '.knowlery/config.json'));
    const result = await promisify(execFile)('npx', ['--no-install', 'tsx', 'src/v2/cli/bin.ts', '--version'], { cwd: process.cwd(), timeout: 15000 });
    expect(result.stdout).toBe('knowlery 2.0.0-dev (kf 2.0)\n');
    expect(result.stderr).toBe('');
    expect(await readFile(join(root, '.knowlery/config.json'))).toEqual(configBefore);
  });

  it('does not require a knowledge base for version or help', async () => {
    let output = '';
    const code = await runCli(['--version'], { cwd: join(root, 'missing'), stdout: (text) => { output += text; }, stderr: () => { throw new Error('unexpected stderr'); } });
    expect(code).toBe(0);
    expect(output).toContain('2.0.0-dev');
  });
});
