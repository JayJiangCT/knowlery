import { describe, expect, it } from 'vitest';
import { checkConformance } from '../../src/core/okf/conformance';
import type { BundleFile } from '../../src/core/okf/shared';

function concept(path: string, frontmatterLines: string[], body = 'Body.'): BundleFile {
  return {
    path,
    content: ['---', ...frontmatterLines, '---', '', body].join('\n'),
    kind: 'concept',
  };
}

const GOOD_INDEX: BundleFile = {
  path: 'index.md',
  content: '---\nokf_version: "0.1"\n---\n\n# KB\n\n## Concepts\n\n* [A](/concepts/a.md)\n',
  kind: 'index',
};
const GOOD_LOG: BundleFile = {
  path: 'log.md',
  content: '# Knowledge Update Log\n\n## 2026-07-01\n\n* **Initialization**: Bundle exported from Knowlery.\n',
  kind: 'log',
};

describe('OKF conformance check', () => {
  it('passes a good bundle including _sources copies', () => {
    const report = checkConformance([
      GOOD_INDEX,
      GOOD_LOG,
      concept('concepts/a.md', ['type: Concept', 'title: A', 'description: Fine', 'domain: ai', 'timestamp: 2026-06-01']),
      { path: '_sources/Idea/x.md', content: '---\ntype: Source\ntitle: x\nknowlery_raw_path: "Idea/x.md"\n---\n\nRaw.', kind: 'source' },
    ]);
    expect(report.conformant).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('flags a missing type as an error and missing description as a warning only', () => {
    const report = checkConformance([
      GOOD_INDEX,
      GOOD_LOG,
      concept('concepts/no-type.md', ['title: X']),
      concept('concepts/no-desc.md', ['type: Concept', 'title: Y', 'domain: ai', 'timestamp: 2026-06-01']),
    ]);
    expect(report.conformant).toBe(false);
    expect(report.errors.some((issue) => issue.code === 'missing-type' && issue.path === 'concepts/no-type.md')).toBe(true);
    expect(report.warnings.some((issue) => issue.code === 'missing-description' && issue.path === 'concepts/no-desc.md')).toBe(true);
    expect(report.errors.some((issue) => issue.path === 'concepts/no-desc.md')).toBe(false);
  });

  it('aggregates the field-quality report and names near-miss timestamp keys', () => {
    const report = checkConformance([
      GOOD_INDEX,
      GOOD_LOG,
      concept('concepts/near-miss.md', ['type: Concept', 'title: N', 'modified: 2026-06-01']),
      concept('entities/mismatch.md', ['type: Query', 'title: M', 'description: d', 'domain: ai', 'timestamp: 2026-06-01']),
    ]);

    expect(report.fieldQuality.missingDescription.count).toBe(1);
    expect(report.fieldQuality.missingTimestamp.count).toBe(1);
    expect(report.fieldQuality.missingTimestamp.pages[0]).toEqual({ path: 'concepts/near-miss.md', nearMissKey: 'modified' });
    expect(report.fieldQuality.missingDomain.count).toBe(1);
    expect(report.fieldQuality.typeMismatch.count).toBe(1);
    expect(report.warnings.some((issue) => issue.message.includes('found modified'))).toBe(true);
  });

  it('warns when the root index is missing the okf_version line', () => {
    const report = checkConformance([
      { path: 'index.md', content: '# KB\n\n* [A](/concepts/a.md)\n', kind: 'index' },
      GOOD_LOG,
    ]);
    expect(report.warnings.some((issue) => issue.code === 'missing-okf-version')).toBe(true);
  });
});
