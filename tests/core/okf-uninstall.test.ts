import { describe, expect, it } from 'vitest';
import { createOkfMockApp } from '../mocks/okf-app';
import { installBundle } from '../../src/core/okf/install';
import { uninstallBundle } from '../../src/core/okf/uninstall';
import { readInstalledBundles, writeInstalledBundles } from '../../src/core/okf/registry';
import type { BundleSourceEntry } from '../../src/core/okf/install-scan';

function manifest(id: string) {
  return {
    schemaVersion: 1,
    okfVersion: '0.1',
    id,
    title: 'Test Bundle',
    version: '0.1.0',
    creator: { name: 'Jay', url: '' },
    releasedAt: '2026-07-02T00:00:00.000Z',
    entrypoint: 'index.md',
    contentHash: 'sha256-abc',
    license: 'personal',
    knowleryVersion: '0.5.0',
    conceptCount: 1,
  };
}

function entriesFor(id: string): BundleSourceEntry[] {
  return [
    { path: 'knowlery-bundle.json', content: JSON.stringify(manifest(id)) },
    { path: 'index.md', content: '# Index' },
    {
      path: 'concepts/foo.md',
      content: '---\ntype: Concept\ntitle: Foo\ndescription: d\ndomain: x\ntimestamp: 2026-07-01T00:00:00.000Z\n---\n\nBody.',
    },
  ];
}

describe('uninstallBundle', () => {
  it('removes the library dir and the registry entry', async () => {
    const app = createOkfMockApp({ 'KNOWLEDGE.md': '# Vault\n' });
    await installBundle(app as never, entriesFor('jay.a'), { source: '/tmp/a.zip' });

    await uninstallBundle(app as never, 'jay.a');

    const registry = await readInstalledBundles(app as never);
    expect(registry.bundles['jay.a']).toBeUndefined();
    expect(Object.keys(app.writes).some((path) => path.startsWith('Library/jay.a/'))).toBe(false);
  });

  it('removes the KNOWLEDGE.md marker block when the last bundle is removed', async () => {
    const app = createOkfMockApp({ 'KNOWLEDGE.md': '# Vault\n' });
    await installBundle(app as never, entriesFor('jay.a'), { source: '/tmp/a.zip' });
    expect(app.writes['KNOWLEDGE.md']).toContain('KNOWLERY:INSTALLED_BUNDLES:BEGIN');

    await uninstallBundle(app as never, 'jay.a');
    expect(app.writes['KNOWLEDGE.md']).not.toContain('KNOWLERY:INSTALLED_BUNDLES:BEGIN');
  });

  it('keeps the marker block while other bundles remain installed', async () => {
    const app = createOkfMockApp({ 'KNOWLEDGE.md': '# Vault\n' });
    await installBundle(app as never, entriesFor('jay.a'), { source: '/tmp/a.zip' });
    await installBundle(app as never, entriesFor('jay.b'), { source: '/tmp/b.zip' });

    await uninstallBundle(app as never, 'jay.a');
    expect(app.writes['KNOWLEDGE.md']).toContain('KNOWLERY:INSTALLED_BUNDLES:BEGIN');
    const registry = await readInstalledBundles(app as never);
    expect(registry.bundles['jay.b']).toBeDefined();
  });

  it('is a no-op for an unknown bundle id', async () => {
    const app = createOkfMockApp({});
    await expect(uninstallBundle(app as never, 'not.installed')).resolves.toBeUndefined();
  });

  it('deletes Library/<bundleId>/ even if the registry\'s stored libraryPath field is wrong, and ignores the poisoned value', async () => {
    const app = createOkfMockApp({ 'KNOWLEDGE.md': '# Vault\n' });
    await installBundle(app as never, entriesFor('jay.a'), { source: '/tmp/a.zip' });

    const registry = await readInstalledBundles(app as never);
    registry.bundles['jay.a'].libraryPath = '.obsidian/plugins/knowlery/';
    await writeInstalledBundles(app as never, registry);

    await uninstallBundle(app as never, 'jay.a');

    expect(Object.keys(app.writes).some((path) => path.startsWith('Library/jay.a/'))).toBe(false);
    expect(Object.keys(app.writes).some((path) => path.startsWith('.obsidian/'))).toBe(false);
  });

  it('throws rather than deleting anything if the bundle id itself is unsafe', async () => {
    const app = createOkfMockApp({});
    const registry = { schemaVersion: 1 as const, bundles: { '..': {
      version: '0.1.0', title: 'x', source: 'x', installedAt: '2026-07-02T00:00:00.000Z',
      libraryPath: 'Library/../', manifestContentHash: 'sha256-a', installedContentHash: 'sha256-a',
      conformance: 'passed' as const, conformanceErrorCount: 0,
    } } };
    await writeInstalledBundles(app as never, registry);
    await expect(uninstallBundle(app as never, '..')).rejects.toThrow(/unsafe/i);
  });
});
