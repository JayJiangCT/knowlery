import type { App } from 'obsidian';
import { generateClaudeMd } from '../assets/templates';
import { writeFile } from './vault-io';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export const CLAUDE_RULE_IMPORTS_START = '<!-- Knowlery rule imports:start -->';
export const CLAUDE_RULE_IMPORTS_END = '<!-- Knowlery rule imports:end -->';

export async function collectRuleImportPaths(app: App, rulesDir: string): Promise<string[]> {
  const normalizedRulesDir = normalizePath(rulesDir);
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(normalizedRulesDir))) return [];

  const imports: string[] = [];

  async function walk(dir: string): Promise<void> {
    const listing = await adapter.list(normalizePath(dir));
    for (const filePath of listing.files) {
      const normalizedFile = normalizePath(filePath);
      if (!normalizedFile.endsWith('.md')) continue;
      if (!normalizedFile.startsWith(`${normalizedRulesDir}/`)) continue;
      imports.push(normalizedFile.slice(normalizedRulesDir.length + 1));
    }

    for (const folderPath of listing.folders) {
      await walk(folderPath);
    }
  }

  await walk(normalizedRulesDir);
  return normalizeRuleImportPaths(imports);
}

export function normalizeRuleImportPaths(paths: string[]): string[] {
  return [...new Set(paths)]
    .map((path) => normalizePath(path).replace(/^\/+/, ''))
    .filter((path) => path.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b));
}

export function renderClaudeRuleImportBlock(ruleImportPaths: string[]): string {
  const imports = normalizeRuleImportPaths(ruleImportPaths).map((path) => `@rules/${path}`);
  if (imports.length === 0) return '';

  return [
    CLAUDE_RULE_IMPORTS_START,
    ...imports,
    CLAUDE_RULE_IMPORTS_END,
  ].join('\n');
}

export function mergeClaudeRuleImports(content: string, ruleImportPaths: string[]): string {
  const block = renderClaudeRuleImportBlock(ruleImportPaths);
  const withoutExistingBlock = content.replace(
    new RegExp(`${escapeRegExp(CLAUDE_RULE_IMPORTS_START)}[\\s\\S]*?${escapeRegExp(CLAUDE_RULE_IMPORTS_END)}\\n?`, 'g'),
    '',
  );
  const withoutLegacyRuleImports = withoutExistingBlock
    .split(/\r?\n/)
    .filter((line) => !/^@rules\/.+\.md$/.test(line.trim()))
    .join('\n')
    .trimEnd();

  if (!block) return `${withoutLegacyRuleImports}\n`;
  return `${withoutLegacyRuleImports}\n${block}\n`;
}

export async function syncClaudeRuleImports(app: App): Promise<void> {
  const claudeMdPath = '.claude/CLAUDE.md';
  const ruleImports = await collectRuleImportPaths(app, '.claude/rules');
  const existing = await app.vault.adapter.exists(claudeMdPath)
    ? await app.vault.adapter.read(claudeMdPath)
    : generateClaudeMd(ruleImports);
  await writeFile(app, claudeMdPath, mergeClaudeRuleImports(existing, ruleImports));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
