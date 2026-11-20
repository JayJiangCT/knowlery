import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lstat, mkdir, readFile, readdir, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCli } from '../../src/v2/cli/main';
import type { ExtractResult } from '../../src/v2/cli/commands/extract';
import { readConfig } from '../../src/v2/core/config';
import { inventory } from '../../src/v2/core/inventory';
import { getExtraction, type ExtractionOptions } from '../../src/v2/core/extract';
import { cacheName } from '../../src/v2/core/extract/cache';
import { registry } from '../../src/v2/core/extract/registry';
import { txt } from '../../src/v2/core/extract/txt';
import { configure, digest, failure, fileState, invoke, jsonRun, makeKb } from './helpers';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});
let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function execute(argv: string[], options: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {}) {
  const before = await fileState(root);
  vi.mocked(readFile).mockClear();
  let stdout = '';
  let stderr = '';
  const code = await runCli([...argv, '--json'], { cwd: root, stdout: (text) => { stdout += text; }, stderr: (text) => { stderr += text; } }, options);
  const reads = vi.mocked(readFile).mock.calls.map((call) => String(call[0]));
  expect(code, stdout).toBe(0);
  expect(stderr).toBe('');
  expect(await fileState(root)).toEqual(before);
  const result = JSON.parse(stdout) as ExtractResult & { contract: string; ok: boolean; command: string };
  expect(result).toMatchObject({ contract: '2.0', ok: true, command: 'extract' });
  return { result, reads };
}

