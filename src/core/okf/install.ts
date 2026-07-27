import { dirname } from 'path';
import type { BundleManifest, RiskHint } from '../../types';
import type { BundleSourceEntry } from './install-scan';
import { assertSafeInstallPath, previewInstall } from './install-scan';
import { scanInstructionLike } from './risk-scan';
import { readInstalledBundles, resolveInstallAction, writeInstalledBundles } from './registry';
import { ensureInstalledBundlesBlock } from './knowledge-md-bundles';
import { sha256, sha256Bytes } from './hash';
import type { PortabilityIssue } from './portability';
import type { VaultFs } from '../vault-fs';
import { normalizeVaultPath } from '../vault-fs';

export interface InstallOptions {
  source: string;
  force?: boolean;
  skipConformanceGate?: boolean;
  /**
   * Consent to instruction-like risk hints (spec 1.3 f3, §4.2). Deliberately
   * independent from skipConformanceGate: conformance failures are structural
   * defects, risk hints are content warnings — one flag must not consent to
   * both.
   */
  acknowledgeRisks?: boolean;
  /**
   * Platform for the Windows path hard-gate. Defaults to process.platform;
   * tests override. Detection itself is platform-independent (previewInstall)
   * — this is where policy is applied.
   */
  platform?: string;
}

export interface InstallResult {
  id: string;
  version: string;
  libraryPath: string;
  conformance: 'passed' | 'failed' | 'skipped';
  conformanceErrorCount: number;
  /** Instruction-like hints found in the incoming bundle (empty when clean). */
  riskHints: RiskHint[];
  /** Windows-incompatible paths (empty when portable). Non-blocking off Windows. */
  portabilityIssues: PortabilityIssue[];
}

export class InstallBlockedError extends Error {
  reason: 'blocked-version' | 'conformance-failed' | 'risk-hints' | 'incompatible-paths' | 'attachment-integrity';
  /** Populated for reason 'risk-hints' — the shell prints these verbatim. */
  riskHints: RiskHint[];
  /** Populated for reason 'incompatible-paths' — deliberately separate from riskHints. */
  pathIssues: PortabilityIssue[];

  constructor(
    reason: InstallBlockedError['reason'],
    message: string,
    riskHints: RiskHint[] = [],
    pathIssues: PortabilityIssue[] = [],
  ) {
    super(message);
    this.reason = reason;
    this.riskHints = riskHints;
    this.pathIssues = pathIssues;
  }
}

/**
 * The consumer-side trust boundary (spec 1.3 f3, §4.2): scan incoming pages
 * for instruction-like content before anything is written. Exported so the
 * Obsidian install modal can surface the same hints at preview time.
 */
export function scanIncomingBundleRisks(entries: BundleSourceEntry[]): RiskHint[] {
  const hints: RiskHint[] = [];
  for (const entry of entries) {
    if (!entry.path.endsWith('.md') || entry.content === undefined) continue;
    for (const evidence of scanInstructionLike(entry.content)) {
      hints.push({ itemId: entry.path, kind: 'instruction-like', evidence });
    }
  }
  return hints;
}

/**
 * The attachment integrity gate (spec 1.3.1 f1, §4.4): before any write,
 * every byte entry must match a manifest record on path, size, and sha256
 * — and both ways: every record needs its entry, and no unlisted binary
 * rides in the archive (nothing the reviewer never saw). Not skippable:
 * `--skip-conformance` and `--acknowledge-risks` consent to known defects
 * and reviewed content; a hash mismatch is tampering or corruption, and
 * there is no informed consent to that.
 */
export function verifyAttachmentIntegrity(manifest: BundleManifest, entries: BundleSourceEntry[]): string[] {
  const problems: string[] = [];
  const byteEntries = entries.filter(
    (entry): entry is BundleSourceEntry & { bytes: Uint8Array } => entry.bytes !== undefined,
  );
  const records = new Map(
    (manifest.schemaVersion === 2 ? manifest.attachments : []).map((record) => [record.path, record]),
  );

  for (const entry of byteEntries) {
    const record = records.get(entry.path);
    if (!record) {
      problems.push(`${entry.path}: binary entry not listed in the manifest (unlisted content cannot be installed)`);
      continue;
    }
    if (entry.bytes.byteLength !== record.bytes) {
      problems.push(`${entry.path}: size mismatch (${entry.bytes.byteLength} bytes vs ${record.bytes} in the manifest)`);
    } else if (sha256Bytes(entry.bytes) !== record.sha256) {
      problems.push(`${entry.path}: sha256 mismatch against the manifest (tampered or corrupted)`);
    }
  }

  const present = new Set(byteEntries.map((entry) => entry.path));
  for (const record of records.values()) {
    if (!present.has(record.path)) {
      problems.push(`${record.path}: listed in the manifest but missing from the bundle`);
    }
  }
  return problems;
}

