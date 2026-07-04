import type { Platform } from '../types';
import type { VaultFs } from './vault-fs';
import { normalizeVaultPath } from './vault-fs';
import { generateClaudeMd, generateOpenCodeJson } from '../assets/templates';
import { collectRuleImportPaths } from './rule-imports';

export async function generatePlatformConfig(
  fs: VaultFs,
  platform: Platform,
  kbName: string,
): Promise<void> {
  if (platform === 'claude-code') {
    await generateClaudeCodeConfig(fs);
  } else {
    await generateOpenCodeConfig(fs, kbName);
  }
}

async function generateClaudeCodeConfig(fs: VaultFs): Promise<void> {
  await fs.mkdir('.claude');
  await fs.mkdir('.claude/rules');
  const ruleImports = await collectRuleImportPaths(fs, '.claude/rules');
  await fs.write('.claude/CLAUDE.md', generateClaudeMd(ruleImports));
}

async function generateOpenCodeConfig(fs: VaultFs, kbName: string): Promise<void> {
  await fs.mkdir('.agents/rules');
  await fs.write('opencode.json', generateOpenCodeJson(kbName));
}

export function getRulesDir(platform: Platform): string {
  return platform === 'claude-code' ? '.claude/rules' : '.agents/rules';
}

export async function migratePlatform(
  fs: VaultFs,
  from: Platform,
  to: Platform,
  kbName: string,
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

  await generatePlatformConfig(fs, to, kbName);

  if (!keepOldConfig) {
    await cleanupPlatformConfig(fs, from);
  }
}

async function cleanupPlatformConfig(fs: VaultFs, platform: Platform): Promise<void> {
  if (platform === 'claude-code') {
    const path = normalizeVaultPath('.claude/CLAUDE.md');
    if (await fs.exists(path)) await fs.remove(path);
  } else {
    const path = normalizeVaultPath('opencode.json');
    if (await fs.exists(path)) await fs.remove(path);
  }
}
