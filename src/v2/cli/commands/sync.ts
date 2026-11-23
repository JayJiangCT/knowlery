import { syncKb, type SyncResult } from '../../core/sync';
import type { ParsedArgs } from '../args';

function appendDiff(lines: string[], removed: string[], added: string[], removedMore: number, addedMore: number): void {
  for (const line of removed) lines.push(`- ${line}`);
  if (removedMore > 0) lines.push(`... +${removedMore} more removed`);
  for (const line of added) lines.push(`+ ${line}`);
  if (addedMore > 0) lines.push(`... +${addedMore} more added`);
}

export async function runSync(
  root: string,
  args: Pick<ParsedArgs, 'apply' | 'skillsDir'>,
): Promise<{ result: SyncResult; text: string }> {
  const result = await syncKb(root, { apply: args.apply, skillsDir: args.skillsDir });
  const lines = [`conventions: ${result.conventions}`];
  if (result.conventions === 'outdated') {
    appendDiff(lines, result.removed, result.added, result.removed_more, result.added_more);
  }
  for (const skill of result.skills) {
    lines.push(`skill ${skill.name} (${skill.path}): ${skill.state}`);
    if (skill.state === 'outdated') {
      appendDiff(lines, skill.removed ?? [], skill.added ?? [], skill.removed_more ?? 0, skill.added_more ?? 0);
    }
  }
  return { result, text: `${lines.join('\n')}\n` };
}
