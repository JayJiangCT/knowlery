import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { buildReadme, buildSourceCopy } from '../../src/core/okf/bundle-docs';
import type { BundleManifest } from '../../src/types';

describe('OKF bundle docs', () => {
  it('injects Source frontmatter without mutating the raw type meaning', () => {
    const source = buildSourceCopy({
      path: 'Idea/private.md',
      title: 'Private',
      body: [
        '---',
        'type: note',
        'title: Raw Title',
        'custom: kept',
        '---',
        '',
        'Raw body',
      ].join('\n'),
      frontmatter: {},
      citedBy: ['concepts/example'],
      contentHash: 'sha256-source',
    });
    const parsed = matter(source);

    expect(parsed.data.type).toBe('Source');
    expect(parsed.data.knowlery_raw_type).toBe('note');
    expect(parsed.data.knowlery_raw_path).toBe('Idea/private.md');
    expect(parsed.data.custom).toBe('kept');
    expect(parsed.content).toContain('Raw body');
  });

  it('creates a conformant README reference', () => {
    const readme = buildReadme(manifest());
    const parsed = matter(readme);

    expect(parsed.data.type).toBe('Reference');
    expect(parsed.content).toContain('Point your agent at `index.md`');
  });
});

function manifest(): BundleManifest {
  return {
    schemaVersion: 1,
    okfVersion: '0.1',
    id: 'jay.workspace',
    title: 'Jay WorkSpace',
    version: '0.1.0',
    creator: { name: 'Jay', url: '' },
    releasedAt: '2026-07-01T00:00:00.000Z',
    entrypoint: 'index.md',
    contentHash: 'sha256-test',
    license: 'personal',
    knowleryVersion: '0.5.0',
    conceptCount: 1,
  };
}
