import type { VaultFs } from './vault-fs';
import { generateClaudeMd } from '../assets/templates';

export const CLAUDE_MD_PATH = '.claude/CLAUDE.md';
export const CLAUDE_AGENTS_IMPORT = '@../AGENTS.md';

/** Markers of the pre-1.5 managed `@rules/*.md` block; stripped on migration. */
const LEGACY_RULE_IMPORTS_START = '<!-- Knowlery rule imports:start -->';
const LEGACY_RULE_IMPORTS_END = '<!-- Knowlery rule imports:end -->';
const LEGACY_KNOWLEDGE_IMPORT = '@../KNOWLEDGE.md';
const LEGACY_IMPORTS = new Set(['@../SCHEMA.md', '@../INDEX.base']);

/**
 * Claude Code reads CLAUDE.md, not AGENTS.md; its documented pattern is a
 * CLAUDE.md that `@`-imports AGENTS.md so both read the same instructions. That
 * one import is all Knowlery needs — the operating card and the rules are
 * already inlined in AGENTS.md, and `.claude/rules/*.md` no longer has to be
 * imported (Claude auto-loads that directory anyway, which made the old
 * `@rules/*.md` block a second copy).
 *
 * Converges an existing file instead of overwriting it: the pre-1.5 imports
 * (`@../KNOWLEDGE.md`, the managed `@rules/` block, stale `@../SCHEMA.md` /
 * `@../INDEX.base`) are replaced by the single AGENTS.md import; anything else —
 * Claude-specific instructions the user added below — is kept.
 */
export function mergeClaudeMd(existing: string | null): string {
  if (existing === null) return generateClaudeMd();

  const withoutLegacyBlock = existing.replace(
    new RegExp(`${escapeRegExp(LEGACY_RULE_IMPORTS_START)}[\\s\\S]*?${escapeRegExp(LEGACY_RULE_IMPORTS_END)}\\n?`, 'g'),
    '',
  );

  const lines: string[] = [];
  let importPlaced = false;
  for (const line of withoutLegacyBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^@rules\/.+\.md$/.test(trimmed) || LEGACY_IMPORTS.has(trimmed)) continue;
    if (trimmed === LEGACY_KNOWLEDGE_IMPORT || trimmed === CLAUDE_AGENTS_IMPORT) {
      if (importPlaced) continue;
      lines.push(CLAUDE_AGENTS_IMPORT);
      importPlaced = true;
      continue;
    }
    lines.push(line);
  }
  if (!importPlaced) lines.unshift(CLAUDE_AGENTS_IMPORT, '');

  const body = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return `${body}\n`;
}

/** Write-on-change, so a reload never churns the file's mtime. */
export async function syncClaudeMd(fs: VaultFs): Promise<void> {
  const fileExists = await fs.exists(CLAUDE_MD_PATH);
  const existing = fileExists ? await fs.read(CLAUDE_MD_PATH) : null;
  const merged = mergeClaudeMd(existing);
  if (!fileExists) await fs.mkdir('.claude');
  if (!fileExists || merged !== existing) {
    await fs.write(CLAUDE_MD_PATH, merged);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
