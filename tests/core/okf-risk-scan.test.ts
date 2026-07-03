import { describe, expect, it } from 'vitest';
import { scanRisks } from '../../src/core/okf/risk-scan';

describe('OKF risk scanner', () => {
  it('reports warning-only hints for each privacy heuristic', () => {
    const hints = scanRisks({
      pages: [{
        conceptId: 'entities/jay',
        sourcePath: 'entities/jay.md',
        dir: 'entities',
        frontmatter: { type: 'person', email: 'jay@example.com' },
        body: 'See https://docs.google.com/document/d/private/edit',
        outlinks: [],
        backlinks: [],
        contentHash: 'sha256-page',
      }],
      rawDependencies: [{
        path: 'Meetings/standup.md',
        title: 'Standup',
        body: 'Private notes',
        frontmatter: {},
        citedBy: ['entities/jay'],
        contentHash: 'sha256-raw',
      }],
    });

    expect(hints.map((hint) => hint.kind).sort()).toEqual([
      'email',
      'meeting-like-path',
      'person-page',
      'sensitive-url',
    ]);
    expect(hints.every((hint) => !('status' in hint))).toBe(true);
  });

  it('stays silent on clean content', () => {
    expect(scanRisks({
      pages: [{
        conceptId: 'concepts/search',
        sourcePath: 'concepts/search.md',
        dir: 'concepts',
        frontmatter: { type: 'concept' },
        body: 'Public research note.',
        outlinks: [],
        backlinks: [],
        contentHash: 'sha256-page',
      }],
      rawDependencies: [],
    })).toEqual([]);
  });
});
