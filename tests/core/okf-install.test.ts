import { describe, expect, it } from 'vitest';
import { createOkfMockApp } from '../mocks/okf-app';
import { installBundle, InstallBlockedError } from '../../src/core/okf/install';
import { readInstalledBundles } from '../../src/core/okf/registry';
import type { BundleSourceEntry } from '../../src/core/okf/install-scan';

function manifest(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function goodEntries(overrides: BundleSourceEntry[] = []): BundleSourceEntry[] {
  return [
    { path: 'knowlery-bundle.json', content: JSON.stringify(manifest()) },
    { path: 'index.md', content: '---\nokf_version: "0.1"\n---\n\n# Drone Delivery\n' },
    {
      path: 'concepts/foo.md',
      content:
        '---\ntype: Concept\ntitle: Foo\ndescription: A thing\ndomain: delivery\ntimestamp: 2026-07-01T00:00:00.000Z\n---\n\nBody.',
    },
    ...overrides,
  ];
}

describe('installBundle', () => {
  it('writes every entry under Library/<id>/ and registers the bundle', async () => {
    const app = createOkfMockApp({ 'KNOWLEDGE.md': '# Vault\n' });
    const result = await installBundle(app as never, goodEntries(), { source: '/tmp/bundle.zip' });

    expect(result).toEqual({
      id: 'jay.drone-delivery',
      version: '0.1.0',
      libraryPath: 'Library/jay.drone-delivery/',
      conformance: 'passed',
      conformanceErrorCount: 0,
    });
    expect(app.writes['Library/jay.drone-delivery/index.md']).toContain('# Drone Delivery');
    expect(app.writes['Library/jay.drone-delivery/concepts/foo.md']).toContain('Body.');

    const registry = await readInstalledBundles(app as never);
    expect(registry.bundles['jay.drone-delivery'].version).toBe('0.1.0');
    expect(registry.bundles['jay.drone-delivery'].manifestContentHash).toBe('sha256-abc');
  });

  it('adds the KNOWLEDGE.md marker block on first install', async () => {
    const app = createOkfMockApp({ 'KNOWLEDGE.md': '# Vault\n' });
    await installBundle(app as never, goodEntries(), { source: '/tmp/bundle.zip' });
    expect(app.writes['KNOWLEDGE.md']).toContain('KNOWLERY:INSTALLED_BUNDLES:BEGIN');
  });

  it('refuses to write outside Library/<id>/ even if an entry tries to escape', async () => {
    // The malicious entry must itself be conformant (valid frontmatter,
    // non-empty type) — otherwise checkConformance's 'missing-type' error
    // trips the conformance gate first and the test would pass for the
    // wrong reason, never exercising assertSafeInstallPath at all.
    const app = createOkfMockApp({});
    await expect(
      installBundle(
        app as never,
        goodEntries([{ path: '../../SCHEMA.md', content: '---\ntype: Concept\n---\n\nEvil.' }]),
        { source: '/tmp/bundle.zip' },
      ),
    ).rejects.toThrow(/unsafe/i);
    expect(Object.keys(app.writes)).not.toContain('SCHEMA.md');
  });

  it('refuses to install a bundle whose manifest id is a path-traversal payload', async () => {
    const app = createOkfMockApp({});
    const evilEntries = goodEntries().map((entry) =>
      entry.path === 'knowlery-bundle.json'
        ? { path: entry.path, content: JSON.stringify(manifest({ id: '..' })) }
        : entry,
    );
    await expect(installBundle(app as never, evilEntries, { source: '/tmp/evil.zip' })).rejects.toThrow(/unsafe/i);
    expect(Object.keys(app.writes).some((path) => path.startsWith('Library/'))).toBe(false);
  });

  it('blocks a same-version reinstall unless forced', async () => {
    const app = createOkfMockApp({});
    await installBundle(app as never, goodEntries(), { source: '/tmp/bundle.zip' });
    await expect(installBundle(app as never, goodEntries(), { source: '/tmp/bundle.zip' })).rejects.toBeInstanceOf(
      InstallBlockedError,
    );
    await expect(
      installBundle(app as never, goodEntries(), { source: '/tmp/bundle.zip', force: true }),
    ).resolves.toBeTruthy();
  });

  it('blocks on conformance errors unless the gate is explicitly skipped', async () => {
    const app = createOkfMockApp({});
    const badEntries = goodEntries([{ path: 'concepts/bad.md', content: '---\ntitle: Bad\n---\n\nNo type.' }]);
    await expect(installBundle(app as never, badEntries, { source: '/tmp/bundle.zip' })).rejects.toBeInstanceOf(
      InstallBlockedError,
    );
    const result = await installBundle(app as never, badEntries, {
      source: '/tmp/bundle.zip',
      skipConformanceGate: true,
    });
    expect(result.conformance).toBe('skipped');
    const registry = await readInstalledBundles(app as never);
    expect(registry.bundles['jay.drone-delivery'].conformance).toBe('skipped');
    expect(registry.bundles['jay.drone-delivery'].conformanceErrorCount).toBeGreaterThan(0);
  });
});
