import { describe, expect, it } from 'vitest';
import { buildBundleManifest, contentHash } from '../../src/core/okf/manifest';
import type { BundleFile } from '../../src/core/okf/shared';

function file(path: string, content: string, kind: BundleFile['kind']): BundleFile {
  return { path, content, kind };
}

const CONCEPT_A = file('concepts/a.md', 'Alpha body', 'concept');
const CONCEPT_B = file('concepts/b.md', 'Beta body', 'concept');
const SOURCE = file('_sources/Idea/x.md', 'Raw body', 'source');
const VOLATILE: BundleFile[] = [
  file('log.md', 'log at 2026-07-01', 'log'),
  file('README.md', 'released 2026-07-01', 'readme'),
  file('agent-index.json', '{"generatedAt":"2026-07-01"}', 'agent-index'),
  file('knowlery-bundle.json', '{"releasedAt":"2026-07-01"}', 'manifest'),
  file('index.md', 'index', 'index'),
];

describe('bundle manifest content hash', () => {
  it('is stable under reordering of input files', () => {
    expect(contentHash([CONCEPT_A, CONCEPT_B, SOURCE])).toBe(contentHash([SOURCE, CONCEPT_B, CONCEPT_A]));
  });

  it('ignores volatile files but includes _sources content', () => {
    const base = contentHash([CONCEPT_A, CONCEPT_B, SOURCE]);
    expect(contentHash([CONCEPT_A, CONCEPT_B, SOURCE, ...VOLATILE])).toBe(base);
    expect(contentHash([CONCEPT_A, CONCEPT_B])).not.toBe(base);
  });

  it('changes when a concept body changes', () => {
    const before = contentHash([CONCEPT_A, CONCEPT_B]);
    const after = contentHash([CONCEPT_A, file('concepts/b.md', 'Beta body edited', 'concept')]);
    expect(after).not.toBe(before);
  });

  it('builds a schema-valid manifest', () => {
    const manifest = buildBundleManifest({
      id: 'tester.kb',
      title: 'KB',
      version: '0.1.0',
      creator: { name: 'Tester', url: '' },
      releasedAt: '2026-07-01T00:00:00.000Z',
      license: 'personal',
      knowleryVersion: '0.5.0',
      conceptCount: 2,
      files: [CONCEPT_A, CONCEPT_B],
    });
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.entrypoint).toBe('index.md');
    expect(manifest.contentHash.startsWith('sha256-')).toBe(true);
  });
});
