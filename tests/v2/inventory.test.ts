import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lstat, mkdir, readFile, readdir, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inventory } from '../../src/v2/core/inventory';
import { readConfig } from '../../src/v2/core/config';
import { basePaths, configure, digest, failure, fileState, invoke, jsonRun, makeKb } from './helpers';

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

async function add(path: string, text = 'sample bytes\n'): Promise<void> {
  const parts = path.split('/');
  parts.pop();
  await mkdir(join(root, ...parts), { recursive: true });
  await writeFile(join(root, path), text);
}

async function change(path: string, text: string): Promise<void> {
  const absolute = join(root, path);
  const before = await lstat(absolute);
  await writeFile(absolute, text);
  await utimes(absolute, before.atime, new Date(before.mtimeMs + 2000));
}

describe('v2 raw source inventory', () => {
  it('lists the fixture in plain path order with exact byte sizes and independent hashes', async () => {
    const result = await jsonRun(root);
    expect(result.command).toBe('inventory');
    expect(result.items.map((item) => item.path)).toEqual(basePaths);
    expect(result.counts).toEqual({ total: 5, by_format: { csv: 1, markdown: 2, txt: 2 }, unsupported: 0, ignored: 0, symlinks: 0 });
    for (const item of result.items) {
      const bytes = await readFile(join(root, item.path));
      expect(item).toEqual({ path: item.path, format: item.format, size: bytes.length, sha256: digest(bytes), extraction: 'pending' });
    }
    expect(result.snapshot).toBe(digest(result.items.map((item) => `${item.path}\t${item.sha256}\n`).join('')));
    expect(result).toMatchObject({ offset: 0, returned: 5, more: false, next: null, warnings: [] });
  });

  it('renders the exact text summary and tab-separated rows', async () => {
    const data = await jsonRun(root);
    const text = await invoke(root, ['inventory']);
    const lines = text.stdout.trimEnd().split('\n');
    expect(text.code).toBe(0);
    expect(text.stderr).toBe('');
    expect(lines[0]).toBe('sources: 5 (csv 1, markdown 2, txt 2)  unsupported: 0  ignored: 0  symlinks: 0');
    expect(lines.slice(1)).toEqual(data.items.map((item) => `${item.path}\t${item.format}\t${item.size}\t${item.sha256}\t${item.extraction}`));
  });

  it('excludes reserved and hidden names, counts unsupported files and both kinds of symlink', async () => {
    for (const path of ['AGENTS.md', '.hidden.txt', '.hidden/source.md', 'Notes/.hidden.txt', 'Notes/.hidden/source.md', '~$lock.docx', 'Notes/~$lock.txt', '.knowlery/internal.txt', 'wiki/deep/page.md']) await add(path);
    await add('Notes/AGENTS.md');
    await add('photo.png');
    await symlink(join(root, 'Notes/meeting.md'), join(root, 'source-link.md'));
    await symlink(join(root, 'Notes'), join(root, 'folder-link'));
    const result = await jsonRun(root);
    expect(result.items.map((item) => item.path)).toEqual([...basePaths, 'Notes/AGENTS.md'].sort());
    expect(result.counts).toMatchObject({ total: 6, unsupported: 1, ignored: 0, symlinks: 2 });
  });

  it('never follows a dangling link or a link outside the root during walking', async () => {
    await symlink('/definitely-not-a-knowlery-source', join(root, 'dangling'));
    await symlink('..', join(root, 'outside'));
    const result = await jsonRun(root);
    expect(result.counts).toMatchObject({ total: 5, symlinks: 2 });
  });

  it.each([
    ['Archive', ['Archive/old.md']],
    ['Archive/', ['Archive/old.md']],
    ['Notes/meeting.md', ['Notes/meeting.md']],
    ['*.txt', ['Notes/会议记录.txt', 'Projects/policy notes.txt']],
    ['Notes/**', ['Notes/meeting.md', 'Notes/会议记录.txt']],
    ['**/*.md', ['Archive/old.md', 'Notes/meeting.md']],
    ['notes/**', []],
  ])('supports ignore entry %s', async (entry, removed) => {
    await configure(root, { kf: '2.0', ignore: [entry] });
    const result = await jsonRun(root);
    expect(result.counts.ignored).toBe(removed.length);
    expect(result.items.map((item) => item.path)).toEqual(basePaths.filter((path) => !removed.includes(path)));
  });

  it('matches exact ignores at the root rather than by basename and walks ignored folders to count files', async () => {
    await add('Archive/deep/second.md');
    await add('Notes/old.md');
    await configure(root, { kf: '2.0', ignore: ['Archive', 'meeting.md'] });
    const result = await jsonRun(root);
    expect(result.counts.ignored).toBe(2);
    expect(result.items.some((item) => item.path === 'Notes/meeting.md')).toBe(true);
    expect(result.items.some((item) => item.path === 'Notes/old.md')).toBe(true);
  });

  it.each(['/Notes', '../Notes', 'Notes/../meeting.md', 'Notes\\meeting.md'])('rejects invalid ignore entry %s', async (entry) => {
    await configure(root, { kf: '2.0', ignore: [entry] });
    await failure(root, ['inventory'], 'invalid_config', 1);
  });

  it('recognizes case-insensitive extensions and markdown aliases', async () => {
    for (const path of ['a.PDF', 'b.docx', 'c.xlsx', 'd.markdown', 'e.CSV', 'f.TXT']) await add(path, 'dummy format bytes');
    const result = await jsonRun(root);
    expect(result.items.filter((item) => /^[a-f]\./.test(item.path)).map((item) => item.format)).toEqual(['pdf', 'docx', 'xlsx', 'markdown', 'csv', 'txt']);
    expect(result.counts.unsupported).toBe(0);
  });

  it('still hashes files over a lowered extraction ceiling, with equality allowed', async () => {
    const before = await fileState(root);
    const config = await readConfig(root);
    const size = (await lstat(join(root, 'Archive/old.md'))).size;
    const result = await inventory(root, config, { ceiling: size });
    for (const item of result.items) {
      expect(item.extraction).toBe(item.size > size ? 'too_large' : 'pending');
      expect(item.sha256).toBe(digest(await readFile(join(root, item.path))));
    }
    expect(result.items.find((item) => item.path === 'Archive/old.md')?.extraction).toBe('pending');
    expect(result.items.some((item) => item.extraction === 'too_large')).toBe(true);
    expect(await fileState(root)).toEqual(before);
  });

  it('handles an empty scope and an offset beyond the end', async () => {
    await mkdir(join(root, 'empty'));
    const result = await jsonRun(root, ['inventory', '--scope', 'empty']);
    expect(result).toMatchObject({ counts: { total: 0 }, items: [], returned: 0, more: false, next: null, snapshot: digest('') });
    expect(await jsonRun(root, ['inventory', '--offset', '500'])).toMatchObject({ counts: { total: 5 }, items: [], offset: 500, returned: 0, more: false, next: null });
  });
});

