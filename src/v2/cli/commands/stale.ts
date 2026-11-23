import type { Config } from '../../core/config';
import type { ExtractionOptions } from '../../core/extract';
import { staleList, type StaleItem, type StalePageRef } from '../../core/stale';
import type { ParsedArgs } from '../args';

function formatPages(pages: StalePageRef[], pagesMore: number): string {
  const parts = pages.map((entry) => `${entry.page}[${entry.keys.join(',')}]`);
  if (pagesMore > 0) parts.push(`+${pagesMore} more`);
  return parts.join('; ');
}

function formatItem(item: StaleItem): string {
  switch (item.category) {
    case 'changed':
      return `${item.category}\t${item.path}\t\t${formatPages(item.pages, item.pages_more)}`;
    case 'missing':
      return `${item.category}\t${item.path}\t\t${formatPages(item.pages, item.pages_more)}`;
    case 'moved':
      return `${item.category}\t${item.path}\t-> ${item.to}\t${formatPages(item.pages, item.pages_more)}`;
    case 'unreadable':
      return `${item.category}\t${item.path}\t${item.state}\t${formatPages(item.pages, item.pages_more)}`;
    case 'unreferenced':
      return `${item.category}\t${item.path}\t${item.format}\t`;
  }
}

export async function runStale(
  root: string,
  config: Config,
  args: Pick<ParsedArgs, 'scope' | 'limit' | 'offset' | 'snapshot'>,
  extractionOptions: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {},
) {
  const result = await staleList(root, config, {
    scope: args.scope,
    limit: args.limit,
    offset: args.offset,
    snapshot: args.snapshot,
    ...extractionOptions,
  });
  const { counts } = result;
  const lines = [
    `sources: ${counts.sources}  pages: ${counts.pages}  changed: ${counts.changed}  missing: ${counts.missing}  moved: ${counts.moved}  unreadable: ${counts.unreadable}  unreferenced: ${counts.unreferenced}`,
  ];
  for (const item of result.items) {
    lines.push(formatItem(item));
  }
  if (result.next) {
    lines.push(`more: --offset ${result.next.offset} --snapshot ${result.next.snapshot}`);
  }
  for (const warning of result.warnings) {
    lines.push(`warning: ${warning}`);
  }
  return { result, text: `${lines.join('\n')}\n` };
}
