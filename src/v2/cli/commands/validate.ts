import type { Config } from '../../core/config';
import type { ExtractionOptions } from '../../core/extract';
import { validateWiki } from '../../core/validate';
import type { ParsedArgs } from '../args';

export async function runValidate(
  root: string,
  config: Config,
  args: Pick<ParsedArgs, 'scope' | 'limit' | 'offset' | 'snapshot'>,
  extractionOptions: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {},
) {
  const result = await validateWiki(root, config, {
    scope: args.scope,
    limit: args.limit,
    offset: args.offset,
    snapshot: args.snapshot,
    ...extractionOptions,
  });
  const { counts } = result;
  const lines = [
    `pages: ${counts.pages}  errors: ${counts.errors}  warnings: ${counts.warnings}  not_checked: ${counts.not_checked}`,
  ];
  for (const item of result.items) {
    const location = item.line === null ? item.path : `${item.path}:${item.line}`;
    lines.push(`${location}\t${item.severity}\t${item.code}\t${item.message}`);
  }
  if (result.next) {
    lines.push(`more: --offset ${result.next.offset} --snapshot ${result.next.snapshot}`);
  }
  for (const warning of result.warnings) {
    lines.push(`warning: ${warning}`);
  }
  return { result, text: `${lines.join('\n')}\n` };
}
