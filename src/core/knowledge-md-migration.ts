import type { VaultFs } from './vault-fs';
import { LEGACY_OPERATING_RULE_HEADINGS, hasLegacyOperatingRules } from './vault-config-health';
import { INSTALLED_BUNDLES_BEGIN_MARKER, INSTALLED_BUNDLES_END_MARKER } from './okf/knowledge-md-bundles';

/** Where the pre-migration file is kept, once, so nothing the strip removes is lost. */
export const KNOWLEDGE_MD_BACKUP_PATH = '.knowlery/backups/KNOWLEDGE.pre-1.5.md';

/**
 * Every H3 the pre-1.5 KNOWLEDGE.md template ever wrote under the three legacy
 * H2s (checked against the full template history). Any other H3 under those
 * H2s was added by the user and is kept.
 */
const TEMPLATE_H3_HEADINGS = new Set([
  '### Obsidian CLI Only',
  '### Writing Conventions',
  '### Knowledge Workflows',
  '### Quick Reference',
]);

const LEGACY_H2_HEADINGS = new Set<string>(LEGACY_OPERATING_RULE_HEADINGS);

/**
 * Removes the Knowlery-authored operating-rule sections a pre-1.5 template wrote
 * into KNOWLEDGE.md. Those sections now render from the template into the entry
 * files (AGENTS.md / .claude/CLAUDE.md), so the copies in KNOWLEDGE.md are stale
 * duplicates — the user's file kept telling agents to query `INDEX.base`.
 *
 * What goes: the three legacy H2s, their preamble text, and the template's own
 * H3 subsections. What stays: every other section of the file untouched, the
 * installed-bundles marker block (re-appended at the end, where
 * `refreshInstalledBundlesBlock` expects it), and any H3 the user added under
 * a legacy H2 — promoted to H2 (its subtree one level up) in the position the
 * legacy section held, so a "### Freshness Review" filed under
 * "## Knowledge Retrieval" survives as "## Freshness Review".
 */
export function stripLegacyOperatingRules(knowledgeMd: string): string {
  const bundlesPattern = new RegExp(
    `\\n*${escapeRegExp(INSTALLED_BUNDLES_BEGIN_MARKER)}[\\s\\S]*?${escapeRegExp(INSTALLED_BUNDLES_END_MARKER)}\\n*`,
  );
  const bundlesMatch = bundlesPattern.exec(knowledgeMd);
  const bundlesBlock = bundlesMatch ? bundlesMatch[0].trim() : null;
  const body = bundlesMatch ? knowledgeMd.replace(bundlesPattern, '\n') : knowledgeMd;

  const kept: string[] = [];
  let inFence = false;
  let inLegacy = false;
  let dropping = false;
  let promoting = false;

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trimEnd();
    if (/^(```|~~~)/.test(trimmed)) inFence = !inFence;

    if (!inFence && /^## /.test(trimmed)) {
      inLegacy = LEGACY_H2_HEADINGS.has(trimmed);
      dropping = inLegacy;
      promoting = false;
      if (!inLegacy) kept.push(line);
      continue;
    }

    if (inLegacy && !inFence && /^### /.test(trimmed)) {
      if (TEMPLATE_H3_HEADINGS.has(trimmed)) {
        dropping = true;
        promoting = false;
      } else {
        dropping = false;
        promoting = true;
        kept.push(line.replace(/^#/, ''));
      }
      continue;
    }

    if (inLegacy) {
      if (dropping) continue;
      kept.push(promoting && !inFence && /^#{4,} /.test(trimmed) ? line.replace(/^#/, '') : line);
      continue;
    }

    kept.push(line);
  }

  let result = kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  if (bundlesBlock) result = `${result}\n\n${bundlesBlock}`;
  return `${result}\n`;
}

/**
 * Runs once per vault in practice: after the strip the legacy headings are gone
 * and the read-only check short-circuits. The original file is copied to
 * `.knowlery/backups/` before the first write and never overwritten.
 */
export async function migrateKnowledgeMdLegacyOperatingRules(fs: VaultFs): Promise<void> {
  if (!(await fs.exists('KNOWLEDGE.md'))) return;
  const current = await fs.read('KNOWLEDGE.md');
  if (!hasLegacyOperatingRules(current)) return;

  const stripped = stripLegacyOperatingRules(current);
  if (stripped === current) return;

  if (!(await fs.exists(KNOWLEDGE_MD_BACKUP_PATH))) {
    await fs.mkdir(KNOWLEDGE_MD_BACKUP_PATH.slice(0, KNOWLEDGE_MD_BACKUP_PATH.lastIndexOf('/')));
    await fs.write(KNOWLEDGE_MD_BACKUP_PATH, current);
  }
  await fs.write('KNOWLEDGE.md', stripped);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
