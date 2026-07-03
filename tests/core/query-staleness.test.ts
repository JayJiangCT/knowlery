import { describe, expect, it } from 'vitest';
import { fieldText, type ScannedPage, type VaultSnapshot } from '../../src/core/query/scan';
import { buildRecookPrompt, computeStaleness } from '../../src/core/query/staleness';
import { formatStalenessReport } from '../../src/core/query/format';
import { STALE_CLI_WARMING, handleStaleCli } from '../../src/core/query/cli-handler';

function makePage(overrides: Partial<ScannedPage> & { path: string; mtimeMs: number }): ScannedPage {
  return {
    title: overrides.path,
    tags: [],
    aliases: [],
    sources: [],
    tier: 'user',
    raw: {},
    titleAlias: fieldText(''),
    tagBasename: fieldText(''),
    descriptionField: fieldText(''),
    body: fieldText(''),
    prefixTokens: [],
    ...overrides,
  } as ScannedPage;
}

function snapshot(pages: ScannedPage[]): VaultSnapshot {
  return { root: '', pages, bundleEntries: [] };
}

describe('computeStaleness (spec f3, §4.2)', () => {
  it('flags a page whose cited source changed after the page was written', () => {
    const report = computeStaleness(snapshot([
      makePage({ path: 'Daily/a.md', mtimeMs: 2000 }),
      makePage({ path: 'concepts/x.md', mtimeMs: 1000, tier: 'agent', sources: ['Daily/a.md'] }),
    ]));
    expect(report.stalePages).toHaveLength(1);
    expect(report.stalePages[0].path).toBe('concepts/x.md');
    expect(report.stalePages[0].changedSources).toEqual([
      { path: 'Daily/a.md', sourceMtimeMs: 2000, pageMtimeMs: 1000 },
    ]);
  });

  it('treats equal mtimes as fresh (cook writing both in one pass)', () => {
    const report = computeStaleness(snapshot([
      makePage({ path: 'Daily/a.md', mtimeMs: 1000 }),
      makePage({ path: 'concepts/x.md', mtimeMs: 1000, tier: 'agent', sources: ['Daily/a.md'] }),
    ]));
    expect(report.stalePages).toHaveLength(0);
  });

  it('reports sources that resolve to nothing as dangling, not stale', () => {
    const report = computeStaleness(snapshot([
      makePage({ path: 'concepts/x.md', mtimeMs: 1000, tier: 'agent', sources: ['Daily/gone.md'] }),
    ]));
    expect(report.stalePages).toHaveLength(0);
    expect(report.danglingSources).toEqual([{ page: 'concepts/x.md', source: 'Daily/gone.md' }]);
  });

  it('normalizes backslashes in source paths', () => {
    const report = computeStaleness(snapshot([
      makePage({ path: 'Daily/a.md', mtimeMs: 2000 }),
      makePage({ path: 'concepts/x.md', mtimeMs: 1000, tier: 'agent', sources: ['Daily\\a.md'] }),
    ]));
    expect(report.stalePages).toHaveLength(1);
    expect(report.danglingSources).toHaveLength(0);
  });

  it('lists uncooked user notes, excluding cited notes, Library/, and agent pages', () => {
    const report = computeStaleness(snapshot([
      makePage({ path: 'Daily/cited.md', mtimeMs: 500 }),
      makePage({ path: 'Projects/new.md', mtimeMs: 3000 }),
      makePage({ path: 'Projects/older.md', mtimeMs: 2000 }),
      makePage({ path: 'Library/pack/concepts/thing.md', mtimeMs: 4000 }),
      makePage({ path: 'concepts/x.md', mtimeMs: 1000, tier: 'agent', sources: ['Daily/cited.md'] }),
    ]));
    expect(report.uncookedNotes.map((note) => note.path)).toEqual([
      'Projects/new.md',
      'Projects/older.md',
    ]);
  });

  it('orders stale pages by most recently changed source, deterministically', () => {
    const report = computeStaleness(snapshot([
      makePage({ path: 'Daily/a.md', mtimeMs: 2000 }),
      makePage({ path: 'Daily/b.md', mtimeMs: 5000 }),
      makePage({ path: 'concepts/x.md', mtimeMs: 1000, tier: 'agent', sources: ['Daily/a.md'] }),
      makePage({ path: 'concepts/y.md', mtimeMs: 1000, tier: 'agent', sources: ['Daily/b.md'] }),
    ]));
    expect(report.stalePages.map((finding) => finding.path)).toEqual(['concepts/y.md', 'concepts/x.md']);
  });
});

describe('staleness transports (spec f3, §4.3)', () => {
  const staleVault = snapshot([
    makePage({ path: 'Daily/a.md', mtimeMs: 2000 }),
    makePage({ path: 'concepts/x.md', mtimeMs: 1000, tier: 'agent', sources: ['Daily/a.md'] }),
  ]);

  it('handler and headless renderer produce identical reports', () => {
    const headless = formatStalenessReport(computeStaleness(staleVault)).trimEnd();
    const inApp = handleStaleCli({}, staleVault);
    expect(inApp).toBe(headless);
  });

  it('handler returns a string synchronously and warms up gracefully', () => {
    const result: unknown = handleStaleCli({}, null);
    expect(result).toBe(STALE_CLI_WARMING);
    expect(typeof handleStaleCli({}, staleVault)).toBe('string');
  });

  it('json mode emits the structured report', () => {
    const parsed = JSON.parse(handleStaleCli({ json: 'true' }, staleVault));
    expect(parsed.stalePages).toHaveLength(1);
    expect(parsed.uncookedNotes).toEqual([]);
  });

  it('renders empty-state lines when nothing is stale', () => {
    const clean = snapshot([makePage({ path: 'Daily/a.md', mtimeMs: 100 })]);
    const text = formatStalenessReport(computeStaleness(clean));
    expect(text).toContain('Stale pages: none.');
  });
});

describe('buildRecookPrompt (spec f3, §4.4)', () => {
  it('scopes the prompt to stale pages and their changed sources', () => {
    const prompt = buildRecookPrompt(computeStaleness(snapshot([
      makePage({ path: 'Daily/a.md', mtimeMs: 2000 }),
      makePage({ path: 'concepts/x.md', mtimeMs: 1000, tier: 'agent', sources: ['Daily/a.md'] }),
    ])));
    expect(prompt).toContain('- concepts/x.md');
    expect(prompt).toContain('changed source: Daily/a.md');
    expect(prompt).toContain('/cook');
  });
});