describe('v2 inventory cache', () => {
  it('hashes on the first run, reuses all on the second, and recreates a deleted or corrupt cache', async () => {
    const first = await jsonRun(root);
    expect(first.cache).toEqual({ hashed: 5, reused: 0 });
    const cachePath = join(root, '.knowlery/cache/inventory.jsonl');
    const lines = (await readFile(cachePath, 'utf8')).trimEnd().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(lines).toHaveLength(5);
    expect(Object.keys(lines[0]).sort()).toEqual(['format', 'mtimeMs', 'path', 'sha256', 'size']);
    const second = await jsonRun(root);
    expect(second.cache).toEqual({ hashed: 0, reused: 5 });
    expect(second.items).toEqual(first.items);
    await rm(cachePath);
    const deleted = await jsonRun(root);
    expect(deleted.items).toEqual(first.items);
    expect(deleted.cache.hashed).toBe(5);
    await writeFile(cachePath, '{broken\n');
    const corrupt = await jsonRun(root);
    expect(corrupt.items).toEqual(first.items);
    expect(corrupt.cache.hashed).toBe(5);
  });

  it('rehashes only a changed file, or a file with only a changed mtime', async () => {
    const first = await jsonRun(root);
    await change('Notes/meeting.md', '# Changed meeting\n');
    const changed = await jsonRun(root);
    expect(changed.cache).toEqual({ hashed: 1, reused: 4 });
    const original = first.items.find((item) => item.path === 'Notes/meeting.md');
    const updated = changed.items.find((item) => item.path === 'Notes/meeting.md');
    expect(updated?.sha256).not.toBe(original?.sha256);
    const path = join(root, 'Notes/meeting.md');
    const info = await lstat(path);
    await utimes(path, info.atime, new Date(info.mtimeMs + 3000));
    const touched = await jsonRun(root);
    expect(touched.cache).toEqual({ hashed: 1, reused: 4 });
    expect(touched.items).toEqual(changed.items);
  });

  it('treats an unreadable cache file as empty and warns only if rewriting also fails', async () => {
    const first = await jsonRun(root);
    const path = join(root, '.knowlery/cache/inventory.jsonl');
    await rm(path);
    await mkdir(path);
    const result = await jsonRun(root);
    expect(result.items).toEqual(first.items);
    expect(result.cache).toEqual({ hashed: 5, reused: 0 });
    expect(result.warnings).toEqual(['cache_not_written']);
    expect((await readdir(join(root, '.knowlery/cache'))).sort()).toEqual(['inventory.jsonl']);
  });

  it('treats a readable JSON line with invalid fields as a corrupt cache', async () => {
    const first = await jsonRun(root);
    const path = join(root, '.knowlery/cache/inventory.jsonl');
    const text = await readFile(path, 'utf8');
    for (const invalid of [{ path: '../escape', size: 2 }, { path: 'Notes/meeting.md', size: -1 }, null, { path: 'a.md', size: 3, mtimeMs: 1, sha256: 'untrusted', format: 'markdown' }]) {
      await writeFile(path, `${text}${JSON.stringify(invalid)}\n`);
      const result = await jsonRun(root);
      expect(result.items).toEqual(first.items);
      expect(result.cache.hashed).toBe(5);
    }
  });

  it('keeps cache lines outside a walked scope, removes deleted scoped lines, and ignores newly excluded lines', async () => {
    await jsonRun(root);
    await rm(join(root, 'Notes/meeting.md'));
    expect((await jsonRun(root, ['inventory', '--scope', 'Notes'])).cache).toEqual({ hashed: 0, reused: 1 });
    const cachePath = join(root, '.knowlery/cache/inventory.jsonl');
    const lines = (await readFile(cachePath, 'utf8')).trimEnd().split('\n').map((line) => JSON.parse(line) as { path: string });
    expect(lines.map((line) => line.path)).toEqual(basePaths.filter((path) => path !== 'Notes/meeting.md'));
    await configure(root, { kf: '2.0', ignore: ['Archive/'] });
    const result = await jsonRun(root);
    expect(result.counts.ignored).toBe(1);
    expect(result.cache).toEqual({ hashed: 0, reused: 3 });
    expect(await readFile(cachePath, 'utf8')).not.toContain('Archive/old.md');
  });

  it('succeeds with a warning when the cache directory cannot be written', async () => {
    await writeFile(join(root, '.knowlery/cache'), 'not a directory');
    const result = await jsonRun(root);
    expect(result).toMatchObject({ counts: { total: 5 }, cache: { hashed: 5, reused: 0 }, warnings: ['cache_not_written'] });
  });

  it('does not follow a symlinked cache directory or cache file outside the root', async () => {
    const outside = await makeKb();
    try {
      const before = await fileState(outside);
      await symlink(join(outside, 'Archive'), join(root, '.knowlery/cache'));
      expect((await jsonRun(root)).warnings).toEqual(['cache_not_written']);
      expect(await readdir(join(outside, 'Archive'))).toEqual(['old.md']);
      await rm(join(root, '.knowlery/cache'));
      await mkdir(join(root, '.knowlery/cache'));
      await symlink(join(outside, 'Notes/meeting.md'), join(root, '.knowlery/cache/inventory.jsonl'));
      const result = await jsonRun(root);
      expect(result.cache.hashed).toBe(5);
      expect(result.warnings).toEqual([]);
      expect((await lstat(join(root, '.knowlery/cache/inventory.jsonl'))).isSymbolicLink()).toBe(false);
      expect(await fileState(outside)).toEqual(before);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });
});

describe('v2 paging', () => {
  it('follows limit-two pages with no gaps or duplicate items and whole-scope counts', async () => {
    const seen: string[] = [];
    let offset = 0;
    let snapshot: string | undefined;
    while (true) {
      const args = ['inventory', '--limit', '2', '--offset', String(offset)];
      if (snapshot) args.push('--snapshot', snapshot);
      const result = await jsonRun(root, args);
      expect(result.counts.total).toBe(5);
      expect(result.returned).toBe(result.items.length);
      expect(result.items.length).toBeLessThanOrEqual(2);
      seen.push(...result.items.map((item) => item.path));
      if (!result.more) {
        expect(result.next).toBeNull();
        break;
      }
      expect(result.next).toEqual({ offset: offset + result.returned, snapshot: result.snapshot });
      offset = result.next!.offset;
      snapshot = result.snapshot;
    }
    expect(seen).toEqual(basePaths);
  });

  it('fails stale_version after a file changes between pages and offers offset zero recovery', async () => {
    const first = await jsonRun(root, ['inventory', '--limit', '2']);
    await change('Archive/old.md', 'new archive bytes');
    await failure(root, ['inventory', '--offset', '2', '--snapshot', first.snapshot], 'stale_version', 1);
    const text = await invoke(root, ['inventory', '--snapshot', first.snapshot]);
    expect(text.stderr).toContain('offset 0');
    expect(text.stdout).toBe('');
  });

  it('obeys the UTF-8 byte budget before the default fifty-item limit', async () => {
    for (let i = 0; i < 200; i++) await add(`Generated/${String(i).padStart(96, 'x')}.txt`, `item ${i}`);
    const result = await jsonRun(root);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.length).toBeLessThan(50);
    expect(result.items.reduce((bytes, item) => bytes + Buffer.byteLength(JSON.stringify(item)) + 1, 0)).toBeLessThanOrEqual(12288);
    expect(result.counts.total).toBe(205);
    expect(result.more).toBe(true);
    const text = await invoke(root, ['inventory', '--limit', '2']);
    expect(text.stdout).toMatch(/more: --offset 2 --snapshot sha256:[a-f0-9]{64}\n$/);
  });
});

