import type { VaultFs } from '../vault-fs';
import type { InstalledBundleEntry } from '../../types';
import { compareVersions, readInstalledBundles } from './registry';
import { sha256 } from './hash';
import { upstreamFor, type UpstreamDeps } from './upstream';

/**
 * Update-status collection and the local-modification check (spec 0.9 f3) —
 * core, shared verbatim by the CLI commands and the plugin dashboard.
 */

export type UpdateStatus =
  | { id: string; installed: string; kind: 'available'; latest: string; url: string }
  | { id: string; installed: string; kind: 'current' }
  | { id: string; installed: string; kind: 'unchecked'; reason: string }
  | { id: string; installed: string; kind: 'skipped'; reason: string }
  | { id: string; installed: string; kind: 'unreachable'; reason: string };

export async function collectUpdateStatuses(fs: VaultFs, deps: UpstreamDeps): Promise<UpdateStatus[]> {
  const registry = await readInstalledBundles(fs);
  const statuses: UpdateStatus[] = [];
  for (const [id, entry] of Object.entries(registry.bundles)) {
    statuses.push(await updateStatusFor(id, entry, deps));
  }
  return statuses;
}

export async function updateStatusFor(id: string, entry: InstalledBundleEntry, deps: UpstreamDeps): Promise<UpdateStatus> {
  const upstream = upstreamFor(id, entry.source, deps);
  if (!upstream) {
    return { id, installed: entry.version, kind: 'unchecked', reason: 'no version protocol for this source' };
  }
  const answer = await upstream.latest();
  if (answer.kind === 'needs-auth') {
    return { id, installed: entry.version, kind: 'skipped', reason: 'private source — gh needed' };
  }
  if (answer.kind === 'unreachable') {
    return { id, installed: entry.version, kind: 'unreachable', reason: answer.detail };
  }
  if (compareVersions(answer.version, entry.version) > 0) {
    return { id, installed: entry.version, kind: 'available', latest: answer.version, url: answer.url };
  }
  return { id, installed: entry.version, kind: 'current' };
}

/**
 * Local-modification check (spec §4.3.3): recompute hashes over the live Library
 * copy. With per-file hashes (0.9+ installs) the changed files are named exactly
 * — edited, added, and deleted all count; older entries fall back to the
 * aggregate hash with a bundle-level message.
 */
export async function modifiedFiles(fs: VaultFs, entry: InstalledBundleEntry): Promise<string[]> {
  const root = entry.libraryPath.replace(/\/$/, '');
  const files: Array<{ path: string; content: string }> = [];
  async function walk(dir: string): Promise<void> {
    const listing = await fs.list(dir).catch(() => ({ files: [], folders: [] }));
    for (const file of listing.files) {
      if (!file.endsWith('.md')) continue;
      files.push({ path: file.slice(root.length + 1), content: await fs.read(file) });
    }
    for (const folder of listing.folders) await walk(folder);
  }
  await walk(root);

  if (entry.fileHashes) {
    const changed: string[] = [];
    const seen = new Set<string>();
    for (const file of files) {
      seen.add(file.path);
      const recorded = entry.fileHashes[file.path];
      if (recorded === undefined) changed.push(`${root}/${file.path} (added)`);
      else if (recorded !== sha256(file.content)) changed.push(`${root}/${file.path} (edited)`);
    }
    for (const path of Object.keys(entry.fileHashes)) {
      if (!seen.has(path)) changed.push(`${root}/${path} (deleted)`);
    }
    return changed.sort();
  }

  const liveHash = sha256(files.map((file) => `${file.path}\n${file.content}`).sort().join('\n'));
  if (liveHash === entry.installedContentHash) return [];
  return [`${root}/ (content differs from install — per-file detail unavailable for pre-0.9 installs)`];
}
