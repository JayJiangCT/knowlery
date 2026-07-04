import type { VaultFs } from '../../core/vault-fs';
import { loggingVaultFs } from '../../core/vault-fs';
import { isVaultInitialized } from '../../core/setup-executor';
import { runVaultSync } from '../../core/vault-sync';
import { CliError, resolvePlatform } from './shared';

export interface SyncOptions {
  log: (line: string) => void;
}

export async function runSync(fs: VaultFs, options: SyncOptions): Promise<void> {
  if (!(await isVaultInitialized(fs))) {
    throw new CliError('Not a Knowlery workspace (no KNOWLEDGE.md or .knowlery/manifest.json). Run `knowlery init` first.');
  }

  const platform = await resolvePlatform(fs);
  const { fs: logged, writes } = loggingVaultFs(fs);
  await runVaultSync(logged, platform);

  if (writes.length === 0) {
    options.log('No changes — the workspace is already up to date.');
    return;
  }
  options.log(`Updated ${writes.length} file(s):`);
  for (const path of writes) {
    options.log(`  ${path}`);
  }
}
