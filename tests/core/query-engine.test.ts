import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractQueryTerms, prefixMatches } from '../../src/core/query/tokenize';
import { fieldText, scanVault, type ScannedPage, type VaultSnapshot } from '../../src/core/query/scan';
import { runQuery } from '../../src/core/query/engine';

const FIXTURE_VAULT = join(__dirname, '..', '..', 'evals', 'fixtures', 'vault');

function makePage(overrides: Partial<ScannedPage> & { path: string }): ScannedPage {
  return {
    title: overrides.path,
    tags: [],
    aliases: [],
    sources: [],
    tier: 'user',
    titleAlias: fieldText(''),
    tagBasename: fieldText(''),
    descriptionField: fieldText(''),
    body: fieldText(''),
    prefixTokens: [],
    ...overrides,
  } as ScannedPage;
}

function makeSnapshot(pages: ScannedPage[]): VaultSnapshot {
  return { root: '/fake', pages, bundleEntries: [] };
}

describe('extractQueryTerms', () => {
  it('drops stopwords and generates morphological variants', () => {
    const terms = extractQueryTerms('Why does the label keep breaking?');
    const label = terms.find((term) => term.raw === 'label');
    expect(label).toBeDefined();
    expect(label!.variants).toContain('labels');
    expect(terms.some((term) => term.raw === 'the')).toBe(false);
    expect(terms.some((term) => term.raw === 'why')).toBe(false);
  });

  it('maps -ed forms back to stems and forward to -ing', () => {
    const [picked] = extractQueryTerms('picked');
    expect(picked.variants).toContain('pick');
    expect(picked.variants).toContain('picking');
  });

  it('splits Chinese questions on function words and keeps content chunks', () => {
    const terms = extractQueryTerms('我们的采样策略是什么？');
    expect(terms.map((term) => term.raw)).toEqual(['采样策略']);
    expect(terms[0].cjk).toBe(true);
  });

  it('handles mixed-language questions', () => {
    const terms = extractQueryTerms('性能优化调研 mentions sampling?');
    const raws = terms.map((term) => term.raw);
    expect(raws).toContain('sampling');
    expect(raws).toContain('性能优化调研');
  });
});

describe('prefixMatches', () => {
  it('lets a long-enough abbreviation reach its full token', () => {
    expect(prefixMatches('colld', 'collector')).toBe(true);
  });

  it('rejects short or dissimilar terms', () => {
    expect(prefixMatches('coll', 'collector')).toBe(false); // below length 5
    expect(prefixMatches('backpressure', 'backend')).toBe(false);
    expect(prefixMatches('采样策略', '采样策略与其它')).toBe(false); // CJK uses substring matching instead
  });
});

describe('runQuery scoring', () => {
  it('weighs title matches above body matches', () => {
    const titleHit = makePage({
      path: 'concepts/alpha.md',
      title: 'Widget',
      titleAlias: fieldText('Widget'),
      tier: 'agent',
    });
    const bodyHit = makePage({
      path: 'concepts/beta.md',
      title: 'Other',
      titleAlias: fieldText('Other'),
      body: fieldText('widget widget widget'),
      tier: 'agent',
    });
    const result = runQuery('widget', makeSnapshot([titleHit, bodyHit]), 10);
    expect(result.verdict).toBe('ok');
    expect(result.candidates[0].path).toBe('concepts/alpha.md');
  });

  it('boosts an agent page when a source note it cites matches (source-graph boost)', () => {
    const chineseSource = makePage({
      path: 'Projects/调研.md',
      title: '调研',
      body: fieldText('推荐头部采样作为默认采样策略。'),
    });
    const compiledPage = makePage({
      path: 'concepts/sampling.md',
      title: 'Sampling Strategy',
      titleAlias: fieldText('Sampling Strategy'),
      sources: ['Projects/调研.md'],
      tier: 'agent',
    });
    const result = runQuery('我们的采样策略是什么？', makeSnapshot([chineseSource, compiledPage]), 10);
    expect(result.verdict).toBe('ok');
    const compiled = result.candidates.find((candidate) => candidate.path === 'concepts/sampling.md');
    expect(compiled).toBeDefined();
    expect(compiled!.evidence).toContain('Projects/调研.md');
  });

  it('abstains when nothing matches any structured field and body evidence is weak', () => {
    const noise = makePage({
      path: 'Daily/2026-01-01.md',
      title: '2026-01-01',
      body: fieldText('one stray mention of procurement'),
    });
    const result = runQuery('gpu procurement budget', makeSnapshot([noise]), 10);
    expect(result.verdict).toBe('no-confident-match');
    expect(result.candidates).toEqual([]);
  });

  it('does not abstain when a title matches', () => {
    const page = makePage({
      path: 'concepts/procurement.md',
      title: 'Procurement',
      titleAlias: fieldText('Procurement'),
      tier: 'agent',
    });
    const result = runQuery('gpu procurement budget', makeSnapshot([page]), 10);
    expect(result.verdict).toBe('ok');
  });
});

describe('scanVault', () => {
  it('scans the eval fixture with tiers, bundles, and instruction files excluded', () => {
    const snapshot = scanVault(FIXTURE_VAULT);
    const paths = snapshot.pages.map((page) => page.path);
    expect(paths).not.toContain('KNOWLEDGE.md');
    expect(paths).not.toContain('SCHEMA.md');
    expect(paths).toContain('concepts/response-time-metrics.md');
    expect(paths).toContain('Projects/性能优化调研.md');

    const agentPage = snapshot.pages.find((page) => page.path === 'concepts/response-time-metrics.md');
    expect(agentPage?.tier).toBe('agent');
    expect(agentPage?.sources).toContain('Daily/2026-04-05.md');

    expect(snapshot.bundleEntries.length).toBe(3);
    expect(snapshot.bundleEntries[0].path.startsWith('Library/observability-starter/')).toBe(true);
  });
});

describe('engine purity (spec f2, §7 criterion 1)', () => {
  it('query modules never import the obsidian module', () => {
    for (const file of ['engine.ts', 'scan.ts', 'tokenize.ts']) {
      const source = readFileSync(join(__dirname, '..', '..', 'src', 'core', 'query', file), 'utf8');
      expect(source).not.toMatch(/from ['"]obsidian['"]/);
    }
  });
});
