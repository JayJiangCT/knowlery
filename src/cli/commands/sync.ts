import type { VaultFs } from '../../core/vault-fs';
import { loggingVaultFs } from '../../core/vault-fs';
import { isVaultInitialized } from '../../core/setup-executor';
import { runVaultSync } from '../../core/vault-sync';
import { CliError, resolvePlatform } from './shared';

export interface SyncOptions {
  /** The running CLI's version, for the downgrade guard (spec 0.7 f5, §2.5). */
  toolVersion?: string;
  log: (line: string) => void;
}

export async function runSync(fs: VaultFs, options: SyncOptions): Promise<void> {
  if (!(await isVaultInitialized(fs))) {
    throw new CliError('Not a Knowlery workspace (no KNOWLEDGE.md or .knowlery/manifest.json). Run `knowlery init` first.');
  }

  const platform = await resolvePlatform(fs);
  const { fs: logged, writes } = loggingVaultFs(fs);
  const result = await runVaultSync(logged, platform, options.toolVersion);

  if (result.skipped === 'newer-shell') {
    throw new CliError(
      `This workspace was last synced by a newer Knowlery (${result.lastSyncedBy}); syncing with an older tool would downgrade its content. Update first: npm i -g knowlery@latest`,
    );
  }

  if (writes.length === 0) {
    options.log('No changes — the workspace is already up to date.');
    return;
  }
  options.log(`Updated ${writes.length} file(s):`);
  for (const path of writes) {
    options.log(`  ${path}`);
  }
}
