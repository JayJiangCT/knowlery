import type { VaultFs } from './vault-fs';
import { RULES_DIR, syncAgentsMd } from './agents-md';
import { syncClaudeMd } from './claude-md';

/**
 * One fixed context for every platform. AGENTS.md (the cross-vendor standard)
 * carries the operating card and the rules inlined; `.claude/CLAUDE.md` imports
 * it. Both are written regardless of the selected platform, so a vault opened in
 * any agent starts every session with the same instructions. The platform
 * setting only steers CLI detection and labels.
 */
export async function generatePlatformConfig(fs: VaultFs): Promise<void> {
  await fs.mkdir(RULES_DIR);
  await syncAgentsMd(fs);
  await syncClaudeMd(fs);
}
