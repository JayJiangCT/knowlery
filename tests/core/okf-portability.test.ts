import { describe, expect, it } from 'vitest';
import {
  buildPortableSourcePathMap,
  findBundleIdPortabilityProblems,
  findPathPortabilityIssues,
  sanitizePortableSegment,
} from '../../src/core/okf/portability';

/**
 * Field finding (Linda's ENOENT on Windows): bundles exported on POSIX carried
 * `_sources/... | ....md` — a Windows-reserved character. These tests pin the
 * sanitizer to Win32 filename semantics and the map to order-independent
 * determinism, per the implementation review.
 */

describe('sanitizePortableSegment', () => {
  it('replaces Windows-reserved and control characters', () => {
    expect(sanitizePortableSegment('Wonder | Food On Demand.md')).toBe('Wonder - Food On Demand.md');
    expect(sanitizePortableSegment('a<b>c:d"e?f*g.md')).toBe('a-b-c-d-e-f-g.md');
    expect(sanitizePortableSegment('bell\u0007.md')).toBe('bell-.md');
  });

  it('strips trailing dots and spaces (Windows strips or rejects them)', () => {
    expect(sanitizePortableSegment('note.')).toBe('note');
    expect(sanitizePortableSegment('dir ')).toBe('dir');
    expect(sanitizePortableSegment('note.md ')).toBe('note.md');
  });

  it('guards reserved device names, with or without extension, any case', () => {
    expect(sanitizePortableSegment('CON')).toBe('_CON');
    expect(sanitizePortableSegment('aux.md')).toBe('_aux.md');
    expect(sanitizePortableSegment('Com3.txt')).toBe('_Com3.txt');
    expect(sanitizePortableSegment('console.md')).toBe('console.md'); // not a device name
  });

  it('never returns an empty segment', () => {
    expect(sanitizePortableSegment('???')).toBe('---');
    expect(sanitizePortableSegment('. ')).toBe('_');
  });
});

describe('buildPortableSourcePathMap', () => {
  it('sanitizes every directory level, not just the basename', () => {
    const map = buildPortableSourcePathMap(['News|Clips/CON/report?.md']);
    expect(map.get('News|Clips/CON/report?.md')).toBe('News-Clips/_CON/report-.md');
  });

  it('leaves already-portable paths untouched', () => {
    const map = buildPortableSourcePathMap(['Idea/private.md']);
    expect(map.get('Idea/private.md')).toBe('Idea/private.md');
  });

  it('suffixes case-insensitive collisions deterministically for every member', () => {
    const map = buildPortableSourcePathMap(['Notes/Foo.md', 'Notes/foo.md']);
    const first = map.get('Notes/Foo.md')!;
    const second = map.get('Notes/foo.md')!;
    expect(first).not.toBe(second);
    expect(first.toLowerCase()).not.toBe(second.toLowerCase());
    expect(first).toMatch(/^Notes\/Foo-[0-9a-f]{8}\.md$/);
    expect(second).toMatch(/^Notes\/foo-[0-9a-f]{8}\.md$/);
  });

  it('resolves collisions created by sanitization itself', () => {
    const map = buildPortableSourcePathMap(['a|b.md', 'a?b.md']);
    const first = map.get('a|b.md')!;
    const second = map.get('a?b.md')!;
    expect(first).not.toBe(second);
    expect(first.toLowerCase()).not.toBe(second.toLowerCase());
  });

  it('resolves collisions created by trailing-dot stripping', () => {
    const map = buildPortableSourcePathMap(['note.md', 'note.md.']);
    expect(map.get('note.md')).not.toBe(map.get('note.md.'));
  });

  it('is order-independent: the same path maps identically regardless of input order', () => {
    const forward = buildPortableSourcePathMap(['Notes/Foo.md', 'Notes/foo.md', 'x|y.md']);
    const reversed = buildPortableSourcePathMap(['x|y.md', 'Notes/foo.md', 'Notes/Foo.md']);
    for (const path of ['Notes/Foo.md', 'Notes/foo.md', 'x|y.md']) {
      expect(forward.get(path)).toBe(reversed.get(path));
    }
  });
});

describe('findPathPortabilityIssues', () => {
  it('reports reserved characters, trailing dots/spaces, and device names per segment', () => {
    const issues = findPathPortabilityIssues(['_sources/Wonder/News/Outstanding Operator - Wonder | Food On Demand.md']);
    expect(issues).toHaveLength(1);
    expect(issues[0].problems.join(' ')).toContain('Windows forbids');

    expect(findPathPortabilityIssues(['dir./note.md'])[0].problems.join(' ')).toContain('dot or space');
    expect(findPathPortabilityIssues(['aux.md'])[0].problems.join(' ')).toContain('reserved Windows device name');
    expect(findPathPortabilityIssues(['NUL. /x.md'])[0].problems.join(' ')).toContain('reserved Windows device name');
  });

  it('reports case-insensitive collisions across the set', () => {
    const issues = findPathPortabilityIssues(['a/B.md', 'a/b.md']);
    expect(issues).toHaveLength(2);
    expect(issues[0].problems.join(' ')).toContain('collides case-insensitively');
  });

  it('stays silent on portable sets', () => {
    expect(findPathPortabilityIssues(['index.md', 'concepts/foo.md', '_sources/Idea/private.md'])).toEqual([]);
  });
});

describe('findBundleIdPortabilityProblems', () => {
  it('flags reserved characters, device names, and trailing dots in bundle ids', () => {
    expect(findBundleIdPortabilityProblems('creator:wonder')).toHaveLength(1);
    expect(findBundleIdPortabilityProblems('con')).toHaveLength(1);
    expect(findBundleIdPortabilityProblems('creator.wonder.')).toHaveLength(1);
    expect(findBundleIdPortabilityProblems('creator.wonder.fulfillment')).toEqual([]);
  });
});
