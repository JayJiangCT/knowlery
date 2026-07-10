import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scanVault } from './query/scan';
import { readInstalledBundles } from './okf/registry';
import { nodeVaultFs } from '../platform/node-fs';
import { BundleManifestSchema } from '../types';
import {
  buildOrientationMap,
  type OrientationBundleEntry,
  type OrientationMap,
} from './query/orientation';

/**
 * Assembles the injected inputs for the pure orientation core (spec 1.2 f1,
 * §4.1) — the one I/O layer both shells share, so CLI and MCP render from
 * the same data by construction.
 */
export async function collectOrientationMap(root: string, generatedAt: string): Promise<OrientationMap> {
  const snapshot = scanVault(root);
  const fs = nodeVaultFs(root);

  const registry = await readInstalledBundles(fs);
  const bundles: OrientationBundleEntry[] = [];
  for (const [id, entry] of Object.entries(registry.bundles)) {
    // Tolerant manifest join (spec §4.1): a missing/unreadable bundle
    // manifest falls back to the conventional entrypoint — an entry never
    // blocks the map.
    let entrypoint = 'index.md';
    try {
      const manifest = BundleManifestSchema.parse(
        JSON.parse(await readFile(join(root, entry.libraryPath, 'knowlery-bundle.json'), 'utf8')),
      );
      entrypoint = manifest.entrypoint;
    } catch {
      // fall through with the default
    }
    bundles.push({ id, title: entry.title, version: entry.version, entrypoint });
  }

  let kbName: string | undefined;
  try {
    kbName = (await readFile(join(root, 'KNOWLEDGE.md'), 'utf8'))
      .split('\n').find((line) => line.startsWith('# '))?.slice(2).trim() || undefined;
  } catch {
    // no KNOWLEDGE.md — the map renders without a name
  }

  return buildOrientationMap({ snapshot, bundles, ...(kbName !== undefined ? { kbName } : {}), generatedAt });
}
