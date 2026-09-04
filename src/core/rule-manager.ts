import type { RuleInfo } from '../types';
import type { VaultFs } from './vault-fs';
import { normalizeVaultPath } from './vault-fs';
import { RULE_TEMPLATES, type RuleTemplate } from '../assets/rules';
import { RULES_DIR } from './agents-md';
import { syncAgentConfig } from './platform-adapter';

export function getRuleTemplates(): RuleTemplate[] {
  return RULE_TEMPLATES;
}

export async function listRules(fs: VaultFs): Promise<RuleInfo[]> {
  const dirPath = normalizeVaultPath(RULES_DIR);
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

export async function readRule(fs: VaultFs, filename: string): Promise<string | null> {
  const path = normalizeVaultPath(`${RULES_DIR}/${filename}`);
  if (!(await fs.exists(path))) return null;
  return fs.read(path);
}

export async function writeRule(fs: VaultFs, filename: string, content: string): Promise<void> {
  await fs.mkdir(RULES_DIR);
  await fs.write(`${RULES_DIR}/${filename}`, content);
  await syncAgentConfig(fs);
}

export async function deleteRule(fs: VaultFs, filename: string): Promise<void> {
  const path = normalizeVaultPath(`${RULES_DIR}/${filename}`);
  if (await fs.exists(path)) {
    await fs.remove(path);
  }
  await syncAgentConfig(fs);
}

export async function installDefaultRules(fs: VaultFs): Promise<void> {
  for (const template of RULE_TEMPLATES) {
    await writeRule(fs, template.filename, template.content);
  }
}

export async function installActivityLedgerRule(fs: VaultFs): Promise<void> {
  const template = RULE_TEMPLATES.find((rule) => rule.filename === 'activity-ledger.md');
  if (!template) return;
  await writeRule(fs, template.filename, template.content);
}