export async function installBundle(
  fs: VaultFs,
  entries: BundleSourceEntry[],
  options: InstallOptions,
  now: Date = new Date(),
): Promise<InstallResult> {
  const { manifest, conformance, portabilityIssues } = previewInstall(entries);

  // Windows path hard-gate (field finding: `|` in a source file name gave a
  // raw ENOENT mid-staging). Not acknowledgeable — the writes below would
  // definitely fail — and enforced here, not only in shell previews, so no
  // entry point (modal, CLI, dashboard update) can bypass it.
  const platform = options.platform ?? process.platform;
  if (portabilityIssues.length > 0 && platform === 'win32') {
    const sample = portabilityIssues.slice(0, 3).map((issue) => issue.path).join(', ');
    throw new InstallBlockedError(
      'incompatible-paths',
      `${manifest.id} contains ${portabilityIssues.length} path(s) Windows cannot create (e.g. ${sample}). `
      + 'Ask the bundle creator to re-export with a current Knowlery — nothing was written.',
      [],
      portabilityIssues,
    );
  }

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

  // Consumer-side content gate (spec 1.3 f3, §4.2): before any write, and
  // independent of the conformance gate above — skipConformanceGate alone
  // does not consent to hostile-looking content.
  const riskHints = scanIncomingBundleRisks(entries);
  if (riskHints.length > 0 && !options.acknowledgeRisks) {
    throw new InstallBlockedError(
      'risk-hints',
      `${manifest.id} contains instruction-like content on ${riskHints.length} line(s) — text that reads as directives to an agent, a known indirect-prompt-injection shape.`,
      riskHints,
    );
  }

  // The attachment integrity gate (spec 1.3.1 f1, §4.4) — pre-write and
  // never skippable, unlike the two consent gates above.
  const integrityProblems = verifyAttachmentIntegrity(manifest, entries);
  if (integrityProblems.length > 0) {
    throw new InstallBlockedError(
      'attachment-integrity',
      `${manifest.id} failed attachment integrity — nothing was written:\n${integrityProblems.map((problem) => `  - ${problem}`).join('\n')}`,
    );
  }

  const libraryDir = `Library/${manifest.id}`;
  // Path safety is asserted against the final destination; the staging dir is a
  // sibling under Library/ so the same containment argument covers it.
  const safeWrites = entries.map((entry) => ({
    relativePath: assertSafeInstallPath(libraryDir, entry.path).slice(`${libraryDir}/`.length),
    entry,
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
    for (const { relativePath, entry } of safeWrites) {
      const stagedPath = `${stagingDir}/${relativePath}`;
      await ensureVaultDir(fs, dirname(stagedPath));
      if (entry.bytes !== undefined) {
        await fs.writeBinary(normalizeVaultPath(stagedPath), toArrayBuffer(entry.bytes));
      } else {
        await fs.write(normalizeVaultPath(stagedPath), entry.content);
      }
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

  const mdEntries = entries.filter(
    (entry): entry is BundleSourceEntry & { content: string } => entry.path.endsWith('.md') && entry.content !== undefined,
  );
  const installedContentHash = sha256(
    mdEntries
      .map((entry) => `${entry.path}\n${entry.content}`)
      .sort()
      .join('\n'),
  );
  // Attachment hashes join fileHashes (same record shape, more keys), so
  // bundle update's local-modification protection covers an annotated
  // diagram exactly like an edited page (spec 1.3.1 f1, §4.4).
  const fileHashes = Object.fromEntries([
    ...mdEntries.map((entry) => [entry.path, sha256(entry.content)] as const),
    ...entries
      .filter((entry): entry is BundleSourceEntry & { bytes: Uint8Array } => entry.bytes !== undefined)
      .map((entry) => [entry.path, sha256Bytes(entry.bytes)] as const),
  ]);

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
    riskHints,
    portabilityIssues,
  };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
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
