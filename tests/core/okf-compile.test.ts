import { describe, expect, it } from 'vitest';
import { compileBundle } from '../../src/core/okf/compile';
import type { CompileOptions } from '../../src/types';
import { createOkfMockApp, okfBundleSource } from '../mocks/okf-app';

const NOW = new Date('2026-07-02T00:00:00.000Z');

const BASE_VAULT: Record<string, string> = {
  'concepts/search.md': [
    '---',
    'type: concept',
    'title: Search',
    'domain: product',
    'updated: 2026-07-01',
    'sources:',
    '  - Idea/private.md',
    '---',
    '',
    'Search body [[Idea/private.md]].',
  ].join('\n'),
  'concepts/private.md': [
    '---',
    'type: concept',
    'title: Private',
    '---',
    '',
    'Should not ship.',
  ].join('\n'),
  'Idea/private.md': [
    '---',
    'type: note',
    'title: Private source',
    '---',
    '',
    'Raw source body.',
  ].join('\n'),
  'SCHEMA.md': '# Schema\n',
  '.knowlery/activity/2026-07-01.jsonl': JSON.stringify({
    time: '2026-07-01T00:00:00.000Z',
    agent: 'codex',
    type: 'analysis',
    topics: [],
    summary: 'Private activity detail.',
    dimensions: ['analysis'],
    questions: [],
    learned: [],
    thinking: [],
    followups: [],
    relatedFiles: [],
    captureState: 'unbaked',
    source: { kind: 'agent-session', visibility: 'private-summary', surface: 'knowledge' },
  }),
};

const BASE_OPTIONS: CompileOptions = {
  targetDir: '.knowlery/exports/test-bundle',
  bundleId: 'test.bundle',
  title: 'Test Bundle',
  version: '0.1.0',
  license: 'personal',
  creator: { name: 'Tester', url: '' },
  approvedConceptIds: ['concepts/search'],
  approvedRawPaths: ['Idea/private.md'],
  includeSchema: true,
  includeFullLog: false,
  includeSources: false,
  overwrite: true,
};

