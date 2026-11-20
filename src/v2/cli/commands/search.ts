import type { Config } from '../../core/config';
import { invalidInvocation } from '../../core/errors';
import type { ExtractionOptions } from '../../core/extract';
import { searchRaw, type RawSearchResult } from '../../core/search/raw';
import { searchWiki, type WikiSearchResult } from '../../core/search/wiki';
import type { ParsedArgs } from '../args';

export type SearchResult = WikiSearchResult | RawSearchResult;

function formatWikiText(result: WikiSearchResult): string {
  const start = result.returned > 0 ? result.offset + 1 : 0;
  const end = result.offset + result.returned;
  const range = result.returned > 0 ? `${start}-${end} of ${result.counts.matched}` : `0 of ${result.counts.matched}`;
  const tail = result.more ? 'more' : 'end';
  const lines = [`search wiki  verdict: ${result.verdict}  hits: ${range} (${tail})`];

  for (const hit of result.hits) {
    const meta = [hit.type, hit.status, `freshness:${hit.freshness}`, `score:${hit.score}`]
      .filter((part): part is string => Boolean(part))
      .join('  ');
    lines.push(`${hit.path}  ${hit.title}  [${meta}]`);
    if (hit.description) lines.push(`  desc: ${hit.description}`);
    if (hit.snippet) lines.push(`  snippet: ${hit.snippet}`);
    if (hit.relations.length > 0) {
      const relParts = hit.relations.map((rel) => `${rel.direction === 'out' ? '->' : '<-'}${rel.type}:${rel.page}`);
      const moreSuffix = hit.relations_more > 0 ? ` (+${hit.relations_more} more)` : '';
      lines.push(`  relations: ${relParts.join(', ')}${moreSuffix}`);
    }
  }

  if (result.next) {
    lines.push(`more: --offset ${result.next.offset} --snapshot ${result.next.snapshot}`);
  }
  for (const warning of result.warnings) {
    lines.push(`warning: ${warning}`);
  }
  return `${lines.join('\n')}\n`;
}

function formatRawText(result: RawSearchResult): string {
  const start = result.returned > 0 ? result.offset + 1 : 0;
  const end = result.offset + result.returned;
  const range = result.returned > 0 ? `${start}-${end} of ${result.counts.matched}` : `0 of ${result.counts.matched}`;
  const tail = result.more ? 'more' : 'end';
  const lines = [`search raw  verdict: ${result.verdict}  hits: ${range} (${tail})`];

  for (const hit of result.hits) {
    const matchKind = hit.phrase ? 'phrase' : 'terms';
    const titlePart = hit.title ? `  ${hit.title}` : '';
    lines.push(`${hit.path}  ${hit.locator}${titlePart}  [${hit.format}  ${matchKind}  matches:${hit.matches}]`);
    if (hit.description) lines.push(`  desc: ${hit.description}`);
    if (hit.snippet) lines.push(`  snippet: ${hit.snippet}`);
  }

  if (result.next) {
    lines.push(`more: --offset ${result.next.offset} --snapshot ${result.next.snapshot}`);
  }
  for (const warning of result.warnings) {
    lines.push(`warning: ${warning}`);
  }
  return `${lines.join('\n')}\n`;
}

export async function runSearch(
  root: string,
  config: Config,
  args: Pick<ParsedArgs, 'query' | 'scope' | 'limit' | 'offset' | 'snapshot'>,
  extractionOptions: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {},
): Promise<{ result: SearchResult; text: string }> {
  if (args.query === undefined) {
    invalidInvocation('Missing QUERY for search.');
  }
  const scope = args.scope ?? 'wiki';
  if (scope !== 'wiki' && scope !== 'raw') {
    invalidInvocation(`Invalid --scope for search: ${scope}. Expected "wiki" or "raw".`);
  }
  if (args.limit !== undefined && args.limit > 25) {
    invalidInvocation(`Bad value for --limit: ${args.limit} (maximum is 25).`);
  }

  if (scope === 'wiki') {
    const result = await searchWiki(root, config, args.query, {
      limit: args.limit,
      offset: args.offset,
      snapshot: args.snapshot,
    });
    return { result, text: formatWikiText(result) };
  }

  const result = await searchRaw(root, config, args.query, {
    limit: args.limit,
    offset: args.offset,
    snapshot: args.snapshot,
    ...extractionOptions,
  });
  return { result, text: formatRawText(result) };
}
