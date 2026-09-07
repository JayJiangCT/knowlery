// §15.4: KNOWLEDGE.md is written once by generateKnowledgeMd (setup /
// migration / manual regenerate — see setup-executor.ts) and is never
// rewritten wholesale by install/uninstall. This module only ever touches
// the delimited region below, so installing or removing bundles cannot
// clobber the rest of the document.

import type { VaultFs } from '../vault-fs';
import { readInstalledBundles } from './registry';

export const INSTALLED_BUNDLES_BEGIN_MARKER = '<!-- KNOWLERY:INSTALLED_BUNDLES:BEGIN -->';
export const INSTALLED_BUNDLES_END_MARKER = '<!-- KNOWLERY:INSTALLED_BUNDLES:END -->';

// A standalone paragraph, not a list item: the block is appended at the end of
// KNOWLEDGE.md, nowhere near the retrieval steps it once continued as "9.".
const BLOCK_BODY = [
  'Installed knowledge bundles: if the question might be answered by one, check',
  "`.knowlery/bundles.json` and read the relevant bundle's `Library/<id>/agent-index.json`",
  '(`index.md` in the same directory is the human-readable equivalent).',
].join('\n');

export function ensureInstalledBundlesBlock(knowledgeMd: string): string {
  const block = `${INSTALLED_BUNDLES_BEGIN_MARKER}\n${BLOCK_BODY}\n${INSTALLED_BUNDLES_END_MARKER}`;
  if (knowledgeMd.includes(INSTALLED_BUNDLES_BEGIN_MARKER)) {
    // Rewrite the delimited region so wording changes shipped in newer
    // plugin versions reach vaults that already have the block.
    const pattern = new RegExp(
      `${escapeRegExp(INSTALLED_BUNDLES_BEGIN_MARKER)}[\\s\\S]*?${escapeRegExp(INSTALLED_BUNDLES_END_MARKER)}`,
    );
    return knowledgeMd.replace(pattern, block);
  }
  return `${knowledgeMd.trimEnd()}\n\n${block}\n`;
}

// Called on plugin-version change so existing vaults pick up wording
// updates without waiting for the next bundle install.
export async function refreshInstalledBundlesBlock(fs: VaultFs): Promise<void> {
  if (!(await fs.exists('KNOWLEDGE.md'))) return;
  const current = await fs.read('KNOWLEDGE.md');

  const registry = await readInstalledBundles(fs);
  // No bundles: a leftover block (e.g. from before an uninstall that predates this
  // guard) is Knowlery-owned and marker-delimited, so removing it is safe.
  const updated = Object.keys(registry.bundles).length === 0
    ? removeInstalledBundlesBlock(current)
    : ensureInstalledBundlesBlock(current);
  if (updated !== current) await fs.write('KNOWLEDGE.md', updated);
}

export function removeInstalledBundlesBlock(knowledgeMd: string): string {
  if (!knowledgeMd.includes(INSTALLED_BUNDLES_BEGIN_MARKER)) return knowledgeMd;
  const pattern = new RegExp(
    `\\n*${escapeRegExp(INSTALLED_BUNDLES_BEGIN_MARKER)}[\\s\\S]*?${escapeRegExp(INSTALLED_BUNDLES_END_MARKER)}\\n*`,
    'g',
  );
  return knowledgeMd.replace(pattern, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
