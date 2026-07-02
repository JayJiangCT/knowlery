// §15.4: KNOWLEDGE.md is written once by generateKnowledgeMd (setup /
// migration / manual regenerate — see setup-executor.ts) and is never
// rewritten wholesale by install/uninstall. This module only ever touches
// the delimited region below, so installing or removing bundles cannot
// clobber the rest of the document.

export const INSTALLED_BUNDLES_BEGIN_MARKER = '<!-- KNOWLERY:INSTALLED_BUNDLES:BEGIN -->';
export const INSTALLED_BUNDLES_END_MARKER = '<!-- KNOWLERY:INSTALLED_BUNDLES:END -->';

const BLOCK_BODY = [
  '9. If the question might be answered by an installed knowledge bundle,',
  "   check `.knowlery/bundles.json` and read the relevant bundle's",
  '   `Library/<id>/index.md`.',
].join('\n');

export function ensureInstalledBundlesBlock(knowledgeMd: string): string {
  if (knowledgeMd.includes(INSTALLED_BUNDLES_BEGIN_MARKER)) return knowledgeMd;
  const block = `${INSTALLED_BUNDLES_BEGIN_MARKER}\n${BLOCK_BODY}\n${INSTALLED_BUNDLES_END_MARKER}`;
  return `${knowledgeMd.trimEnd()}\n\n${block}\n`;
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
