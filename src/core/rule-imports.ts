import type { VaultFs } from './vault-fs';
import { normalizeVaultPath } from './vault-fs';
import { generateClaudeMd } from '../assets/templates';

export const CLAUDE_RULE_IMPORTS_START = '<!-- Knowlery rule imports:start -->';
export const CLAUDE_RULE_IMPORTS_END = '<!-- Knowlery rule imports:end -->';

export async function collectRuleImportPaths(fs: VaultFs, rulesDir: string): Promise<string[]> {
  const normalizedRulesDir = normalizeVaultPath(rulesDir);
  if (!(await fs.exists(normalizedRulesDir))) return [];

  const imports: string[] = [];

  async function walk(dir: string): Promise<void> {
    const listing = await fs.list(normalizeVaultPath(dir));
    for (const filePath of listing.files) {
      const normalizedFile = normalizeVaultPath(filePath);
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
    .map((path) => normalizeVaultPath(path).replace(/^\/+/, ''))
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

export async function syncClaudeRuleImports(fs: VaultFs): Promise<void> {
  const claudeMdPath = '.claude/CLAUDE.md';
  const ruleImports = await collectRuleImportPaths(fs, '.claude/rules');
  const fileExists = await fs.exists(claudeMdPath);
  const existing = fileExists
    ? await fs.read(claudeMdPath)
    : generateClaudeMd(ruleImports);
  const merged = mergeClaudeRuleImports(existing, ruleImports);
  // Write only on change: an unconditional write churned the file's mtime on every
  // plugin load (surfaced during F4 acceptance testing).
  if (!fileExists || merged !== existing) {
    await fs.write(claudeMdPath, merged);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
