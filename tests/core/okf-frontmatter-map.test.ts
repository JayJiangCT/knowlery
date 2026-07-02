import { describe, expect, it } from 'vitest';
import { mapFrontmatterToOkf } from '../../src/core/okf/frontmatter-map';
import type { PageRecord } from '../../src/core/okf/shared';

describe('OKF frontmatter mapping', () => {
  it('maps extended Knowlery types and strips sources by default', () => {
    const page = pageRecord({
      conceptId: 'entities/jay',
      sourcePath: 'entities/jay.md',
      frontmatter: {
        type: 'person',
        title: 'Jay',
        updated: '2026-07-01',
        sources: ['Private/raw.md'],
        custom: 'kept',
      },
    });

    const result = mapFrontmatterToOkf(page);

    expect(result.frontmatter.type).toBe('Person');
    expect(result.frontmatter.timestamp).toBe('2026-07-01');
    expect(result.frontmatter.custom).toBe('kept');
    expect(result.frontmatter.sources).toBeUndefined();
  });

  it('preserves sources only with explicit opt-in', () => {
    const result = mapFrontmatterToOkf(pageRecord({
      conceptId: 'concepts/search',
      sourcePath: 'concepts/search.md',
      frontmatter: { type: 'concept', sources: ['Idea/search.md'] },
    }), { includeSources: true });

    expect(result.frontmatter.sources).toEqual(['Idea/search.md']);
  });

  it('falls back to directory type and reports mismatch warnings', () => {
    const missing = mapFrontmatterToOkf(pageRecord({
      conceptId: 'queries/missing',
      sourcePath: 'queries/missing.md',
      frontmatter: {},
    }));
    const mismatch = mapFrontmatterToOkf(pageRecord({
      conceptId: 'concepts/company',
      sourcePath: 'concepts/company.md',
      frontmatter: { type: 'entity' },
    }));

    expect(missing.frontmatter.type).toBe('Query');
    expect(missing.warnings[0].code).toBe('missing-input-type');
    expect(mismatch.frontmatter.type).toBe('Entity');
    expect(mismatch.warnings[0].code).toBe('type-directory-mismatch');
  });
});

function pageRecord(overrides: Partial<PageRecord>): PageRecord {
  return {
    conceptId: 'concepts/example',
    sourcePath: 'concepts/example.md',
    dir: 'concepts',
    frontmatter: {},
    body: '',
    outlinks: [],
    backlinks: [],
    contentHash: 'sha256-test',
    ...overrides,
  };
}