describe('OKF bundle compile', () => {
  it('exports only approved items and keeps share-safe defaults', async () => {
    const app = createOkfMockApp(BASE_VAULT);
    const result = await compileBundle(okfBundleSource(app), BASE_OPTIONS, NOW);

    expect(result.conceptCount).toBe(1);
    expect(result.rawSourceCount).toBe(1);
    const searchPage = app.writes['.knowlery/exports/test-bundle/concepts/search.md'];
    expect(searchPage).toContain('type: Concept');
    expect(searchPage).not.toContain('sources:');
    expect(app.writes['.knowlery/exports/test-bundle/concepts/private.md']).toBeUndefined();
    expect(app.writes['.knowlery/exports/test-bundle/_sources/Idea/private.md']).toContain('type: Source');
    expect(app.writes['.knowlery/exports/test-bundle/log.md']).not.toContain('Private activity detail');
    // Raw-notes-untouched invariant: no write ever targets a source path.
    expect(Object.keys(app.writes).some((path) => path === 'concepts/search.md' || path === 'Idea/private.md')).toBe(false);
  });

  it('writes reserved files in the spec shapes: okf_version index, dated minimal log, README', async () => {
    const app = createOkfMockApp(BASE_VAULT);
    await compileBundle(okfBundleSource(app), BASE_OPTIONS, NOW);

    const index = app.writes['.knowlery/exports/test-bundle/index.md'];
    expect(index.startsWith('---\nokf_version: "0.1"\n---\n')).toBe(true);
    expect(index).toContain('## Sources');

    const log = app.writes['.knowlery/exports/test-bundle/log.md'];
    expect(log).toContain('## 2026-07-02');
    expect(log).toContain('* **Initialization**: Bundle exported from Knowlery.');
    expect(log.startsWith('---')).toBe(false);

    expect(app.writes['.knowlery/exports/test-bundle/README.md']).toContain('type: Reference');

    const agentIndex = JSON.parse(app.writes['.knowlery/exports/test-bundle/agent-index.json']) as { generatedAt: string; groups: { byType: Record<string, string[]> }; rawSources: Array<{ citedBy: string[] }> };
    expect(agentIndex.generatedAt).toBe(NOW.toISOString());
    expect(agentIndex.groups.byType.Concept).toContain('concepts/search');
    expect(agentIndex.rawSources[0].citedBy).toEqual(['concepts/search']);
  });

  it('resolves approved raw links to ../_sources/ and reports them converted', async () => {
    const app = createOkfMockApp(BASE_VAULT);
    const result = await compileBundle(okfBundleSource(app), BASE_OPTIONS, NOW);
    expect(app.writes['.knowlery/exports/test-bundle/concepts/search.md']).toContain('](../_sources/Idea/private.md)');
    expect(result.wikilinksConverted).toBe(1);
    expect(result.unresolvedLinks).toEqual([]);
  });

  it('excludes any subtree containing a knowlery-bundle.json from pages and backlinks (D15)', async () => {
    const app = createOkfMockApp({
      ...BASE_VAULT,
      // An installed/prior bundle inside the vault, containing a copy of a
      // knowledge page that must not leak into the new compile.
      'Library/other.bundle/knowlery-bundle.json': '{"id":"other.bundle"}',
      'Library/other.bundle/concepts/search.md': BASE_VAULT['concepts/search.md'],
      'Library/other.bundle/concepts/foreign.md': '---\ntype: concept\ntitle: Foreign\n---\n\nForeign body.',
    });
    const clean = createOkfMockApp(BASE_VAULT);

    const withBundle = await compileBundle(okfBundleSource(app), BASE_OPTIONS, NOW);
    const without = await compileBundle(okfBundleSource(clean), BASE_OPTIONS, NOW);

    expect(withBundle.conceptCount).toBe(without.conceptCount);
    expect(app.writes['.knowlery/exports/test-bundle/concepts/foreign.md']).toBeUndefined();
    expect(app.writes['.knowlery/exports/test-bundle/index.md']).toBe(clean.writes['.knowlery/exports/test-bundle/index.md']);
  });

  it('survives YAML-hostile pages: a body opening with --- rules must not crash collection (D14)', async () => {
    const app = createOkfMockApp({
      ...BASE_VAULT,
      // No frontmatter; the body opens with a horizontal rule and contains
      // colon-heavy prose — gray-matter would throw parsing this as YAML.
      'concepts/hostile.md': [
        '---',
        'Handling constraints. Key insight: parent receipt lists only orders: [partial',
        '---',
        '',
        'More body text.',
      ].join('\n'),
    });

    const result = await compileBundle(okfBundleSource(app), {
      ...BASE_OPTIONS,
      approvedConceptIds: ['concepts/search', 'concepts/hostile'],
    }, NOW);

    expect(result.conceptCount).toBe(2);
    const hostile = app.writes['.knowlery/exports/test-bundle/concepts/hostile.md'];
    // Type inferred from the directory since no parseable frontmatter exists.
    expect(hostile).toContain('type: Concept');
    expect(hostile).toContain('Key insight: parent receipt lists only orders');
  });

  it('ships a bundle-scoped SCHEMA.md, not the vault-wide one', async () => {
    const app = createOkfMockApp({
      ...BASE_VAULT,
      'SCHEMA.md': [
        '# Knowledge Schema',
        '',
        '## Domain Taxonomy',
        '',
        '| Domain | Description |',
        '|--------|-------------|',
        '| product | Product knowledge |',
        '| acme-client | Confidential client work |',
        '',
      ].join('\n'),
    });
    await compileBundle(okfBundleSource(app), BASE_OPTIONS, NOW);

    const schema = app.writes['.knowlery/exports/test-bundle/SCHEMA.md'];
    // concepts/search.md declares domain: product — only that row survives.
    expect(schema).toContain('| product | Product knowledge |');
    expect(schema).not.toContain('acme-client');
    expect(schema).toContain('type: Reference');
  });

  it('keeps sources verbatim and projects the full log only when opted in', async () => {
    const app = createOkfMockApp(BASE_VAULT);
    await compileBundle(okfBundleSource(app), {
      ...BASE_OPTIONS,
      includeSources: true,
      includeFullLog: true,
    }, NOW);

    expect(app.writes['.knowlery/exports/test-bundle/concepts/search.md']).toContain('sources:');
    expect(app.writes['.knowlery/exports/test-bundle/log.md']).toContain('Private activity detail');
  });
});