describe('v2 scopes and exact paths', () => {
  it('scopes to a folder or a single file with root-relative item paths', async () => {
    const folder = await jsonRun(root, ['inventory', '--scope', 'Notes']);
    expect(folder.items.map((item) => item.path)).toEqual(['Notes/meeting.md', 'Notes/会议记录.txt']);
    expect(folder.counts.total).toBe(2);
    const file = await jsonRun(root, ['inventory', '--scope', 'Notes/meeting.md']);
    expect(file.items.map((item) => item.path)).toEqual(['Notes/meeting.md']);
    expect(file.counts.total).toBe(1);
    expect((await jsonRun(root, ['inventory', '--scope', 'wiki/placeholder.md'])).counts.total).toBe(0);
  });

  it('resolves a symlinked root to its real directory', async () => {
    await symlink(root, join(root, 'root-alias'));
    const result = await jsonRun(root, ['--dir', 'root-alias', 'inventory']);
    expect(result.items.map((item) => item.path)).toEqual(basePaths);
    expect(result.counts.symlinks).toBe(1);
  });

  it('rejects escaping, absolute, missing, and outward-symlink scopes', async () => {
    await failure(root, ['inventory', '--scope', '../x'], 'path_denied', 1);
    await failure(root, ['inventory', '--scope', root], 'path_denied', 1);
    await failure(root, ['inventory', '--scope', 'absent'], 'not_found', 1);
    await symlink('..', join(root, 'outward'));
    await failure(root, ['inventory', '--scope', 'outward'], 'path_denied', 1);
    await failure(root, ['inventory', '--scope', 'outward/absent'], 'path_denied', 1);
  });

  it('hashes exactly requested paths, including wiki, ignored, hidden, and unsupported files, without cache writes', async () => {
    await add('.hidden.txt');
    await add('photo.png');
    await configure(root, { kf: '2.0', ignore: ['Notes/'] });
    const requested = ['Notes/meeting.md', 'wiki/placeholder.md', 'wiki/new.md', '.hidden.txt', 'photo.png'];
    const result = await jsonRun(root, ['inventory', '--paths', ...requested]);
    expect(Object.keys(result).sort()).toEqual(['command', 'contract', 'ok', 'paths']);
    expect(result.paths.map((item) => item.path)).toEqual(requested);
    for (const item of result.paths) {
      if (item.path === 'wiki/new.md') expect(item).toEqual({ path: item.path, exists: false });
      else {
        const bytes = await readFile(join(root, item.path));
        expect(item).toEqual({ path: item.path, exists: true, size: bytes.length, sha256: digest(bytes) });
      }
    }
    await expect(lstat(join(root, '.knowlery/cache'))).rejects.toThrow();
  });

  it('reads bytes on every paths request and neither uses nor changes an existing cache', async () => {
    await jsonRun(root);
    const cachePath = join(root, '.knowlery/cache/inventory.jsonl');
    const cached = await readFile(cachePath);
    const cacheInfo = await lstat(cachePath);
    const path = join(root, 'Archive/old.md');
    const info = await lstat(path);
    const bytes = await readFile(path);
    const modified = Buffer.alloc(bytes.length, 'x');
    await writeFile(path, modified);
    await utimes(path, info.atime, info.mtime);
    const result = await jsonRun(root, ['inventory', '--paths', 'Archive/old.md']);
    expect(result.paths[0]).toMatchObject({ sha256: digest(modified) });
    expect(await readFile(cachePath)).toEqual(cached);
    expect((await lstat(cachePath)).mtimeMs).toBe(cacheInfo.mtimeMs);
  });

  it('denies escaping paths and outward symbolic links, including missing targets', async () => {
    await failure(root, ['inventory', '--paths', '../outside'], 'path_denied', 1);
    await failure(root, ['inventory', '--paths', join(root, 'Notes/meeting.md')], 'path_denied', 1);
    await symlink('..', join(root, 'outside'));
    await failure(root, ['inventory', '--paths', 'outside'], 'path_denied', 1);
    await failure(root, ['inventory', '--paths', 'outside/missing.md'], 'path_denied', 1);
    await symlink('/not-present-anywhere', join(root, 'dangling'));
    await failure(root, ['inventory', '--paths', 'dangling'], 'path_denied', 1);
  });

  it('allows an in-root file symlink in paths mode but does not follow it during inventory', async () => {
    await symlink('Notes/meeting.md', join(root, 'inward.md'));
    const result = await jsonRun(root, ['inventory', '--paths', 'inward.md']);
    expect(result.paths[0]).toEqual({ path: 'inward.md', exists: true, size: (await readFile(join(root, 'Notes/meeting.md'))).length, sha256: digest(await readFile(join(root, 'Notes/meeting.md'))) });
    const scoped = await jsonRun(root, ['inventory', '--scope', 'inward.md']);
    expect(scoped.counts).toMatchObject({ total: 0, symlinks: 1 });
    await symlink('Notes', join(root, 'inward-folder'));
    const nested = await jsonRun(root, ['inventory', '--scope', 'inward-folder/meeting.md']);
    expect(nested.counts).toMatchObject({ total: 0, symlinks: 1 });
  });

  it('reports an in-root dangling link as a missing exact path, while counting it as a symlink during walking', async () => {
    await symlink('Notes/not-created.md', join(root, 'future.md'));
    const result = await jsonRun(root, ['inventory', '--paths', 'future.md']);
    expect(result.paths).toEqual([{ path: 'future.md', exists: false }]);
    const scoped = await jsonRun(root, ['inventory', '--scope', 'future.md']);
    expect(scoped.counts).toMatchObject({ total: 0, symlinks: 1 });
  });

  it('rejects folders and every incompatible paths-mode option as invalid invocations', async () => {
    await failure(root, ['inventory', '--paths', 'Notes'], 'invalid_invocation', 2);
    for (const options of [['--scope', 'Notes'], ['--limit', '2'], ['--offset', '0'], ['--snapshot', 'sha256:any']]) {
      await failure(root, ['inventory', '--paths', 'Notes/meeting.md', ...options], 'invalid_invocation', 2);
    }
  });

  it('leaves all non-cache file bytes and modification times unchanged after successful and failing runs', async () => {
    await add('AGENTS.md');
    await add('.hidden/source.txt');
    const before = await fileState(root);
    await jsonRun(root);
    await jsonRun(root);
    await jsonRun(root, ['inventory', '--scope', 'Notes']);
    await jsonRun(root, ['inventory', '--paths', 'wiki/placeholder.md']);
    await failure(root, ['inventory', '--snapshot', 'old'], 'stale_version', 1);
    await failure(root, ['inventory', '--scope', '../x'], 'path_denied', 1);
    expect(await fileState(root)).toEqual(before);
  });
});
