import { appendFile, copyFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCli } from '../../src/v2/cli/main';
import { readConfig } from '../../src/v2/core/config';
import { readPage } from '../../src/v2/core/page/files';
import { pageFreshness } from '../../src/v2/core/page/freshness';
import type { StaleResult } from '../../src/v2/core/stale';
import { failure, invoke, jsonRun, makeKb } from './helpers';

type StaleResponse = StaleResult & {
  contract: string;
  ok: boolean;
  command: string;
};

const tempRoots: string[] = [];

async function freshKb(): Promise<string> {
  const root = await makeKb();
  tempRoots.push(root);
  return root;
}

async function runStaleJson(root: string, argv: string[] = ['stale']): Promise<StaleResponse> {
  return (await jsonRun(root, argv)) as unknown as StaleResponse;
}

afterEach(async () => {
  while (tempRoots.length > 0) {
    const dir = tempRoots.pop();
    if (dir) await rm(dir, { recursive: true, force: true });
  }
});

describe('stale', () => {
  it('reports zero stale items on the clean fixture', async () => {
    const root = await freshKb();
    const res = await runStaleJson(root);
    expect(res.command).toBe('stale');
    expect(res.counts).toEqual({
      sources: 5,
      pages: 5,
      changed: 0,
      missing: 0,
      moved: 0,
      unreadable: 0,
      unreferenced: 0,
    });
    expect(res.items).toEqual([]);
    expect(res.offset).toBe(0);
    expect(res.returned).toBe(0);
    expect(res.more).toBe(false);
    expect(res.next).toBeNull();
    expect(res.snapshot).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(res.cache).toEqual({ hashed: 5, reused: 0 });
    expect(res.warnings).toEqual([]);

    const textRes = await invoke(root, ['stale']);
    expect(textRes.code).toBe(0);
    expect(textRes.stderr).toBe('');
    expect(textRes.stdout).toBe(
      'sources: 5  pages: 5  changed: 0  missing: 0  moved: 0  unreadable: 0  unreferenced: 0\n',
    );
  });

  it('detects changed live sources and ignores History-only pins', async () => {
    const root = await freshKb();
    await appendFile(join(root, 'Notes/meeting.md'), '\nOne more line.\n');

    const res = await runStaleJson(root);
    expect(res.counts).toMatchObject({
      sources: 5,
      pages: 5,
      changed: 1,
      missing: 0,
      moved: 0,
      unreadable: 0,
      unreferenced: 0,
    });
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      category: 'changed',
      path: 'Notes/meeting.md',
      pages: [
        { page: 'wiki/record-preservation.md', keys: ['s2'] },
        { page: 'wiki/wiki-compile-overview.md', keys: ['s1'] },
      ],
      pages_more: 0,
    });

    const config = await readConfig(root);
    const overview = await readPage(root, 'wiki/wiki-compile-overview.md');
    expect(await pageFreshness(root, config, overview)).toBe('source_changed');

    // Change Notes/会议记录.txt: cited live in wiki-compile-overview, only in History in record-preservation.
    await appendFile(join(root, 'Notes/会议记录.txt'), '\n追加一行。\n');
    const res2 = await runStaleJson(root);
    expect(res2.counts.changed).toBe(2);
    const cnItem = res2.items.find((item) => item.path === 'Notes/会议记录.txt');
    expect(cnItem).toMatchObject({
      category: 'changed',
      path: 'Notes/会议记录.txt',
      pages: [{ page: 'wiki/wiki-compile-overview.md', keys: ['s2'] }],
      pages_more: 0,
    });
  });

  it('detects moved vs missing sources including ambiguous copies', async () => {
    const root = await freshKb();
    await rename(join(root, 'Archive/old.md'), join(root, 'Archive/renamed.md'));

    const movedRes = await runStaleJson(root);
    expect(movedRes.counts).toMatchObject({
      sources: 5,
      pages: 5,
      changed: 0,
      missing: 0,
      moved: 1,
      unreadable: 0,
      unreferenced: 0,
    });
    expect(movedRes.items).toEqual([
      {
        category: 'moved',
        path: 'Archive/old.md',
        to: 'Archive/renamed.md',
        pages: [
          { page: 'wiki/record-preservation.md', keys: ['s3'] },
        ],
        pages_more: 0,
      },
    ]);

    // Copy to a second location so two inventoried files share the hash -> ambiguous -> missing.
    await copyFile(join(root, 'Archive/renamed.md'), join(root, 'Archive/renamed-copy.md'));
    const ambiguousRes = await runStaleJson(root);
    expect(ambiguousRes.counts).toMatchObject({
      missing: 1,
      moved: 0,
      unreferenced: 2,
    });
    expect(ambiguousRes.items.find((item) => item.path === 'Archive/old.md')).toMatchObject({
      category: 'missing',
      path: 'Archive/old.md',
    });

    // Delete Projects/policy notes.txt -> missing with 3 pages, and pageFreshness is source_missing.
    await rm(join(root, 'Projects/policy notes.txt'));
    const missingRes = await runStaleJson(root);
    const policyItem = missingRes.items.find((item) => item.path === 'Projects/policy notes.txt');
    expect(policyItem).toEqual({
      category: 'missing',
      path: 'Projects/policy notes.txt',
      pages: [
        { page: 'wiki/record-preservation.md', keys: ['s1'] },
        { page: 'wiki/source-policy-notes.md', keys: ['s1', 's2'] },
        { page: 'wiki/wiki-compile-overview.md', keys: ['s3'] },
      ],
      pages_more: 0,
    });

    const config = await readConfig(root);
    const policyPage = await readPage(root, 'wiki/source-policy-notes.md');
    expect(await pageFreshness(root, config, policyPage)).toBe('source_missing');
  });

  it('handles unreferenced, unreadable after extract, and too_large sources', async () => {
    const root = await freshKb();
    await writeFile(join(root, 'Notes/new-note.md'), '# New note\n\nNot compiled yet.\n');
    await writeFile(join(root, 'Notes/bad.txt'), Buffer.from([0xff, 0xfe, 0x80, 0x81]));

    const beforeExtract = await runStaleJson(root);
    expect(beforeExtract.counts).toMatchObject({
      sources: 7,
      unreadable: 0,
      unreferenced: 2,
    });
    expect(beforeExtract.items).toEqual([
      {
        category: 'unreferenced',
        path: 'Notes/bad.txt',
        format: 'txt',
        size: 4,
      },
      {
        category: 'unreferenced',
        path: 'Notes/new-note.md',
        format: 'markdown',
        size: Buffer.byteLength('# New note\n\nNot compiled yet.\n'),
      },
    ]);

    // Extract the invalid UTF-8 file -> cached as unreadable -> now stale reports unreadable.
    await invoke(root, ['extract', 'Notes/bad.txt', '--json']);
    const afterExtract = await runStaleJson(root);
    expect(afterExtract.counts).toMatchObject({
      unreadable: 1,
      unreferenced: 1,
    });
    expect(afterExtract.items).toEqual([
      {
        category: 'unreadable',
        path: 'Notes/bad.txt',
        state: 'unreadable',
        pages: [],
        pages_more: 0,
      },
      {
        category: 'unreferenced',
        path: 'Notes/new-note.md',
        format: 'markdown',
        size: Buffer.byteLength('# New note\n\nNot compiled yet.\n'),
      },
    ]);

    // Lower ceiling so Notes/new-note.md exceeds it -> unreadable with state too_large.
    let stdout = '';
    let stderr = '';
    const code = await runCli(
      ['stale', '--scope', 'Notes/new-note.md', '--json'],
      {
        stdout: (text) => { stdout += text; },
        stderr: (text) => { stderr += text; },
        cwd: root,
      },
      { ceiling: 10 },
    );
    expect(code).toBe(0);
    expect(stderr).toBe('');
    const tooLarge = JSON.parse(stdout) as StaleResponse;
    expect(tooLarge.counts).toMatchObject({
      sources: 1,
      unreadable: 1,
      unreferenced: 0,
    });
    expect(tooLarge.items).toEqual([
      {
        category: 'unreadable',
        path: 'Notes/new-note.md',
        state: 'too_large',
        pages: [],
        pages_more: 0,
      },
    ]);
  });

  it('filters by --scope and rejects denied scopes', async () => {
    const root = await freshKb();
    await appendFile(join(root, 'Notes/meeting.md'), '\nChanged.\n');
    await writeFile(join(root, 'Notes/new-note.md'), '# New\n');
    await rm(join(root, 'Projects/policy notes.txt'));

    const scoped = await runStaleJson(root, ['stale', '--scope', 'Notes']);
    expect(scoped.counts).toEqual({
      sources: 3,
      pages: 5,
      changed: 1,
      missing: 0,
      moved: 0,
      unreadable: 0,
      unreferenced: 1,
    });
    expect(scoped.items.map((item) => [item.category, item.path])).toEqual([
      ['changed', 'Notes/meeting.md'],
      ['unreferenced', 'Notes/new-note.md'],
    ]);

    const textOut = await invoke(root, ['stale', '--scope', 'Notes']);
    expect(textOut.code).toBe(0);
    expect(textOut.stdout).toBe(
      [
        'sources: 3  pages: 5  changed: 1  missing: 0  moved: 0  unreadable: 0  unreferenced: 1',
        'changed\tNotes/meeting.md\t\twiki/record-preservation.md[s2]; wiki/wiki-compile-overview.md[s1]',
        'unreferenced\tNotes/new-note.md\tmarkdown\t',
        '',
      ].join('\n'),
    );

    await failure(root, ['stale', '--scope', 'wiki'], 'path_denied', 1);
  });

  it('pages through 60 unreferenced files and rejects stale snapshots', async () => {
    const root = await freshKb();
    const batchDir = join(root, 'Batch');
    await mkdir(batchDir, { recursive: true });
    for (let i = 1; i <= 60; i++) {
      const name = `file-${String(i).padStart(2, '0')}.md`;
      await writeFile(join(batchDir, name), `# File ${i}\n`);
    }

    const first = await runStaleJson(root, ['stale']);
    expect(first.counts.unreferenced).toBe(60);
    expect(first.returned).toBe(50);
    expect(first.more).toBe(true);
    expect(first.next).toEqual({ offset: 50, snapshot: first.snapshot });

    const second = await runStaleJson(root, [
      'stale',
      '--offset',
      String(first.next!.offset),
      '--snapshot',
      first.next!.snapshot,
    ]);
    expect(second.returned).toBe(10);
    expect(second.more).toBe(false);
    expect(second.next).toBeNull();

    const seen = [...first.items, ...second.items].map((item) => item.path);
    expect(seen).toHaveLength(60);
    expect(new Set(seen).size).toBe(60);

    // Adding a file invalidates the snapshot.
    await writeFile(join(batchDir, 'file-61.md'), '# File 61\n');
    await failure(
      root,
      ['stale', '--offset', String(first.next!.offset), '--snapshot', first.next!.snapshot],
      'stale_version',
      1,
    );
  });
});
