import { createHash } from 'node:crypto';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, readlink, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { runCli } from '../../src/v2/cli/main';
import type { ErrorCode } from '../../src/v2/core/errors';
import type { InventoryResult, PathItem } from '../../src/v2/core/inventory';

export const fixture = join(process.cwd(), 'tests/v2/fixtures/kb');
export const basePaths = ['Archive/old.md', 'Finance/orders.csv', 'Notes/meeting.md', 'Notes/会议记录.txt', 'Projects/policy notes.txt'];
export type Response = InventoryResult & {
  contract: string;
  ok: boolean;
  command: string;
  kit: string;
  kf: string;
  usage: string;
  paths: PathItem[];
  error: { code: ErrorCode; message: string; recovery: string };
};

export async function makeKb(): Promise<string> {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'knowlery-v2-')));
  await cp(fixture, root, { recursive: true });
  await configure(root, { kf: '2.0' });
  return root;
}

export async function configure(root: string, value: unknown): Promise<void> {
  await mkdir(join(root, '.knowlery'), { recursive: true });
  await writeFile(join(root, '.knowlery/config.json'), JSON.stringify(value));
}

export function digest(bytes: string | Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export async function fileState(root: string): Promise<Record<string, { bytes: string; mtimeMs: number }>> {
  const state: Record<string, { bytes: string; mtimeMs: number }> = {};
  async function walk(rel: string): Promise<void> {
    if (rel === '.knowlery/cache' || rel.startsWith('.knowlery/cache/')) return;
    const path = join(root, rel);
    const info = await lstat(path);
    if (info.isSymbolicLink()) state[rel] = { bytes: await readlink(path), mtimeMs: info.mtimeMs };
    else if (info.isDirectory()) {
      for (const entry of (await readdir(path)).sort()) await walk(rel ? `${rel}/${entry}` : entry);
    } else state[rel] = { bytes: (await readFile(path)).toString('base64'), mtimeMs: info.mtimeMs };
  }
  await walk('');
  return state;
}

export async function invoke(root: string, argv: string[]) {
  const before = await fileState(root);
  let stdout = '';
  let stderr = '';
  const code = await runCli(argv, {
    stdout: (text) => { stdout += text; },
    stderr: (text) => { stderr += text; },
    cwd: root,
  });
  expect(await fileState(root)).toEqual(before);
  return { code, stdout, stderr };
}

export async function jsonRun(root: string, argv: string[] = ['inventory']): Promise<Response> {
  const result = await invoke(root, [...argv, '--json']);
  expect(result.code, result.stdout).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.trimEnd().split('\n')).toHaveLength(1);
  const data = JSON.parse(result.stdout) as Response;
  expect(data).toMatchObject({ contract: '2.0', ok: true });
  return data;
}

export async function failure(root: string, argv: string[], code: ErrorCode, exit: number): Promise<void> {
  const result = await invoke(root, [...argv, '--json']);
  expect(result.code).toBe(exit);
  expect(result.stderr).toBe('');
  expect(result.stdout.split('\n')).toHaveLength(2);
  expect(result.stdout.endsWith('\n')).toBe(true);
  const data = JSON.parse(result.stdout) as Response;
  expect(data).toMatchObject({ contract: '2.0', ok: false, error: { code } });
  expect(data.error.message.length).toBeGreaterThan(0);
  expect(data.error.recovery.length).toBeGreaterThan(0);
  expect(Object.keys(data).sort()).toEqual(['contract', 'error', 'ok']);
}
