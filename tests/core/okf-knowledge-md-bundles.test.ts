import { describe, expect, it } from 'vitest';
import {
  ensureInstalledBundlesBlock,
  removeInstalledBundlesBlock,
  INSTALLED_BUNDLES_BEGIN_MARKER,
  INSTALLED_BUNDLES_END_MARKER,
} from '../../src/core/okf/knowledge-md-bundles';

const BASE_KNOWLEDGE_MD = '# My Vault\n\nSome prose here.\n';

describe('ensureInstalledBundlesBlock', () => {
  it('appends the marker block when absent', () => {
    const updated = ensureInstalledBundlesBlock(BASE_KNOWLEDGE_MD);
    expect(updated).toContain(INSTALLED_BUNDLES_BEGIN_MARKER);
    expect(updated).toContain(INSTALLED_BUNDLES_END_MARKER);
    expect(updated).toContain('.knowlery/bundles.json');
    expect(updated.startsWith(BASE_KNOWLEDGE_MD.trimEnd())).toBe(true);
  });

  it('is idempotent — calling it twice does not duplicate the block', () => {
    const once = ensureInstalledBundlesBlock(BASE_KNOWLEDGE_MD);
    const twice = ensureInstalledBundlesBlock(once);
    expect(twice).toBe(once);
    expect(twice.split(INSTALLED_BUNDLES_BEGIN_MARKER).length - 1).toBe(1);
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
