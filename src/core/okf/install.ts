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
  // Path safety is asserted against the final destination; the staging dir is a
  // sibling under Library/ so the same containment argument covers it.
  const safeWrites = entries.map((entry) => ({
    relativePath: assertSafeInstallPath(libraryDir, entry.path).slice(`${libraryDir}/`.length),
    content: entry.content,
  }));

  // Staged replacement (spec 0.9 f3, §4.3.5): the previous rmdir-then-write
  // sequence lost the installed copy when a mid-write failure hit — a latent
  // defect that updates would have made a high-frequency path. All gates have
  // passed by this point; now: write to a staging sibling, swap via a backup,
  // drop the backup. A failure before the swap leaves the live copy untouched;
  // a failure mid-swap leaves the named backup for manual restore.
  const stagingDir = `Library/.staging-${manifest.id}`;
  const backupDir = `Library/.old-${manifest.id}`;
  await fs.rmdir(normalizeVaultPath(stagingDir), true).catch(() => { /* no stale staging */ });

  try {
    for (const { relativePath, content } of safeWrites) {
      const stagedPath = `${stagingDir}/${relativePath}`;
      await ensureVaultDir(fs, dirname(stagedPath));
      await fs.write(normalizeVaultPath(stagedPath), content);
    }
  } catch (error) {
    await fs.rmdir(normalizeVaultPath(stagingDir), true).catch(() => { /* best-effort cleanup */ });
    throw error;
  }

  if (existing || await fs.exists(normalizeVaultPath(libraryDir))) {
    await fs.rmdir(normalizeVaultPath(backupDir), true).catch(() => { /* no stale backup */ });
    await fs.rename(normalizeVaultPath(libraryDir), normalizeVaultPath(backupDir));
    try {
      await fs.rename(normalizeVaultPath(stagingDir), normalizeVaultPath(libraryDir));
    } catch (error) {
      throw new Error(
        `Install failed mid-swap: the previous version was preserved at ${backupDir}/ — rename it back to ${libraryDir}/ to restore. (${error instanceof Error ? error.message : String(error)})`,
      );
    }
    await fs.rmdir(normalizeVaultPath(backupDir), true).catch(() => { /* best-effort cleanup */ });
  } else {
    await ensureVaultDir(fs, 'Library');
    await fs.rename(normalizeVaultPath(stagingDir), normalizeVaultPath(libraryDir));
  }

  const mdEntries = entries.filter((entry) => entry.path.endsWith('.md'));
  const installedContentHash = sha256(
    mdEntries
      .map((entry) => `${entry.path}\n${entry.content}`)
      .sort()
      .join('\n'),
  );
  const fileHashes = Object.fromEntries(
    mdEntries.map((entry) => [entry.path, sha256(entry.content)]),
  );

  registry.bundles[manifest.id] = {
    version: manifest.version,
    title: manifest.title,
    source: options.source,
    installedAt: now.toISOString(),
    libraryPath: `${libraryDir}/`,
    manifestContentHash: manifest.contentHash,
    installedContentHash,
    fileHashes,
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