describe('Windows-portable source paths (field finding: `|` in a web-clip title broke install on Windows)', () => {
  const PIPE_SOURCE = 'Wonder/News/Outstanding Operator - Wonder | Food On Demand.md';
  const COLON_SOURCE = 'Wonder/Fulfillment: The Wonder Story.md';

  const vault = () => ({
    ...BASE_VAULT,
    'concepts/wonder.md': [
      '---',
      'type: concept',
      'title: Wonder',
      'domain: product',
      'updated: 2026-07-01',
      'sources:',
      `  - ${PIPE_SOURCE}`,
      '---',
      '',
      'Wonder body [[Fulfillment: The Wonder Story]].',
    ].join('\n'),
    [PIPE_SOURCE]: '---\ntype: note\ntitle: Wonder clip\n---\n\nClip body.',
    [COLON_SOURCE]: '---\ntype: note\ntitle: Fulfillment story\n---\n\nStory body.',
  });

  const options = {
    ...BASE_OPTIONS,
    approvedConceptIds: ['concepts/wonder'],
    approvedRawPaths: [PIPE_SOURCE, COLON_SOURCE],
  };

  it('emits sanitized _sources files and never the original hostile paths', async () => {
    const app = createOkfMockApp(vault());
    await compileBundle(okfBundleSource(app), options, NOW);

    const out = '.knowlery/exports/test-bundle';
    expect(app.writes[`${out}/_sources/Wonder/News/Outstanding Operator - Wonder - Food On Demand.md`]).toContain('Clip body.');
    expect(app.writes[`${out}/_sources/Wonder/Fulfillment- The Wonder Story.md`]).toContain('Story body.');
    expect(app.writes[`${out}/_sources/${PIPE_SOURCE}`]).toBeUndefined();
    expect(app.writes[`${out}/_sources/${COLON_SOURCE}`]).toBeUndefined();
  });

  it('provenance keeps the original vault path while the emitted name is portable', async () => {
    const app = createOkfMockApp(vault());
    await compileBundle(okfBundleSource(app), options, NOW);

    const copy = app.writes['.knowlery/exports/test-bundle/_sources/Wonder/News/Outstanding Operator - Wonder - Food On Demand.md'];
    expect(copy).toContain('Wonder | Food On Demand.md');
  });

  it('wikilinks, the root index, and the agent index all use the same mapped paths', async () => {
    const app = createOkfMockApp(vault());
    await compileBundle(okfBundleSource(app), options, NOW);

    const page = app.writes['.knowlery/exports/test-bundle/concepts/wonder.md'];
    expect(page).toContain('_sources/Wonder/Fulfillment-%20The%20Wonder%20Story.md');
    expect(page).not.toContain('Fulfillment:%20The');

    const index = app.writes['.knowlery/exports/test-bundle/index.md'];
    expect(index).toContain('Outstanding%20Operator%20-%20Wonder%20-%20Food%20On%20Demand.md');
    expect(index).not.toContain('%7C'); // no encoded pipe anywhere

    const agentIndex = JSON.parse(app.writes['.knowlery/exports/test-bundle/agent-index.json']) as { rawSources: Array<{ path: string }> };
    const rawPaths = agentIndex.rawSources.map((source) => source.path).sort();
    expect(rawPaths).toEqual([
      '_sources/Wonder/Fulfillment- The Wonder Story.md',
      '_sources/Wonder/News/Outstanding Operator - Wonder - Food On Demand.md',
    ]);
  });

  it('the manifest content hash is computed over the mapped paths (bundle is self-consistent)', async () => {
    const app = createOkfMockApp(vault());
    await compileBundle(okfBundleSource(app), options, NOW);

    const out = '.knowlery/exports/test-bundle';
    const manifest = JSON.parse(app.writes[`${out}/knowlery-bundle.json`]) as { contentHash: string };
    const { contentHash } = await import('../../src/core/okf/manifest');
    const recomputed = contentHash([
      { path: 'concepts/wonder.md', content: app.writes[`${out}/concepts/wonder.md`], kind: 'concept' },
      { path: '_sources/Wonder/News/Outstanding Operator - Wonder - Food On Demand.md', content: app.writes[`${out}/_sources/Wonder/News/Outstanding Operator - Wonder - Food On Demand.md`], kind: 'source' },
      { path: '_sources/Wonder/Fulfillment- The Wonder Story.md', content: app.writes[`${out}/_sources/Wonder/Fulfillment- The Wonder Story.md`], kind: 'source' },
    ]);
    expect(manifest.contentHash).toBe(recomputed);
  });
});
