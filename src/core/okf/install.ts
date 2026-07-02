import type { App } from 'obsidian';
import { normalizePath } from 'obsidian';
import { dirname } from 'path';
import type { BundleSourceEntry } from './install-scan';
import { assertSafeInstallPath, previewInstall } from './install-scan';
import { readInstalledBundles, resolveInstallAction, writeInstalledBundles } from './registry';
import { ensureInstalledBundlesBlock } from './knowledge-md-bundles';
import { sha256 } from './hash';

export interface InstallOptions {
  source: string;
  force?: boolean;
  skipConformanceGate?: boolean;
}

export interface InstallResult {
  id: string;
  version: string;
  libraryPath: string;
  conformance: 'passed' | 'failed' | 'skipped';
  conformanceErrorCount: number;
}

export class InstallBlockedError extends Error {
  reason: 'blocked-version' | 'conformance-failed';

  constructor(reason: 'blocked-version' | 'conformance-failed', message: string) {
    super(message);
    this.reason = reason;
  }
}

export async function installBundle(
  app: App,
  entries: BundleSourceEntry[],
  options: InstallOptions,
  now: Date = new Date(),
): Promise<InstallResult> {
  const { manifest, conformance } = previewInstall(entries);

  const registry = await readInstalledBundles(app);
  const existing = registry.bundles[manifest.id];
  const action = resolveInstallAction(existing, manifest.version);
  if (action.kind === 'blocked' && !options.force) {
    throw new InstallBlockedError(
      'blocked-version',
      `${manifest.id} v${action.installedVersion} is already installed (incoming: v${manifest.version}).`,
    );
  }

  let conformanceOutcome: InstallResult['conformance'] = 'passed';
  if (!conformance.conformant) {
    if (!options.skipConformanceGate) {
      throw new InstallBlockedError(
        'conformance-failed',
        `${manifest.id} failed conformance (${conformance.errors.length} error(s)).`,
      );
    }
    conformanceOutcome = 'skipped';
  }

  const libraryDir = `Library/${manifest.id}`;
  if (existing) await removeLibraryDir(app, libraryDir);

  for (const entry of entries) {
    const fullPath = assertSafeInstallPath(libraryDir, entry.path);
    await ensureVaultDir(app, dirname(fullPath));
    await app.vault.adapter.write(normalizePath(fullPath), entry.content);
  }

  const installedContentHash = sha256(
    entries
      .filter((entry) => entry.path.endsWith('.md'))
      .map((entry) => `${entry.path}\n${entry.content}`)
      .sort()
      .join('\n'),
  );

  registry.bundles[manifest.id] = {
    version: manifest.version,
    title: manifest.title,
    source: options.source,
    installedAt: now.toISOString(),
    libraryPath: `${libraryDir}/`,
    manifestContentHash: manifest.contentHash,
    installedContentHash,
    conformance: conformanceOutcome,
    conformanceErrorCount: conformance.errors.length,
  };
  await writeInstalledBundles(app, registry);

  const knowledgeMdFile = app.vault.getFileByPath('KNOWLEDGE.md');
  if (knowledgeMdFile) {
    const current = await app.vault.read(knowledgeMdFile);
    const updated = ensureInstalledBundlesBlock(current);
    if (updated !== current) await app.vault.adapter.write('KNOWLEDGE.md', updated);
  }

  return {
    id: manifest.id,
    version: manifest.version,
    libraryPath: `${libraryDir}/`,
    conformance: conformanceOutcome,
    conformanceErrorCount: conformance.errors.length,
  };
}

async function removeLibraryDir(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  const adapter = app.vault.adapter as typeof app.vault.adapter & {
    rmdir?: (path: string, recursive?: boolean) => Promise<void>;
  };
  if ((await adapter.exists(normalized)) && adapter.rmdir) await adapter.rmdir(normalized, true);
}

// Mirrors compile.ts's private ensureVaultDir (§6) — duplicated rather than
// exported from compile.ts to avoid touching the already-shipped export
// path for this new, independent feature.
async function ensureVaultDir(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!normalized || normalized === '.' || normalized === '/' || (await app.vault.adapter.exists(normalized))) return;
  await ensureVaultDir(app, dirname(normalized));
  await app.vault.adapter.mkdir(normalized);
}
