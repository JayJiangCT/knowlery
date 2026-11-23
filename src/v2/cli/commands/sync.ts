import { syncKb, type SyncResult } from '../../core/sync';
import type { ParsedArgs } from '../args';

export async function runSync(
  root: string,
  args: Pick<ParsedArgs, 'apply'>,
): Promise<{ result: SyncResult; text: string }> {
  const result = await syncKb(root, { apply: args.apply });
  const lines = [`conventions: ${result.conventions}`];
  if (result.conventions === 'outdated') {
    for (const line of result.removed) lines.push(`- ${line}`);
    if (result.removed_more > 0) lines.push(`... +${result.removed_more} more removed`);
    for (const line of result.added) lines.push(`+ ${line}`);
    if (result.added_more > 0) lines.push(`... +${result.added_more} more added`);
  }
  return { result, text: `${lines.join('\n')}\n` };
}
