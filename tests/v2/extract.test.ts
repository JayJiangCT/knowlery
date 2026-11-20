import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lstat, mkdir, readFile, readdir, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getExtraction } from '../../src/v2/core/extract';
import { cacheName } from '../../src/v2/core/extract/cache';
import { markdown } from '../../src/v2/core/extract/markdown';
import { txt } from '../../src/v2/core/extract/txt';
import { csv } from '../../src/v2/core/extract/csv';
import { registry } from '../../src/v2/core/extract/registry';
import { configure, digest, fileState, makeKb } from './helpers';

let root: string;
beforeEach(async () => { root = await makeKb(); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const bytes = (text: string) => Buffer.from(text);

describe('v2 text extractors', () => {
  it('uses only string title/description from frontmatter, and discards malformed frontmatter', async () => {
    const result = await markdown.extract(bytes('---\ntitle: Note\ndescription: A note\nother: secret\n---\nBefore\n# First\n'));
    expect(result.meta).toEqual({ title: 'Note', description: 'A note' });
    expect(result.units.map((unit) => unit.text)).toEqual(['Before', '# First']);
    expect((await markdown.extract(bytes('---\ntitle: [bad\n---\nBody')))).toMatchObject({ meta: {}, state: 'ok', problems: [], units: [{ text: 'Body' }] });
    expect((await markdown.extract(bytes('---\ntitle: 4\ndescription: [a]\n---\nBody'))).meta).toEqual({});
  });

  it('tracks heading levels, skipped levels, closing hashes and top blocks', async () => {
    const result = await markdown.extract(bytes('Before  \n\n#  One  ##\n## Two\n### Three\n# Other\n### Skipped\n'));
    expect(result.units).toEqual([
      { i: 0, kind: 'block', path: '(top)', text: 'Before' },
      { i: 1, kind: 'heading', level: 1, path: 'One', text: '#  One  ##' },
      { i: 2, kind: 'heading', level: 2, path: 'One > Two', text: '## Two' },
      { i: 3, kind: 'heading', level: 3, path: 'One > Two > Three', text: '### Three' },
      { i: 4, kind: 'heading', level: 1, path: 'Other', text: '# Other' },
      { i: 5, kind: 'heading', level: 3, path: 'Other > Skipped', text: '### Skipped' },
    ]);
  });

  it.each(['```', '~~~~'])('keeps fenced %s blocks including blank lines as one unit', async (fence) => {
    const code = `${fence}\n# not a heading\n\ncode\n${fence}`;
    const result = await markdown.extract(bytes(`# Head\n${code}\n\nAfter\n`));
    expect(result.units).toMatchObject([{ kind: 'heading', path: 'Head' }, { kind: 'block', path: 'Head', text: code }, { kind: 'block', text: 'After' }]);
    expect((await markdown.extract(bytes('```\n# Unclosed\n\nend'))).units).toHaveLength(1);
    expect((await markdown.extract(bytes('Title\n====='))).units[0].kind).toBe('block');
  });

  it('numbers txt lines, ignores blanks and does not invent a final line', async () => {
    expect(await txt.extract(bytes('one\ntwo\n\n   \nfive\n'))).toMatchObject({ meta: { lines: 5 }, units: [
      { i: 0, kind: 'lines', start: 1, end: 2, text: 'one\ntwo' }, { i: 1, start: 5, end: 5, text: 'five' },
    ] });
    expect((await txt.extract(bytes(''))).meta).toEqual({ lines: 0 });
  });

  it('splits txt only at line boundaries including a single 5000-byte line', async () => {
    const result = await txt.extract(bytes(`${'a'.repeat(1024)}\n${'b'.repeat(1024)}\n${'c'.repeat(5000)}\nend`));
    expect(result.units.map((unit) => Buffer.byteLength(unit.text))).toEqual([1024, 1024, 5000, 3]);
    expect(result.units).toMatchObject([{ start: 1, end: 1 }, { start: 2, end: 2 }, { start: 3, end: 3 }, { start: 4, end: 4 }]);
  });

  it('preserves every Chinese fixture line within the byte ceiling or a one-line unit', async () => {
    const text = await readFile(join(root, 'Notes/会议记录.txt'), 'utf8');
    const result = await txt.extract(bytes(text));
    for (const unit of result.units) expect(unit.text.split('\n').length === 1 || Buffer.byteLength(unit.text) <= 2048).toBe(true);
    expect(result.units.map((unit) => unit.text).join('\n') + (text.endsWith('\n') ? '\n' : '')).toBe(text);
  });

  it('extracts the 200-row csv fixture with quoted commas and newlines', async () => {
    const result = await csv.extract(await readFile(join(root, 'Finance/orders.csv')));
    expect(result.meta).toEqual({ columns: ['order_id', 'customer', 'amount'], rows: 200 });
    expect(result.units).toHaveLength(200);
    expect(result.units.slice(0, 2)).toEqual([
      { i: 0, kind: 'row', row: 1, text: '1\tCompany, Ltd\t7.00' },
      { i: 1, kind: 'row', row: 2, text: '2\tTwo Lines\t14.00' },
    ]);
  });

  it('keeps complete csv rows on an open quote and skips empty lines', async () => {
    const result = await csv.extract(bytes('a,b\n\n1,"say ""hi"""\n2,"unfinished'));
    expect(result).toMatchObject({ state: 'partial', meta: { rows: 1 }, problems: [{ code: 'unterminated_quote', detail: 'Unterminated quote in record 3.' }], units: [{ row: 1, text: '1\tsay "hi"' }] });
    expect(await csv.extract(bytes('a\n"unfinished'))).toMatchObject({ state: 'unreadable', units: [], problems: [{ code: 'unterminated_quote' }] });
    expect((await csv.extract(bytes('a,b\n"\t\r\nx",y\n'))).units[0].text).toBe('  x\ty');
  });

  it.each([markdown, txt, csv])('normalises BOM and line endings and rejects invalid UTF-8 ($id)', async (extractor) => {
    const lf = 'a,b\n1,2\n';
    expect(await extractor.extract(bytes(`\ufeff${lf.replace(/\n/g, '\r\n')}`))).toEqual(await extractor.extract(bytes(lf)));
    expect(await extractor.extract(bytes(lf.replace(/\n/g, '\r')))).toEqual(await extractor.extract(bytes(lf)));
    expect(await extractor.extract(Buffer.from([0xff]))).toMatchObject({ state: 'unreadable', units: [], problems: [{ code: 'encoding' }] });
  });
});

describe('v2 content-addressed extraction cache', () => {
  it('reuses results and rebuilds byte-identical caches after deletion without modifying sources', async () => {
    const before = await fileState(root);
    const first = await getExtraction(root, 'Notes/meeting.md');
    expect(first.cached).toBe(false);
    const path = join(root, '.knowlery/cache/text', cacheName(first.sha256!, 'markdown@1'));
    const content = await readFile(path);
    expect((await getExtraction(root, 'Notes/meeting.md')).cached).toBe(true);
    await rm(join(root, '.knowlery/cache'), { recursive: true });
    expect((await getExtraction(root, 'Notes/meeting.md')).cached).toBe(false);
    expect(await readFile(path)).toEqual(content);
    expect(await fileState(root)).toEqual(before);
  });

  it('replaces corrupt cache files and incorrect unit counts', async () => {
    const first = await getExtraction(root, 'Notes/meeting.md');
    const path = join(root, '.knowlery/cache/text', cacheName(first.sha256!, 'markdown@1'));
    const original = await readFile(path, 'utf8');
    const lines = original.split('\n');
    const invalidHeaders = [{ ...first.header, units: 999 }, { ...first.header, v: 2 }, { ...first.header, sha256: digest('wrong') }, { ...first.header, extractor: 'markdown@2' }];
    for (const content of ['{broken\n', ...invalidHeaders.map((header) => [JSON.stringify(header), ...lines.slice(1)].join('\n'))]) {
      await writeFile(path, content);
      const again = await getExtraction(root, 'Notes/meeting.md');
      expect(again.cached).toBe(false);
      expect(again.units).toEqual(first.units);
    }
  });

  it('shares same-format bytes, separates formats and extractor versions', async () => {
    await writeFile(join(root, 'a.txt'), 'body');
    await writeFile(join(root, 'b.txt'), 'body');
    await writeFile(join(root, 'a.md'), 'body');
    await getExtraction(root, 'a.txt');
    expect((await getExtraction(root, 'b.txt')).cached).toBe(true);
    expect((await getExtraction(root, 'a.md')).cached).toBe(false);
    const extract = vi.fn(txt.extract);
    const custom = { ...registry, txt: { id: 'txt@2', extract } };
    expect((await getExtraction(root, 'a.txt', { registry: custom })).cached).toBe(false);
    expect(extract).toHaveBeenCalledTimes(1);
    expect((await readdir(join(root, '.knowlery/cache/text'))).sort()).toEqual([
      `${digest('body').slice(7)}.markdown@1.jsonl`, `${digest('body').slice(7)}.txt@1.jsonl`, `${digest('body').slice(7)}.txt@2.jsonl`,
    ]);
  });

  it('caches unreadable sources as a header only', async () => {
    await writeFile(join(root, 'bad.txt'), Buffer.from([0xff]));
    const result = await getExtraction(root, 'bad.txt');
    expect(result.state).toBe('unreadable');
    const content = await readFile(join(root, '.knowlery/cache/text', cacheName(result.sha256!, 'txt@1')), 'utf8');
    expect(content.trimEnd().split('\n')).toHaveLength(1);
    expect((await getExtraction(root, 'bad.txt')).cached).toBe(true);
  });

  it('does not cache unavailable formats and never reads over-ceiling sources', async () => {
    await writeFile(join(root, 'a.pdf'), 'dummy');
    expect(await getExtraction(root, 'a.pdf')).toMatchObject({ state: 'unavailable', header: null, units: [] });
    expect(await getExtraction(root, 'Projects/policy notes.txt', { registry: {} })).toMatchObject({ state: 'unavailable' });
    const extract = vi.fn(txt.extract);
    expect(await getExtraction(root, 'Projects/policy notes.txt', { ceiling: 0, registry: { txt: { id: 'txt@1', extract } } })).toMatchObject({ state: 'too_large', sha256: null });
    expect(extract).not.toHaveBeenCalled();
    await expect(lstat(join(root, '.knowlery/cache/text'))).rejects.toThrow();
  });

  it('returns the extraction and a warning when cache writing fails', async () => {
    await writeFile(join(root, '.knowlery/cache'), 'not a directory');
    expect(await getExtraction(root, 'Notes/meeting.md')).toMatchObject({ state: 'ok', warnings: ['cache_not_written'] });
  });

  it('never follows symlinked text cache directories or files', async () => {
    await mkdir(join(root, '.knowlery/cache'));
    await mkdir(join(root, 'outside'));
    await symlink(join(root, 'outside'), join(root, '.knowlery/cache/text'));
    expect((await getExtraction(root, 'Notes/meeting.md')).warnings).toEqual(['cache_not_written']);
    expect(await readdir(join(root, 'outside'))).toEqual([]);
    await rm(join(root, '.knowlery/cache/text'));
    const result = await getExtraction(root, 'Notes/meeting.md');
    const path = join(root, '.knowlery/cache/text', cacheName(result.sha256!, 'markdown@1'));
    await rm(path);
    await symlink(join(root, 'Notes/meeting.md'), path);
    const before = await fileState(root);
    expect((await getExtraction(root, 'Notes/meeting.md')).cached).toBe(false);
    expect(await fileState(root)).toEqual(before);
  });

  it('rehashes actual bytes despite unchanged size and mtime', async () => {
    const path = join(root, 'Notes/meeting.md');
    await utimes(path, 1700000000, 1700000000);
    const original = await getExtraction(root, 'Notes/meeting.md');
    const info = await lstat(path);
    const text = 'x'.repeat(info.size);
    await writeFile(path, text);
    await utimes(path, info.atime, info.mtime);
    expect((await lstat(path)).mtimeMs).toBe(info.mtimeMs);
    const updated = await getExtraction(root, 'Notes/meeting.md');
    expect(updated.sha256).not.toBe(original.sha256);
    expect(updated.sha256).toBe(digest(text));
    expect(updated.units[0].text).toBe(text);
  });

  it('denies non-inventory paths, symlinks, unsupported and missing sources', async () => {
    for (const path of ['.hidden.txt', 'ignored.txt', 'unknown.bin']) await writeFile(join(root, path), 'body');
    await mkdir(join(root, '.hidden'));
    await writeFile(join(root, '.hidden/a.txt'), 'body');
    await configure(root, { kf: '2.0', ignore: ['ignored.txt'] });
    await symlink(join(root, 'Notes/meeting.md'), join(root, 'link.md'));
    await symlink(join(root, 'Notes'), join(root, 'folder-link'));
    await symlink('..', join(root, 'out'));
    for (const path of ['.hidden.txt', '.hidden/a.txt', '.knowlery/config.json', 'ignored.txt', 'link.md', 'folder-link/meeting.md', 'out/a.txt', 'wiki/record-preservation.md', '../escape']) {
      await expect(getExtraction(root, path)).rejects.toMatchObject({ code: 'path_denied' });
    }
    await expect(getExtraction(root, 'unknown.bin')).rejects.toMatchObject({ code: 'extraction_unavailable' });
    await expect(getExtraction(root, 'missing.txt')).rejects.toMatchObject({ code: 'not_found' });
  });
});
