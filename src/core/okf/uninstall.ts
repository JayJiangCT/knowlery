import { readInstalledBundles, writeInstalledBundles } from './registry';
import { removeInstalledBundlesBlock } from './knowledge-md-bundles';
import { assertSafeBundleId } from './install-scan';
import type { VaultFs } from '../vault-fs';
import { normalizeVaultPath } from '../vault-fs';

export async function uninstallBundle(fs: VaultFs, bundleId: string): Promise<void> {
  const registry = await readInstalledBundles(fs);
  const entry = registry.bundles[bundleId];
  if (!entry) return;

  assertSafeBundleId(bundleId);
  const libraryPath = normalizeVaultPath(`Library/${bundleId}`);
  await fs.rmdir(libraryPath, true);

  delete registry.bundles[bundleId];
  await writeInstalledBundles(fs, registry);

  if (Object.keys(registry.bundles).length === 0) {
    if (await fs.exists('KNOWLEDGE.md')) {
      const current = await fs.read('KNOWLEDGE.md');
      const updated = removeInstalledBundlesBlock(current);
      if (updated !== current) await fs.write('KNOWLEDGE.md', updated);
    }
  }
}
