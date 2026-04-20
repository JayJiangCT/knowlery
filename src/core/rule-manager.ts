import { App, normalizePath } from 'obsidian';
import type { Platform, RuleInfo } from '../types';
import { RULE_TEMPLATES, type RuleTemplate } from '../assets/rules';
import { getRulesDir } from './platform-adapter';
import { ensureDir, writeFile } from './vault-io';

export function getRuleTemplates(): RuleTemplate[] {
  return RULE_TEMPLATES;
}

export async function listRules(app: App, platform: Platform): Promise<RuleInfo[]> {
  const rulesDir = getRulesDir(platform);
  const adapter = app.vault.adapter;
  const dirPath = normalizePath(rulesDir);
  if (!(await adapter.exists(dirPath))) return [];

  const listing = await adapter.list(dirPath);
  const rules: RuleInfo[] = [];
  for (const filePath of listing.files) {
    if (!filePath.endsWith('.md')) continue;
    const filename = filePath.split('/').pop()!;
    const content = await adapter.read(normalizePath(filePath));
    rules.push({
      name: filename.replace(/\.md$/, ''),
      filename,
      content,
    });
  }

  return rules;
}

export async function readRule(
  app: App,
  platform: Platform,
  filename: string,
): Promise<string | null> {
  const rulesDir = getRulesDir(platform);
  const path = normalizePath(`${rulesDir}/${filename}`);
  if (!(await app.vault.adapter.exists(path))) return null;
  return app.vault.adapter.read(path);
}

export async function writeRule(
  app: App,
  platform: Platform,
  filename: string,
  content: string,
): Promise<void> {
  const rulesDir = getRulesDir(platform);
  await ensureDir(app, rulesDir);
  await writeFile(app, `${rulesDir}/${filename}`, content);
}

export async function deleteRule(
  app: App,
  platform: Platform,
  filename: string,
): Promise<void> {
  const rulesDir = getRulesDir(platform);
  const path = normalizePath(`${rulesDir}/${filename}`);
  if (await app.vault.adapter.exists(path)) {
    await app.vault.adapter.remove(path);
  }
}

export async function installDefaultRules(
  app: App,
  platform: Platform,
): Promise<void> {
  for (const template of RULE_TEMPLATES) {
    await writeRule(app, platform, template.filename, template.content);
  }
}

