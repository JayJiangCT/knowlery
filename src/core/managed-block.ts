export const MANAGED_BLOCK_START = '<!-- Knowlery managed:start -->';
export const MANAGED_BLOCK_END = '<!-- Knowlery managed:end -->';

/** Wraps rendered sections in the markers, with the generator note first. */
export function wrapManagedBlock(note: string, sections: string[]): string {
  return [
    MANAGED_BLOCK_START,
    `<!-- ${note} -->`,
    '',
    sections.filter((section) => section.length > 0).join('\n\n'),
    '',
    MANAGED_BLOCK_END,
  ].join('\n');
}

/**
 * With markers present the block is replaced in place. Without markers (a
 * pre-existing, hand-written file) the block goes *first* and the user's text
 * follows — the same order Claude Code documents for CLAUDE.md ("loads the
 * imported file, then appends the rest"): shared instructions lead, additions
 * trail. Nothing of the user's is dropped; a reset is the explicit way to discard it.
 */
export function mergeManagedBlock(existing: string | null, block: string): string {
  if (existing === null || existing.trim().length === 0) {
    return `${block}\n`;
  }

  const start = existing.indexOf(MANAGED_BLOCK_START);
  const end = existing.indexOf(MANAGED_BLOCK_END, start + MANAGED_BLOCK_START.length);
  if (start !== -1 && end !== -1) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + MANAGED_BLOCK_END.length);
    return `${before}${block}${after.endsWith('\n') ? after : `${after}\n`}`;
  }

  return `${block}\n\n${existing.trim()}\n`;
}
