import type { App } from 'obsidian';
import { normalizePath } from 'obsidian';
import { readInstalledBundles, writeInstalledBundles } from './registry';
import { removeInstalledBundlesBlock } from './knowledge-md-bundles';
import { assertSafeBundleId } from './install-scan';

export async function uninstallBundle(app: App, bundleId: string): Promise<void> {
  const registry = await readInstalledBundles(app);
  const entry = registry.bundles[bundleId];
  if (!entry) return;

  assertSafeBundleId(bundleId);
  const libraryPath = normalizePath(`Library/${bundleId}`);
  const adapter = app.vault.adapter as typeof app.vault.adapter & {
    rmdir?: (path: string, recursive?: boolean) => Promise<void>;
  };
  if ((await adapter.exists(libraryPath)) && adapter.rmdir) await adapter.rmdir(libraryPath, true);

  delete registry.bundles[bundleId];
  await writeInstalledBundles(app, registry);

  if (Object.keys(registry.bundles).length === 0) {
    const knowledgeMdFile = app.vault.getFileByPath('KNOWLEDGE.md');
    if (knowledgeMdFile) {
      const current = await app.vault.read(knowledgeMdFile);
      const updated = removeInstalledBundlesBlock(current);
      if (updated !== current) await app.vault.adapter.write('KNOWLEDGE.md', updated);
    }
  }
}
