import { describe, expect, it } from 'vitest';
import { projectIndexes, type IndexEntryInput } from '../../src/core/okf/index-project';
import type { RawDependency } from '../../src/core/okf/shared';

const NOW = new Date('2026-07-01T00:00:00.000Z');

function entry(overrides: Partial<IndexEntryInput> & { conceptId: string }): IndexEntryInput {
  return {
    path: `${overrides.conceptId}.md`,
    frontmatter: { type: 'Concept', title: overrides.conceptId.split('/').pop() },
    backlinks: [],
    outlinks: [],
    ...overrides,
  };
}

function raw(path: string, citedBy: string[]): RawDependency {
  return { path, title: path.split('/').pop()!.replace(/\.md$/, ''), body: '', frontmatter: {}, citedBy, contentHash: 'sha256-r' };
}

describe('index projection', () => {
  it('carries the okf_version frontmatter line and groups the root index by mapped type', () => {
    const result = projectIndexes({
      title: 'Test KB',
      entries: [
        entry({ conceptId: 'entities/anthropic', frontmatter: { type: 'Entity', title: 'Anthropic', description: 'AI safety company', timestamp: '2026-06-19T00:00:00.000Z' } }),
        entry({ conceptId: 'concepts/llm-wiki', frontmatter: { type: 'Concept', title: 'LLM Wiki' } }),
        entry({ conceptId: 'queries/portability', frontmatter: { type: 'Query', title: 'Portability?' } }),
      ],
      rawSources: [],
      unresolvedLinks: [],
      now: NOW,
      staleThresholdDays: 90,
    });

    expect(result.rootIndex.startsWith('---\nokf_version: "0.1"\n---\n')).toBe(true);
    const entityPos = result.rootIndex.indexOf('## Entities');
    const conceptPos = result.rootIndex.indexOf('## Concepts');
    const queryPos = result.rootIndex.indexOf('## Queries');
    expect(entityPos).toBeGreaterThan(-1);
    expect(conceptPos).toBeGreaterThan(entityPos);
    expect(queryPos).toBeGreaterThan(conceptPos);
    // Entry format: * [title](/path) - description _(updated Nd ago)_
    expect(result.rootIndex).toContain('* [Anthropic](/entities/anthropic.md) - AI safety company _(updated 12d ago)_');
  });

  it('caps Recently Updated at 10 sorted newest-first', () => {
    const entries = Array.from({ length: 12 }, (_, index) => entry({
      conceptId: `concepts/page-${String(index).padStart(2, '0')}`,
      frontmatter: {
        type: 'Concept',
        title: `Page ${index}`,
        timestamp: `2026-06-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      },
    }));
    const { rootIndex } = projectIndexes({
      title: 'T', entries, rawSources: [], unresolvedLinks: [], now: NOW, staleThresholdDays: 90,
    });

    const recentSection = rootIndex.slice(rootIndex.indexOf('## Recently Updated'));
    const lines = recentSection.split('\n').filter((line) => line.startsWith('* ['));
    expect(lines).toHaveLength(10);
    expect(lines[0]).toContain('Page 11');
    expect(lines[9]).toContain('Page 2');
  });

  it('groups entities/concepts dir indexes by domain and keeps queries flat', () => {
    const { dirIndexes } = projectIndexes({
      title: 'T',
      entries: [
        entry({ conceptId: 'entities/a', frontmatter: { type: 'Entity', title: 'A', domain: 'ai' } }),
        entry({ conceptId: 'entities/b', frontmatter: { type: 'Entity', title: 'B', domain: 'ops' } }),
        entry({ conceptId: 'queries/q', frontmatter: { type: 'Query', title: 'Q' } }),
      ],
      rawSources: [],
      unresolvedLinks: [],
      now: NOW,
      staleThresholdDays: 90,
    });

    const entitiesIndex = dirIndexes.find((file) => file.path === 'entities/index.md')!;
    expect(entitiesIndex.content).toContain('## ai');
    expect(entitiesIndex.content).toContain('## ops');
    const queriesIndex = dirIndexes.find((file) => file.path === 'queries/index.md')!;
    expect(queriesIndex.content).not.toContain('## ');
  });

  it('emits the full agent-index: fields, byType/byDomain groups, stale, rawSources, unresolvedLinks', () => {
    const result = projectIndexes({
      title: 'T',
      entries: [
        entry({
          conceptId: 'entities/anthropic',
          frontmatter: {
            type: 'Entity',
            title: 'Anthropic',
            domain: 'ai',
            tags: ['ai', 'labs'],
            status: 'active',
            timestamp: '2026-01-01T00:00:00.000Z',
            contradictions: [],
          },
          backlinks: ['concepts/llm-wiki'],
          outlinks: ['concepts/okf'],
        }),
        entry({ conceptId: 'concepts/okf', frontmatter: { type: 'Concept', title: 'OKF', domain: 'ai', timestamp: '2026-06-30T00:00:00.000Z' } }),
      ],
      rawSources: [raw('Idea/notes.md', ['entities/anthropic'])],
      unresolvedLinks: [{ from: 'concepts/okf', raw: 'Deleted' }],
      now: NOW,
      staleThresholdDays: 90,
    });

    const anthropic = result.agentIndex.concepts.find((concept) => concept.id === 'entities/anthropic')!;
    expect(anthropic.daysSinceUpdate).toBe(181);
    expect(anthropic.backlinks).toEqual(['concepts/llm-wiki']);
    expect(anthropic.outlinks).toEqual(['concepts/okf']);
    expect(anthropic.tags).toEqual(['ai', 'labs']);
    expect(anthropic.status).toBe('active');

    expect(result.agentIndex.groups.byType.Entity).toEqual(['entities/anthropic']);
    expect(result.agentIndex.groups.byDomain.ai).toContain('concepts/okf');
    expect(result.agentIndex.stale).toEqual(['entities/anthropic']);
    expect(result.staleCount).toBe(1);
    expect(result.agentIndex.unresolvedLinks).toEqual([{ from: 'concepts/okf', raw: 'Deleted' }]);
    expect(result.agentIndex.rawSources).toEqual([
      { path: '_sources/Idea/notes.md', title: 'notes', citedBy: ['entities/anthropic'] },
    ]);
    expect(result.agentIndex.generatedAt).toBe(NOW.toISOString());
  });
});
