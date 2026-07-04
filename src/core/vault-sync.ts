import type { Platform } from '../types';
import type { VaultFs } from './vault-fs';
import { syncBuiltinSkills, migrateSchemaMd, migrateFixedContextImports } from './migration';
import { syncQueryScript } from './query-script';
import { refreshInstalledBundlesBlock } from './okf/knowledge-md-bundles';
import { syncClaudeRuleImports } from './rule-imports';

/**
 * The one vault-sync list, shared by both shells (spec 0.7 f2, §4.2 / R1): the
 * Obsidian plugin runs this on version change, `knowlery sync` runs it on demand.
 * Every step is idempotent and write-on-change, so running it repeatedly is a no-op.
 */
export async function runVaultSync(fs: VaultFs, platform: Platform): Promise<void> {
  await syncBuiltinSkills(fs);
  await syncQueryScript(fs);
  await migrateSchemaMd(fs);
  await migrateFixedContextImports(fs);
  await refreshInstalledBundlesBlock(fs);
  if (platform === 'claude-code') {
    await syncClaudeRuleImports(fs);
  }
}
