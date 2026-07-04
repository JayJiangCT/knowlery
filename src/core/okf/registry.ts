import type { InstalledBundleEntry, InstalledBundlesFile } from '../../types';
import { InstalledBundlesFileSchema } from '../../types';
import type { VaultFs } from '../vault-fs';
import { normalizeVaultPath } from '../vault-fs';

export const BUNDLES_REGISTRY_PATH = '.knowlery/bundles.json';

export async function readInstalledBundles(fs: VaultFs): Promise<InstalledBundlesFile> {
  const path = normalizeVaultPath(BUNDLES_REGISTRY_PATH);
  if (!(await fs.exists(path))) return { schemaVersion: 1, bundles: {} };
  try {
    return InstalledBundlesFileSchema.parse(JSON.parse(await fs.read(path)));
  } catch {
    return { schemaVersion: 1, bundles: {} };
  }
}

export async function writeInstalledBundles(fs: VaultFs, file: InstalledBundlesFile): Promise<void> {
  if (!(await fs.exists('.knowlery'))) await fs.mkdir('.knowlery');
  await fs.write(normalizeVaultPath(BUNDLES_REGISTRY_PATH), `${JSON.stringify(file, null, 2)}\n`);
}

export type InstallAction =
  | { kind: 'install' }
  | { kind: 'update'; fromVersion: string }
  | { kind: 'blocked'; installedVersion: string };

export function resolveInstallAction(
  existing: InstalledBundleEntry | undefined,
  incomingVersion: string,
): InstallAction {
  if (!existing) return { kind: 'install' };
  if (compareVersions(incomingVersion, existing.version) > 0) {
    return { kind: 'update', fromVersion: existing.version };
  }
  return { kind: 'blocked', installedVersion: existing.version };
}

function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map((part) => parseInt(part, 10) || 0);
  const partsB = b.split('.').map((part) => parseInt(part, 10) || 0);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
