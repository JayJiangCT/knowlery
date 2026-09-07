import { describe, expect, it } from 'vitest';
import { createOkfMockApp, okfVaultFs } from '../mocks/okf-app';
import {
  ensureInstalledBundlesBlock,
  removeInstalledBundlesBlock,
  refreshInstalledBundlesBlock,
  INSTALLED_BUNDLES_BEGIN_MARKER,
  INSTALLED_BUNDLES_END_MARKER,
} from '../../src/core/okf/knowledge-md-bundles';

const BASE_KNOWLEDGE_MD = '# My Vault\n\nSome prose here.\n';

const STALE_BLOCK = [
  INSTALLED_BUNDLES_BEGIN_MARKER,
  '9. Old wording pointing at `Library/<id>/index.md`.',
  INSTALLED_BUNDLES_END_MARKER,
].join('\n');

const REGISTRY_WITH_BUNDLE = JSON.stringify({
  schemaVersion: 1,
  bundles: {
    'jay.drone-delivery': {
      version: '0.1.0',
      title: 'Drone Delivery',
      source: '/tmp/bundle.zip',
      installedAt: '2026-07-02T00:00:00.000Z',
      libraryPath: 'Library/jay.drone-delivery/',
      manifestContentHash: 'sha256-abc',
      installedContentHash: 'sha256-def',
      conformance: 'passed',
      conformanceErrorCount: 0,
    },
  },
});

describe('ensureInstalledBundlesBlock', () => {
  it('appends the marker block when absent', () => {
    const updated = ensureInstalledBundlesBlock(BASE_KNOWLEDGE_MD);
    expect(updated).toContain(INSTALLED_BUNDLES_BEGIN_MARKER);
    expect(updated).toContain(INSTALLED_BUNDLES_END_MARKER);
    expect(updated).toContain('.knowlery/bundles.json');
    expect(updated).toContain('Library/<id>/agent-index.json');
    expect(updated.startsWith(BASE_KNOWLEDGE_MD.trimEnd())).toBe(true);
  });

  it('is idempotent — calling it twice does not duplicate the block', () => {
    const once = ensureInstalledBundlesBlock(BASE_KNOWLEDGE_MD);
    const twice = ensureInstalledBundlesBlock(once);
    expect(twice).toBe(once);
    expect(twice.split(INSTALLED_BUNDLES_BEGIN_MARKER).length - 1).toBe(1);
  });

  it('rewrites a stale block in place with the current wording', () => {
    const withStaleBlock = `${BASE_KNOWLEDGE_MD}\n${STALE_BLOCK}\n\nTrailing prose.\n`;
    const updated = ensureInstalledBundlesBlock(withStaleBlock);
    expect(updated).not.toContain('Old wording');
    expect(updated).toContain('Library/<id>/agent-index.json');
    expect(updated).toContain('Some prose here.');
    expect(updated).toContain('Trailing prose.');
    expect(updated.split(INSTALLED_BUNDLES_BEGIN_MARKER).length - 1).toBe(1);
  });
});

describe('refreshInstalledBundlesBlock', () => {
  it('rewrites a stale block when bundles are installed', async () => {
    const app = createOkfMockApp({
      'KNOWLEDGE.md': `${BASE_KNOWLEDGE_MD}\n${STALE_BLOCK}\n`,
      '.knowlery/bundles.json': REGISTRY_WITH_BUNDLE,
    });
    await refreshInstalledBundlesBlock(okfVaultFs(app));
    expect(app.writes['KNOWLEDGE.md']).toContain('Library/<id>/agent-index.json');
    expect(app.writes['KNOWLEDGE.md']).not.toContain('Old wording');
  });

  it('removes a leftover block when no bundles are installed, and otherwise leaves the file alone', async () => {
    const leftover = createOkfMockApp({
      'KNOWLEDGE.md': `${BASE_KNOWLEDGE_MD}\n${STALE_BLOCK}\n`,
    });
    await refreshInstalledBundlesBlock(okfVaultFs(leftover));
    expect(leftover.writes['KNOWLEDGE.md']).not.toContain(INSTALLED_BUNDLES_BEGIN_MARKER);
    expect(leftover.writes['KNOWLEDGE.md']).toContain(BASE_KNOWLEDGE_MD.trim());

    const clean = createOkfMockApp({ 'KNOWLEDGE.md': BASE_KNOWLEDGE_MD });
    await refreshInstalledBundlesBlock(okfVaultFs(clean));
    expect(clean.writes['KNOWLEDGE.md']).toBeUndefined();
  });

  it('the block reads as a standalone paragraph, not an orphaned list item "9."', () => {
    const block = ensureInstalledBundlesBlock(BASE_KNOWLEDGE_MD);
    expect(block).toContain('Installed knowledge bundles:');
    expect(block).not.toMatch(/^9\. /m);
  });

  it('does nothing when the block is already current', async () => {
    const app = createOkfMockApp({
      'KNOWLEDGE.md': ensureInstalledBundlesBlock(BASE_KNOWLEDGE_MD),
      '.knowlery/bundles.json': REGISTRY_WITH_BUNDLE,
    });
    await refreshInstalledBundlesBlock(okfVaultFs(app));
    expect(app.writes['KNOWLEDGE.md']).toBeUndefined();
  });
});

describe('removeInstalledBundlesBlock', () => {
  it('removes a previously-inserted block and leaves the rest intact', () => {
    const withBlock = ensureInstalledBundlesBlock(BASE_KNOWLEDGE_MD);
    const removed = removeInstalledBundlesBlock(withBlock);
    expect(removed).not.toContain(INSTALLED_BUNDLES_BEGIN_MARKER);
    expect(removed).toContain('Some prose here.');
  });

  it('is a no-op when there is no block to remove', () => {
    expect(removeInstalledBundlesBlock(BASE_KNOWLEDGE_MD)).toBe(BASE_KNOWLEDGE_MD);
  });
});
