import { dirname } from 'path';
import type { BundleSourceEntry } from './install-scan';
import { assertSafeInstallPath, previewInstall } from './install-scan';
import { readInstalledBundles, resolveInstallAction, writeInstalledBundles } from './registry';
import { ensureInstalledBundlesBlock } from './knowledge-md-bundles';
import { sha256 } from './hash';
import type { VaultFs } from '../vault-fs';
import { normalizeVaultPath } from '../vault-fs';

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
  fs: VaultFs,
  entries: BundleSourceEntry[],
  options: InstallOptions,
  now: Date = new Date(),
): Promise<InstallResult> {
  const { manifest, conformance } = previewInstall(entries);

  const registry = await readInstalledBundles(fs);
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
  const safeWrites = entries.map((entry) => ({
    fullPath: assertSafeInstallPath(libraryDir, entry.path),
    content: entry.content,
  }));

  if (existing) await fs.rmdir(normalizeVaultPath(libraryDir), true);

  for (const { fullPath, content } of safeWrites) {
    await ensureVaultDir(fs, dirname(fullPath));
    await fs.write(normalizeVaultPath(fullPath), content);
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
  await writeInstalledBundles(fs, registry);

  if (await fs.exists('KNOWLEDGE.md')) {
    const current = await fs.read('KNOWLEDGE.md');
    const updated = ensureInstalledBundlesBlock(current);
    if (updated !== current) await fs.write('KNOWLEDGE.md', updated);
  }

  return {
    id: manifest.id,
    version: manifest.version,
    libraryPath: `${libraryDir}/`,
    conformance: conformanceOutcome,
    conformanceErrorCount: conformance.errors.length,
  };
}

// Mirrors compile.ts's private ensureVaultDir (§6) — duplicated rather than
// exported from compile.ts to avoid touching the already-shipped export
// path for this new, independent feature.
async function ensureVaultDir(fs: VaultFs, path: string): Promise<void> {
  const normalized = normalizeVaultPath(path);
  if (!normalized || normalized === '.' || normalized === '/' || (await fs.exists(normalized))) return;
  await ensureVaultDir(fs, dirname(normalized));
  await fs.mkdir(normalized);
}
