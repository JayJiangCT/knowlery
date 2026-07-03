import { describe, expect, it } from 'vitest';
import {
  assertSafeBundleId,
  assertSafeInstallPath,
  inferBundleFileKind,
  previewInstall,
  type BundleSourceEntry,
} from '../../src/core/okf/install-scan';

describe('assertSafeInstallPath', () => {
  const root = 'Library/jay.drone-delivery';

  it('accepts a normal relative path and returns the joined path', () => {
    expect(assertSafeInstallPath(root, 'concepts/foo.md')).toBe('Library/jay.drone-delivery/concepts/foo.md');
  });

  it('rejects a parent-directory escape', () => {
    expect(() => assertSafeInstallPath(root, '../../SCHEMA.md')).toThrow(/unsafe/i);
  });

  it('rejects a parent-directory escape hidden mid-path', () => {
    expect(() => assertSafeInstallPath(root, 'concepts/../../../SCHEMA.md')).toThrow(/unsafe/i);
  });

  it('rejects a POSIX absolute path', () => {
    expect(() => assertSafeInstallPath(root, '/etc/passwd')).toThrow(/unsafe/i);
  });

  it('rejects a Windows absolute path', () => {
    expect(() => assertSafeInstallPath(root, 'C:\\Windows\\System32\\evil.md')).toThrow(/unsafe/i);
  });

  it('rejects a backslash parent-directory escape', () => {
    expect(() => assertSafeInstallPath(root, '..\\..\\SCHEMA.md')).toThrow(/unsafe/i);
  });
});

describe('assertSafeBundleId', () => {
  it('accepts a normal dotted id', () => {
    expect(() => assertSafeBundleId('jay.drone-delivery')).not.toThrow();
  });

  it('rejects an id that is exactly ".."', () => {
    expect(() => assertSafeBundleId('..')).toThrow(/unsafe/i);
  });

  it('rejects an id containing a slash', () => {
    expect(() => assertSafeBundleId('../../.obsidian/plugins/knowlery')).toThrow(/unsafe/i);
  });

  it('rejects an id containing a backslash', () => {
    expect(() => assertSafeBundleId('..\\..\\evil')).toThrow(/unsafe/i);
  });

  it('rejects an id with an empty dot-segment (hidden traversal without a slash)', () => {
    expect(() => assertSafeBundleId('foo..bar')).toThrow(/unsafe/i);
  });

  it('rejects an empty string', () => {
    expect(() => assertSafeBundleId('')).toThrow(/unsafe/i);
  });
});

describe('inferBundleFileKind', () => {
  it('classifies reserved and structural files', () => {
    expect(inferBundleFileKind('index.md')).toBe('index');
    expect(inferBundleFileKind('entities/index.md')).toBe('index');
    expect(inferBundleFileKind('log.md')).toBe('log');
    expect(inferBundleFileKind('README.md')).toBe('readme');
    expect(inferBundleFileKind('SCHEMA.md')).toBe('reference');
    expect(inferBundleFileKind('_sources/Idea/x.md')).toBe('source');
    expect(inferBundleFileKind('concepts/foo.md')).toBe('concept');
  });
});

const VALID_MANIFEST = {
  schemaVersion: 1,
  okfVersion: '0.1',
  id: 'jay.drone-delivery',
  title: 'Drone Delivery',
  version: '0.1.0',
  creator: { name: 'Jay', url: '' },
  releasedAt: '2026-07-02T00:00:00.000Z',
  entrypoint: 'index.md',
  contentHash: 'sha256-abc',
  license: 'personal',
  knowleryVersion: '0.5.0',
  conceptCount: 1,
};

function entries(overrides: BundleSourceEntry[] = []): BundleSourceEntry[] {
  return [
    { path: 'knowlery-bundle.json', content: JSON.stringify(VALID_MANIFEST) },
    { path: 'index.md', content: '---\nokf_version: "0.1"\n---\n\n# Drone Delivery\n' },
    {
      path: 'concepts/foo.md',
      content: '---\ntype: Concept\ntitle: Foo\ndescription: A thing\ndomain: delivery\ntimestamp: 2026-07-01T00:00:00.000Z\n---\n\nBody.',
    },
    ...overrides,
  ];
}

describe('previewInstall', () => {
  it('throws when the manifest file is missing', () => {
    expect(() => previewInstall([{ path: 'index.md', content: '# hi' }])).toThrow(/knowlery-bundle\.json/);
  });

  it('parses a valid manifest and reports conformance', () => {
    const preview = previewInstall(entries());
    expect(preview.manifest.id).toBe('jay.drone-delivery');
    expect(preview.conformance.conformant).toBe(true);
  });

  it('flags a missing type as a conformance error', () => {
    const preview = previewInstall(
      entries([{ path: 'concepts/bad.md', content: '---\ntitle: Bad\n---\n\nNo type.' }]),
    );
    expect(preview.conformance.conformant).toBe(false);
    expect(preview.conformance.errors.some((issue) => issue.code === 'missing-type')).toBe(true);
  });
});