describe('v2 extract command', () => {
  it('extracts all sources and reads no source bytes on the second run', async () => {
    await writeFile(join(root, 'a.pdf'), 'dummy');
    const { result: first } = await execute(['extract', '--all']);
    expect(first).toEqual({ contract: '2.0', ok: true, command: 'extract',
      counts: { total: 6, ok: 5, partial: 0, unreadable: 1, too_large: 0, unavailable: 0 },
      work: { extracted: 6, cached: 0 },
      items: [{ path: 'a.pdf', format: 'pdf', sha256: digest('dummy'), state: 'unreadable', units: 0, problems: [{ code: 'parse_error', detail: 'Invalid PDF structure.' }] }], omitted: 0, warnings: [],
    });
    const { result: second, reads } = await execute(['extract', '--all']);
    expect(second.work).toEqual({ extracted: 0, cached: 6 });
    const sources = [...(await jsonRun(root)).items.map((item) => join(root, item.path))];
    expect(reads.filter((path) => sources.includes(path))).toEqual([]);
  });

  it('scopes to a folder, always lists a single file, and renders text counts and rows', async () => {
    const { result: folder } = await execute(['extract', 'Notes']);
    expect(folder.counts).toMatchObject({ total: 2, ok: 2 });
    expect(folder.items).toEqual([]);
    const { result: file } = await execute(['extract', 'Notes/meeting.md']);
    expect(file.counts).toMatchObject({ total: 1, ok: 1 });
    expect(file.items).toMatchObject([{ path: 'Notes/meeting.md', state: 'ok', units: 4 }]);
    const text = await invoke(root, ['extract', 'Notes/meeting.md']);
    expect(text.code).toBe(0);
    expect(text.stderr).toBe('');
    const lines = text.stdout.trimEnd().split('\n');
    expect(lines[0]).toBe('sources: 1  ok: 1  partial: 0  unreadable: 0  too_large: 0  unavailable: 0');
    expect(lines[1].split('\t')).toEqual(['Notes/meeting.md', 'markdown', file.items[0].sha256, 'ok', '4', '[]']);
  });

  it.each([['extract'], ['extract', '--all', 'Notes'], ['extract', 'Notes', '--all'], ['extract', 'Notes', 'Archive'],
    ['extract', '--scope', 'Notes'], ['extract', '--all', '--paths', 'Notes/meeting.md'], ['inventory', '--all'], ['--all']])('rejects invalid arguments %j with exit 2', async (argv) => {
    await failure(root, argv, 'invalid_invocation', 2);
  });

  it('rejects denied, missing and unsupported paths', async () => {
    await writeFile(join(root, 'a.bin'), 'unsupported');
    await failure(root, ['extract', 'wiki'], 'path_denied', 1);
    await failure(root, ['extract', 'wiki/record-preservation.md'], 'path_denied', 1);
    await failure(root, ['extract', 'a.bin'], 'extraction_unavailable', 1);
    await failure(root, ['extract', 'absent'], 'not_found', 1);
  });

  it('honours the injected registry with no txt extractor and exits 0', async () => {
    const withoutTxt = { ...registry };
    delete withoutTxt.txt;
    const { result } = await execute(['extract', 'Projects/policy notes.txt'], { registry: withoutTxt });
    expect(result.counts).toMatchObject({ total: 1, unavailable: 1 });
    expect(result.work).toEqual({ extracted: 0, cached: 0 });
    expect(result.items[0]).toMatchObject({ state: 'unavailable', units: 0, problems: [] });
    await expect(lstat(join(root, '.knowlery/cache/text'))).rejects.toThrow();
  });

  it('never reads or caches files above a lowered ceiling, including in --all', async () => {
    const { result, reads } = await execute(['extract', '--all'], { ceiling: 0 });
    expect(result.counts).toMatchObject({ total: 5, too_large: 5 });
    expect(result.work).toEqual({ extracted: 0, cached: 0 });
    expect(result.items.every((item) => item.sha256 === null && item.state === 'too_large')).toBe(true);
    expect(reads).toEqual([join(root, '.knowlery/config.json')]);
    await expect(lstat(join(root, '.knowlery/cache'))).rejects.toThrow();
    const single = await execute(['extract', 'Notes/meeting.md'], { ceiling: 0 });
    expect(single.result.items).toHaveLength(1);
    expect(single.reads).toEqual([join(root, '.knowlery/config.json')]);
  });

  it('reports partial and unreadable results without making the command fail', async () => {
    await writeFile(join(root, 'partial.csv'), 'a,b\n1,2\n3,"open');
    await writeFile(join(root, 'invalid.txt'), Buffer.from([0xff]));
    const { result } = await execute(['extract', '--all']);
    expect(result.counts).toMatchObject({ total: 7, ok: 5, partial: 1, unreadable: 1 });
    expect(result.items.map((item) => [item.path, item.state, item.problems[0].code])).toEqual([
      ['invalid.txt', 'unreadable', 'encoding'], ['partial.csv', 'partial', 'unterminated_quote'],
    ]);
    expect((await execute(['extract', '--all'])).result.work).toEqual({ extracted: 0, cached: 7 });
  });

  it('caps exceptional items at 50 in path order and counts omitted items', async () => {
    for (let i = 0; i < 65; i++) await writeFile(join(root, `${String(i).padStart(3, '0')}.pdf`), 'pdf');
    const { result } = await execute(['extract', '--all']);
    expect(result.counts).toMatchObject({ total: 70, unreadable: 65 });
    expect(result.items).toHaveLength(50);
    expect(result.omitted).toBe(15);
    expect(result.items.map((item) => item.path)).toEqual(Array.from({ length: 50 }, (_, i) => `${String(i).padStart(3, '0')}.pdf`));
  });

  it('caps exceptional items at 12288 UTF-8 bytes before fifty long paths', async () => {
    const directory = '长'.repeat(60);
    await mkdir(join(root, directory));
    for (let i = 0; i < 60; i++) await writeFile(join(root, directory, `${String(i).padStart(3, '0')}-${'名'.repeat(60)}.pdf`), 'pdf');
    const { result } = await execute(['extract', directory]);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThan(50);
    expect(result.items.reduce((sum, item) => sum + Buffer.byteLength(JSON.stringify(item)) + 1, 0)).toBeLessThanOrEqual(12288);
    expect(result.omitted).toBe(60 - result.items.length);
  });

  it('rebuilds byte-identical text caches after the entire cache is deleted', async () => {
    await execute(['extract', '--all']);
    const directory = join(root, '.knowlery/cache/text');
    const first = await Promise.all((await readdir(directory)).sort().map(async (name) => [name, await readFile(join(directory, name), 'utf8')]));
    await rm(join(root, '.knowlery/cache'), { recursive: true });
    expect((await execute(['extract', '--all'])).result.work.extracted).toBe(5);
    const again = await Promise.all((await readdir(directory)).sort().map(async (name) => [name, await readFile(join(directory, name), 'utf8')]));
    expect(again).toEqual(first);
  });

  it('repairs wrong unit counts even when a listing can reuse the inventory hash', async () => {
    await execute(['extract', 'Notes/meeting.md']);
    const extraction = await getExtraction(root, 'Notes/meeting.md');
    const path = join(root, '.knowlery/cache/text', cacheName(extraction.sha256!, 'markdown@1'));
    await writeFile(path, JSON.stringify({ ...extraction.header, units: 999 }) + '\n');
    const { result, reads } = await execute(['extract', 'Notes/meeting.md']);
    expect(result.work).toEqual({ extracted: 1, cached: 0 });
    expect(reads).toContain(join(root, 'Notes/meeting.md'));
    expect((await getExtraction(root, 'Notes/meeting.md')).cached).toBe(true);
  });

  it('warns but returns text results when the cache cannot be written', async () => {
    await writeFile(join(root, '.knowlery/cache'), 'not a directory');
    const { result } = await execute(['extract', '--all']);
    expect(result.counts).toMatchObject({ total: 5, ok: 5 });
    expect(result.warnings).toEqual(['cache_not_written']);
  });
});

