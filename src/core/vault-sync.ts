import type { Platform } from '../types';
import type { VaultFs } from './vault-fs';
import { normalizeVaultPath } from './vault-fs';
import { readManifest } from './setup-executor';
import { syncBuiltinSkills, migrateSchemaMd, migrateFixedContextImports } from './migration';
import { syncQueryScript } from './query-script';
import { refreshInstalledBundlesBlock } from './okf/knowledge-md-bundles';
import { syncClaudeRuleImports } from './rule-imports';

const MANIFEST_PATH = '.knowlery/manifest.json';

export type VaultSyncResult =
  | { skipped: false }
  /** The vault was last synced by a newer core; an older tool must not downgrade it. */
  | { skipped: 'newer-shell'; lastSyncedBy: string };

/**
 * The one vault-sync list, shared by both shells (spec 0.7 f2, §4.2 / R1): the
 * Obsidian plugin runs this on version change, `knowlery sync` runs it on demand.
 * Every step is idempotent and write-on-change, so running it repeatedly is a no-op.
 *
 * Downgrade guard (spec 0.7 f5, §2.5): the manifest records which core version last
 * synced the vault; a tool older than that refuses to run, so an out-of-date shell
 * can never downgrade skill content a newer one already upgraded. Dev builds (no
 * parseable version) bypass the guard and record nothing.
 */
export async function runVaultSync(
  fs: VaultFs,
  platform: Platform,
  toolVersion?: string,
): Promise<VaultSyncResult> {
  const manifest = await readManifest(fs);
  const guardActive = toolVersion !== undefined && parsesAsVersion(toolVersion);

  if (guardActive && manifest?.lastSyncedBy && parsesAsVersion(manifest.lastSyncedBy)) {
    if (compareVersions(toolVersion, manifest.lastSyncedBy) < 0) {
      return { skipped: 'newer-shell', lastSyncedBy: manifest.lastSyncedBy };
    }
  }

  await syncBuiltinSkills(fs);
  await syncQueryScript(fs);
  await migrateSchemaMd(fs);
  await migrateFixedContextImports(fs);
  await refreshInstalledBundlesBlock(fs);
  if (platform === 'claude-code') {
    await syncClaudeRuleImports(fs);
  }

  if (guardActive && manifest && manifest.lastSyncedBy !== toolVersion) {
    manifest.lastSyncedBy = toolVersion;
    manifest.updatedAt = new Date().toISOString();
    await fs.write(normalizeVaultPath(MANIFEST_PATH), JSON.stringify(manifest, null, 2));
  }

  return { skipped: false };
}

/** Numeric-segment comparison; prerelease suffixes ignored (spec 0.7 f5, §2.5). */
export function compareVersions(a: string, b: string): number {
  const partsA = releaseSegments(a);
  const partsB = releaseSegments(b);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function releaseSegments(version: string): number[] {
  return version.split('-')[0].split('.').map((part) => parseInt(part, 10) || 0);
}

function parsesAsVersion(version: string): boolean {
  return /^\d+\.\d+/.test(version);
}
