import { describe, expect, it } from 'vitest';
import { createOkfMockApp, okfVaultFs } from '../mocks/okf-app';
import {
  readInstalledBundles,
  writeInstalledBundles,
  resolveInstallAction,
} from '../../src/core/okf/registry';
import type { InstalledBundleEntry } from '../../src/types';

describe('readInstalledBundles', () => {
  it('returns an empty registry when no file exists', async () => {
    const app = createOkfMockApp({});
    const registry = await readInstalledBundles(okfVaultFs(app));
    expect(registry).toEqual({ schemaVersion: 1, bundles: {} });
  });

  it('falls back to empty on malformed JSON', async () => {
    const app = createOkfMockApp({ '.knowlery/bundles.json': 'not json' });
    const registry = await readInstalledBundles(okfVaultFs(app));
    expect(registry).toEqual({ schemaVersion: 1, bundles: {} });
  });
});

describe('writeInstalledBundles', () => {
  it('round-trips through the adapter', async () => {
    const app = createOkfMockApp({});
    await writeInstalledBundles(okfVaultFs(app), {
      schemaVersion: 1,
      bundles: {
        'jay.drone-delivery': {
          version: '0.1.0',
          title: 'Drone Delivery',
          source: '/tmp/bundle.zip',
          installedAt: '2026-07-02T00:00:00.000Z',
          libraryPath: 'Library/jay.drone-delivery/',
          manifestContentHash: 'sha256-a',
          installedContentHash: 'sha256-a',
          conformance: 'passed',
          conformanceErrorCount: 0,
        },
      },
    });
    const reread = await readInstalledBundles(okfVaultFs(app));
    expect(reread.bundles['jay.drone-delivery'].title).toBe('Drone Delivery');
  });
});

describe('resolveInstallAction', () => {
  const installed: InstalledBundleEntry = {
    version: '0.1.0',
    title: 'Drone Delivery',
    source: '/tmp/bundle.zip',
    installedAt: '2026-07-02T00:00:00.000Z',
    libraryPath: 'Library/jay.drone-delivery/',
    manifestContentHash: 'sha256-a',
    installedContentHash: 'sha256-a',
    conformance: 'passed',
    conformanceErrorCount: 0,
  };

  it('allows a fresh install when nothing is installed yet', () => {
    expect(resolveInstallAction(undefined, '0.1.0')).toEqual({ kind: 'install' });
  });

  it('allows an update when the incoming version is newer', () => {
    expect(resolveInstallAction(installed, '0.2.0')).toEqual({ kind: 'update', fromVersion: '0.1.0' });
  });

  it('blocks a same-version reinstall', () => {
    expect(resolveInstallAction(installed, '0.1.0')).toEqual({ kind: 'blocked', installedVersion: '0.1.0' });
  });

  it('blocks a downgrade', () => {
    expect(resolveInstallAction(installed, '0.0.9')).toEqual({ kind: 'blocked', installedVersion: '0.1.0' });
  });

  it('compares version segments numerically, not lexically', () => {
    expect(resolveInstallAction({ ...installed, version: '0.9.0' }, '0.10.0')).toEqual({
      kind: 'update',
      fromVersion: '0.9.0',
    });
  });
});
