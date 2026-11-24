import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readConfig } from '../../src/v2/core/config';
import { WIKI_DIR } from '../../src/v2/core/paths';
import { searchWiki } from '../../src/v2/core/search/wiki';
import type { RawSearchResult } from '../../src/v2/core/search/raw';
import type { WikiSearchResult } from '../../src/v2/core/search/wiki';
import { failure, invoke, jsonRun, makeKb } from './helpers';

const dirs: string[] = [];
async function kb(): Promise<string> {
  const dir = await makeKb();
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

type SearchJson<T> = T & { contract: string; ok: boolean; command: string };

function makeGeneratedPage(slug: string, title: string, extraBody = ''): string {
  return `---
type: concept
title: ${title}
description: Generated page covering ${title} and common widget orchestration.
status: current
created: 2026-10-01
updated: 2026-11-18
tags: [generated, widget]
---
# ${title}

## Current
- ${title} defines a standard widget orchestration rule (src: s1) ^c1
${extraBody}
## Evidence
Supporting notes for ${title}.

## Sources
- s1 · \`Notes/meeting.md\` · sha256:d1208ac88705fafed2c50282fb5460463f8e9e2c56973dfb2cee9eacb8b1e9d0 · heading Team meeting > Decisions > Next steps · "Review the source documents before compiling the wiki."

## History
- 2026-11-18 · created · by test
`;
}

describe('v2 search', () => {
  it('ranks wiki hits by alias with freshness, claim snippet, bidirectional relations, and abstains on nonsense', async () => {
    const root = await kb();
    const res = await jsonRun(root, ['search', 'original records rule']) as unknown as SearchJson<WikiSearchResult>;
    expect(res.command).toBe('search');
    expect(res.scope).toBe('wiki');
    expect(res.verdict).toBe('ok');
    expect(res.counts.searched).toBe(5);
    expect(res.hits.length).toBeGreaterThan(0);

    const first = res.hits[0];
    expect(first.path).toBe(`${WIKI_DIR}/record-preservation.md`);
    expect(first.freshness).toBe('disputed');
    expect(first.snippet).toMatch(/\^c\d+$/);
    expect(first.relations.some((r) => r.direction === 'out')).toBe(true);
    expect(first.relations.some((r) => r.direction === 'in' && r.type === 'derived_from' && r.page === 'wiki-compile-overview')).toBe(true);

    const textRun = await invoke(root, ['search', 'original records rule']);
    expect(textRun.code).toBe(0);
    expect(textRun.stdout).toContain('search wiki  verdict: ok');
    expect(textRun.stdout).toContain(`${WIKI_DIR}/record-preservation.md`);

    const miss = await jsonRun(root, ['search', 'zebra quantum harmonica']) as unknown as SearchJson<WikiSearchResult>;
    expect(miss.verdict).toBe('no_confident_match');
    expect(miss.hits).toEqual([]);
    expect(miss.returned).toBe(0);
  });

  it('does not match terms that occur only in ## History', async () => {
    const root = await kb();
    // "exempt" only appears in record-preservation.md under ## History
    const res = await jsonRun(root, ['search', 'exempt']) as unknown as SearchJson<WikiSearchResult>;
    expect(res.verdict).toBe('no_confident_match');
    expect(res.hits).toEqual([]);
  });

  it('reports freshness ok, then source_changed after editing, then source_missing after deletion', async () => {
    const root = await kb();

    const initial = await jsonRun(root, ['search', 'wiki compilation']) as unknown as SearchJson<WikiSearchResult>;
    expect(initial.verdict).toBe('ok');
    const overviewInitial = initial.hits.find((h) => h.path === `${WIKI_DIR}/wiki-compile-overview.md`);
    expect(overviewInitial?.freshness).toBe('ok');

    await writeFile(join(root, 'Notes/meeting.md'), '# Team meeting\n\nUpdated line.\n');
    const changed = await jsonRun(root, ['search', 'wiki compilation']) as unknown as SearchJson<WikiSearchResult>;
    const overviewChanged = changed.hits.find((h) => h.path === `${WIKI_DIR}/wiki-compile-overview.md`);
    expect(overviewChanged?.freshness).toBe('source_changed');

    await rm(join(root, 'Notes/meeting.md'));
    const missing = await jsonRun(root, ['search', 'wiki compilation']) as unknown as SearchJson<WikiSearchResult>;
    const overviewMissing = missing.hits.find((h) => h.path === `${WIKI_DIR}/wiki-compile-overview.md`);
    expect(overviewMissing?.freshness).toBe('source_missing');
  });

  it('searches raw sources for phrases, multiple files, spread terms, Chinese phrases, and abstains on nonsense', async () => {
    const root = await kb();

    const phrase = await jsonRun(root, ['search', 'review the source documents', '--scope', 'raw']) as unknown as SearchJson<RawSearchResult>;
    expect(phrase.scope).toBe('raw');
    expect(phrase.verdict).toBe('ok');
    expect(phrase.hits).toHaveLength(1);
    expect(phrase.hits[0].path).toBe('Notes/meeting.md');
    expect(phrase.hits[0].phrase).toBe(true);
    expect(phrase.hits[0].locator).toBe('heading Team meeting > Decisions > Next steps');

    // Write the same phrase into two more generated sources.
    await writeFile(join(root, 'Notes/extra-1.md'), '# Extra one\n\nPlease review the source documents carefully.\n');
    await writeFile(join(root, 'Notes/extra-2.txt'), 'Reminder: review the source documents today.\n');
    const multi = await jsonRun(root, ['search', 'review the source documents', '--scope', 'raw']) as unknown as SearchJson<RawSearchResult>;
    expect(multi.verdict).toBe('ok');
    expect(multi.hits.map((h) => h.path).sort()).toEqual(['Notes/extra-1.md', 'Notes/extra-2.txt', 'Notes/meeting.md']);

    // Spread terms within a single unit match without phrase=true.
    const spread = await jsonRun(root, ['search', 'compiling review documents', '--scope', 'raw']) as unknown as SearchJson<RawSearchResult>;
    expect(spread.verdict).toBe('ok');
    const meetingHit = spread.hits.find((h) => h.path === 'Notes/meeting.md');
    expect(meetingHit).toBeDefined();
    expect(meetingHit?.phrase).toBe(false);

    // Chinese phrase finds Notes/会议记录.txt.
    const zh = await jsonRun(root, ['search', '保留原始资料', '--scope', 'raw']) as unknown as SearchJson<RawSearchResult>;
    expect(zh.verdict).toBe('ok');
    expect(zh.hits.some((h) => h.path === 'Notes/会议记录.txt')).toBe(true);

    // Nonsense query gives no_confident_match.
    const miss = await jsonRun(root, ['search', 'zebra quantum harmonica', '--scope', 'raw']) as unknown as SearchJson<RawSearchResult>;
    expect(miss.verdict).toBe('no_confident_match');
    expect(miss.hits).toEqual([]);
  });

  it('counts unreadable raw files and exposes frontmatter title from raw Markdown', async () => {
    const root = await kb();
    await writeFile(join(root, 'Notes/broken.txt'), Buffer.from([0xff, 0xfe, 0x00, 0x80]));
    await writeFile(
      join(root, 'Notes/frontmatter-note.md'),
      '---\ntitle: Quarterly Alpha Memo\ndescription: Summary of alpha milestones.\n---\n# Body\n\nAlpha milestone zebrahorn confirmed.\n',
    );

    const res = await jsonRun(root, ['search', 'zebrahorn', '--scope', 'raw']) as unknown as SearchJson<RawSearchResult>;
    expect(res.verdict).toBe('ok');
    expect(res.counts.not_searched.unreadable).toBe(1);
    expect(res.hits).toHaveLength(1);
    expect(res.hits[0].path).toBe('Notes/frontmatter-note.md');
    expect(res.hits[0].title).toBe('Quarterly Alpha Memo');
    expect(res.hits[0].description).toBe('Summary of alpha milestones.');
  });

  it('pages through 30 matching pages, rejects stale snapshot on edit, and rejects --limit 26', async () => {
    const root = await kb();
    for (let i = 1; i <= 30; i++) {
      const slug = `widget-page-${String(i).padStart(2, '0')}`;
      await writeFile(join(root, WIKI_DIR, `${slug}.md`), makeGeneratedPage(slug, `Widget Page ${i}`));
    }

    const seen: string[] = [];
    let next: { offset: number; snapshot: string } | null = null;
    let firstSnapshot = '';

    do {
      const argv = ['search', 'widget orchestration', '--limit', '10'];
      if (next) argv.push('--offset', String(next.offset), '--snapshot', next.snapshot);
      const page = await jsonRun(root, argv) as unknown as SearchJson<WikiSearchResult>;
      expect(page.verdict).toBe('ok');
      if (!firstSnapshot) firstSnapshot = page.snapshot;
      for (const hit of page.hits) seen.push(hit.path);
      next = page.next;
    } while (next);

    expect(seen).toHaveLength(30);
    expect(new Set(seen).size).toBe(30);

    // Edit one page in between -> stale_version.
    await writeFile(join(root, `${WIKI_DIR}/widget-page-01.md`), makeGeneratedPage('widget-page-01', 'Widget Page 1 Updated'));
    await failure(root, ['search', 'widget orchestration', '--offset', '10', '--snapshot', firstSnapshot], 'stale_version', 1);

    // --limit 26 exits 2.
    await failure(root, ['search', 'widget orchestration', '--limit', '26'], 'invalid_invocation', 2);
  });

  it('searches 1,000 generated pages in-process under 5 seconds', async () => {
    const root = await kb();
    const writes: Promise<void>[] = [];
    for (let i = 1; i <= 1000; i++) {
      const slug = `perf-page-${String(i).padStart(4, '0')}`;
      const extra = i === 777 ? '- Special obsidian-beacon calibration rule (src: s1) ^c2\n' : '';
      writes.push(writeFile(join(root, WIKI_DIR, `${slug}.md`), makeGeneratedPage(slug, `Perf Page ${i}`, extra)));
    }
    await Promise.all(writes);

    const config = await readConfig(root);
    const start = performance.now();
    const res = await searchWiki(root, config, 'obsidian-beacon calibration');
    const elapsedMs = performance.now() - start;

    expect(res.verdict).toBe('ok');
    expect(res.counts.searched).toBe(1005);
    expect(res.hits[0].path).toBe(`${WIKI_DIR}/perf-page-0777.md`);
    expect(elapsedMs).toBeLessThan(5000);
    console.log(`[perf] 1,000-page wiki search: ${elapsedMs.toFixed(1)} ms`);
  }, 30000);
});