describe('v2 inventory extraction state', () => {
  it('shows pending before extraction, then ok and unreadable from cached headers', async () => {
    await writeFile(join(root, 'bad.txt'), Buffer.from([0xff]));
    expect((await jsonRun(root)).items.every((item) => item.extraction === 'pending')).toBe(true);
    await execute(['extract', '--all']);
    const after = await jsonRun(root);
    expect(after.items.find((item) => item.path === 'bad.txt')?.extraction).toBe('unreadable');
    expect(after.items.filter((item) => item.path !== 'bad.txt').every((item) => item.extraction === 'ok')).toBe(true);
  });

  it('reads only cache headers and uses the current extractor id', async () => {
    const extraction = await getExtraction(root, 'Notes/meeting.md');
    const path = join(root, '.knowlery/cache/text', cacheName(extraction.sha256!, 'markdown@1'));
    await writeFile(path, JSON.stringify(extraction.header) + '\nnot JSON units\n');
    expect((await jsonRun(root)).items.find((item) => item.path === 'Notes/meeting.md')?.extraction).toBe('ok');
    const config = await readConfig(root);
    await getExtraction(root, 'Projects/policy notes.txt');
    const changed = await inventory(root, config, { registry: { ...registry, txt: { ...txt, id: 'txt@2' } } });
    expect(changed.items.find((item) => item.path === 'Projects/policy notes.txt')?.extraction).toBe('pending');
    for (const header of [{ ...extraction.header, v: 2 }, { ...extraction.header, sha256: digest('wrong') }, { ...extraction.header, extractor: 'markdown@2' }]) {
      await writeFile(path, JSON.stringify(header) + '\n');
      expect((await jsonRun(root)).items.find((item) => item.path === 'Notes/meeting.md')?.extraction).toBe('pending');
    }
  });

  it('denies reserved, hidden, ignored and symlink scopes including an ignored ancestor', async () => {
    await mkdir(join(root, '.hidden'));
    await writeFile(join(root, '.hidden/file.txt'), 'text');
    await writeFile(join(root, '.hidden.txt'), 'text');
    await configure(root, { kf: '2.0', ignore: ['Archive', 'Notes/**'] });
    await symlink(join(root, 'Projects'), join(root, 'link'));
    for (const scope of ['wiki', '.knowlery', '.hidden', '.hidden/file.txt', '.hidden.txt', 'Archive', 'Archive/old.md', 'Notes/meeting.md', 'link', 'link/policy notes.txt']) {
      await failure(root, ['inventory', '--scope', scope], 'path_denied', 1);
      await failure(root, ['extract', scope], 'path_denied', 1);
    }
  });

  it('uses the size/time shortcut only in listing mode, not for direct extraction', async () => {
    const path = 'Projects/policy notes.txt';
    await utimes(join(root, path), 1700000000, 1700000000);
    await execute(['extract', path]);
    const original = await getExtraction(root, path);
    const absolute = join(root, path);
    const info = await lstat(absolute);
    const content = 'x'.repeat(info.size);
    await writeFile(absolute, content);
    await utimes(absolute, info.atime, info.mtime);
    vi.mocked(readFile).mockClear();
    const listing = await getExtraction(root, path, { listing: true });
    const reads = vi.mocked(readFile).mock.calls.map((call) => String(call[0]));
    expect(listing.sha256).toBe(original.sha256);
    expect(listing.cached).toBe(true);
    expect(reads).not.toContain(absolute);
    const actual = await getExtraction(root, path);
    expect(actual.sha256).toBe(digest(content));
    expect(actual.units[0].text).toBe(content);
  });
});
