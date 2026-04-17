import { App, normalizePath, TFile } from 'obsidian';
import type { Platform, RuleInfo } from '../types';
import { RULE_TEMPLATES, type RuleTemplate } from '../assets/rules';
import { getRulesDir } from './platform-adapter';

export function getRuleTemplates(): RuleTemplate[] {
  return RULE_TEMPLATES;
}

export async function listRules(app: App, platform: Platform): Promise<RuleInfo[]> {
  const rulesDir = getRulesDir(platform);
  const folder = app.vault.getFolderByPath(normalizePath(rulesDir));
  if (!folder) return [];

  const rules: RuleInfo[] = [];
  for (const child of folder.children) {
    if (!(child instanceof TFile) || !child.name.endsWith('.md')) continue;

    const content = await app.vault.cachedRead(child);
    rules.push({
      name: child.basename,
      filename: child.name,
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
  const file = app.vault.getFileByPath(normalizePath(`${rulesDir}/${filename}`));
  if (!file) return null;
  return app.vault.cachedRead(file);
}

export async function writeRule(
  app: App,
  platform: Platform,
  filename: string,
  content: string,
): Promise<void> {
  const rulesDir = getRulesDir(platform);
  await ensureDir(app, normalizePath(rulesDir));

  const filePath = normalizePath(`${rulesDir}/${filename}`);
  const existing = app.vault.getFileByPath(filePath);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(filePath, content);
  }
}

export async function deleteRule(
  app: App,
  platform: Platform,
  filename: string,
): Promise<void> {
  const rulesDir = getRulesDir(platform);
  const file = app.vault.getFileByPath(normalizePath(`${rulesDir}/${filename}`));
  if (file) {
    await app.vault.trash(file, true);
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

async function ensureDir(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!app.vault.getFolderByPath(normalized)) {
    await app.vault.createFolder(normalized);
  }
}
