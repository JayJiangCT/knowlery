import type { Platform, RuleInfo } from '../types';
import type { VaultFs } from './vault-fs';
import { normalizeVaultPath } from './vault-fs';
import { RULE_TEMPLATES, type RuleTemplate } from '../assets/rules';
import { getRulesDir } from './platform-adapter';
import { syncClaudeRuleImports as syncClaudeRuleImportBlock } from './rule-imports';

export function getRuleTemplates(): RuleTemplate[] {
  return RULE_TEMPLATES;
}

export async function listRules(fs: VaultFs, platform: Platform): Promise<RuleInfo[]> {
  const rulesDir = getRulesDir(platform);
  const dirPath = normalizeVaultPath(rulesDir);
  if (!(await fs.exists(dirPath))) return [];

  const listing = await fs.list(dirPath);
  const rules: RuleInfo[] = [];
  for (const filePath of listing.files) {
    if (!filePath.endsWith('.md')) continue;
    const filename = filePath.split('/').pop()!;
    const content = await fs.read(normalizeVaultPath(filePath));
    rules.push({
      name: filename.replace(/\.md$/, ''),
      filename,
      content,
    });
  }

  return rules;
}

export async function readRule(
  fs: VaultFs,
  platform: Platform,
  filename: string,
): Promise<string | null> {
  const rulesDir = getRulesDir(platform);
  const path = normalizeVaultPath(`${rulesDir}/${filename}`);
  if (!(await fs.exists(path))) return null;
  return fs.read(path);
}

export async function writeRule(
  fs: VaultFs,
  platform: Platform,
  filename: string,
  content: string,
): Promise<void> {
  const rulesDir = getRulesDir(platform);
  await fs.mkdir(rulesDir);
  await fs.write(`${rulesDir}/${filename}`, content);
  await syncClaudeRuleImports(fs, platform);
}

export async function deleteRule(
  fs: VaultFs,
  platform: Platform,
  filename: string,
): Promise<void> {
  const rulesDir = getRulesDir(platform);
  const path = normalizeVaultPath(`${rulesDir}/${filename}`);
  if (await fs.exists(path)) {
    await fs.remove(path);
  }
  await syncClaudeRuleImports(fs, platform);
}

export async function installDefaultRules(
  fs: VaultFs,
  platform: Platform,
): Promise<void> {
  for (const template of RULE_TEMPLATES) {
    await writeRule(fs, platform, template.filename, template.content);
  }
}

export async function installActivityLedgerRule(
  fs: VaultFs,
  platform: Platform,
): Promise<void> {
  const template = RULE_TEMPLATES.find((rule) => rule.filename === 'activity-ledger.md');
  if (!template) return;
  await writeRule(fs, platform, template.filename, template.content);
}

async function syncClaudeRuleImports(fs: VaultFs, platform: Platform): Promise<void> {
  if (platform !== 'claude-code') return;
  await syncClaudeRuleImportBlock(fs);
}
