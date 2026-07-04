import type { ConfigIntegrity, Platform } from '../types';
import { BUILTIN_SKILL_NAMES, KNOWLEDGE_DIRS } from '../types';
import { getRulesDir } from './platform-adapter';
import { QUERY_SCRIPT_PATH } from './query-script';
import type { VaultFs } from './vault-fs';
import { normalizeVaultPath } from './vault-fs';

export type VaultConfigFiles = Omit<ConfigIntegrity, 'obsidianCli' | 'claudeCodeCli' | 'opencodeCli'>;

/**
 * Platform-neutral config-file checks (spec 0.7 f1, §4.2) — the part of config
 * integrity a headless shell can compute. Lives in its own module so the CLI bundle
 * never drags in the Obsidian-shell half (vault-health.ts composes this with electron
 * CLI detection for the plugin).
 */
export async function checkVaultConfigFiles(
  fs: VaultFs,
  platform: Platform,
): Promise<VaultConfigFiles> {
  const existingDirs: string[] = [];
  const missingDirs: string[] = [];
  for (const d of KNOWLEDGE_DIRS) {
    if (await fs.exists(normalizeVaultPath(d))) {
      existingDirs.push(d);
    } else {
      missingDirs.push(d);
    }
  }

  const rulesDir = getRulesDir(platform);
  const rulesDirPath = normalizeVaultPath(rulesDir);
  let rulesConfigured = false;
  if (await fs.exists(rulesDirPath)) {
    const listing = await fs.list(rulesDirPath);
    rulesConfigured = listing.files.length > 0;
  }

  const presentSkills: string[] = [];
  const missingSkills: string[] = [];
  for (const name of BUILTIN_SKILL_NAMES) {
    const path = normalizeVaultPath(`.agents/skills/${name}/SKILL.md`);
    if (await fs.exists(path)) {
      presentSkills.push(name);
    } else {
      missingSkills.push(name);
    }
  }

  const agentConfigPath = platform === 'claude-code'
    ? normalizeVaultPath('.claude/CLAUDE.md')
    : normalizeVaultPath('opencode.json');
  const agentConfigExists = await fs.exists(agentConfigPath);

  return {
    knowledgeMdExists: await fs.exists('KNOWLEDGE.md'),
    schemaMdExists: await fs.exists('SCHEMA.md'),
    indexBaseExists: await fs.exists('INDEX.base'),
    queryScriptExists: await fs.exists(normalizeVaultPath(QUERY_SCRIPT_PATH)),
    knowledgeDirsComplete: {
      exists: existingDirs,
      missing: missingDirs,
    },
    agentConfigExists,
    rulesConfigured,
    skillsComplete: { present: presentSkills, missing: missingSkills },
    platform,
  };
}
