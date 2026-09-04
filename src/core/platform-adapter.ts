import type { VaultFs } from './vault-fs';
import { RULES_DIR, syncAgentsMd } from './agents-md';
import { syncClaudeMd } from './claude-md';

/**
 * Two entry files, one fixed context. AGENTS.md is the entry for Codex and
 * OpenCode (no import syntax there, so it *points at* KNOWLEDGE.md and the rules
 * and carries the operating rules); `.claude/CLAUDE.md` is the entry for Claude
 * Code (`@` imports of KNOWLEDGE.md and each rule, operating rules inlined).
 * Both are written regardless of the selected platform, so a vault opened in
 * any agent starts every session from the same sources. The platform setting
 * only steers CLI detection and labels.
 */
export async function generatePlatformConfig(fs: VaultFs): Promise<void> {
  await fs.mkdir(RULES_DIR);
  await syncAgentConfig(fs);
}

/** Both entry files list the rule files, so a rule change re-renders both. */
export async function syncAgentConfig(fs: VaultFs): Promise<void> {
  await syncAgentsMd(fs);
  await syncClaudeMd(fs);
}
