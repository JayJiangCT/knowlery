import type { Platform } from '../types';
import type { VaultFs } from './vault-fs';
import { normalizeVaultPath } from './vault-fs';
import { generateClaudeMd } from '../assets/templates';
import { collectRuleImportPaths } from './rule-imports';
import { syncAgentsMd } from './agents-md';

/**
 * Every platform gets the same fixed context — the operating card plus rules —
 * delivered in the form it can load: Claude Code through `.claude/CLAUDE.md`
 * `@` imports, Codex and OpenCode through the inlined vault-root `AGENTS.md`.
 * `AGENTS.md` is written regardless of the selected platform so a vault opened
 * in a second agent behaves the same way.
 */
export async function generatePlatformConfig(fs: VaultFs, platform: Platform): Promise<void> {
  if (platform === 'claude-code') {
    await generateClaudeCodeConfig(fs);
  } else {
    await fs.mkdir('.agents/rules');
  }
  await syncAgentsMd(fs, getRulesDir(platform));
}

async function generateClaudeCodeConfig(fs: VaultFs): Promise<void> {
  await fs.mkdir('.claude');
  await fs.mkdir('.claude/rules');
  const ruleImports = await collectRuleImportPaths(fs, '.claude/rules');
  await fs.write('.claude/CLAUDE.md', generateClaudeMd(ruleImports));
}

export function getRulesDir(platform: Platform): string {
  return platform === 'claude-code' ? '.claude/rules' : '.agents/rules';
}

export async function migratePlatform(
  fs: VaultFs,
  from: Platform,
  to: Platform,
  keepOldConfig: boolean,
): Promise<void> {
  const fromRulesDir = getRulesDir(from);
  const toRulesDir = getRulesDir(to);

  await fs.mkdir(normalizeVaultPath(toRulesDir));

  const fromDirPath = normalizeVaultPath(fromRulesDir);
  if (await fs.exists(fromDirPath)) {
    const listing = await fs.list(fromDirPath);
    for (const filePath of listing.files) {
      if (!filePath.endsWith('.md')) continue;
      const filename = filePath.split('/').pop()!;
      const content = await fs.read(normalizeVaultPath(filePath));
      await fs.write(`${toRulesDir}/${filename}`, content);
    }
  }

  await generatePlatformConfig(fs, to);

  if (!keepOldConfig) {
    await cleanupPlatformConfig(fs, from);
  }
}

async function cleanupPlatformConfig(fs: VaultFs, platform: Platform): Promise<void> {
  // AGENTS.md is shared by every platform and is never removed on a switch.
  // opencode.json is no longer generated; removing a leftover one keeps the
  // pre-1.5 cleanup behaviour for vaults that still carry it.
  const path = platform === 'claude-code'
    ? normalizeVaultPath('.claude/CLAUDE.md')
    : normalizeVaultPath('opencode.json');
  if (await fs.exists(path)) await fs.remove(path);
}
