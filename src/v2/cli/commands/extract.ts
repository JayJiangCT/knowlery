import { lstat } from 'node:fs/promises';
import type { Config } from '../../core/config';
import { invalidInvocation, KnowleryError } from '../../core/errors';
import { getExtraction, type ExtractionOptions } from '../../core/extract';
import type { ExtractionState, Problem } from '../../core/extract/types';
import { formatFor, rememberInventoryHashes, resolveRawSource, scanRawSources, type Format, type RawSource } from '../../core/inventory';
import type { ParsedArgs } from '../args';

export interface ExtractItem {
  path: string;
  format: Format;
  sha256: string | null;
  state: ExtractionState;
  units: number;
  problems: Problem[];
}
export interface ExtractResult {
  counts: { total: number } & Record<ExtractionState, number>;
  work: { extracted: number; cached: number };
  items: ExtractItem[];
  omitted: number;
  warnings: string[];
}

export async function runExtract(root: string, config: Config, args: Pick<ParsedArgs, 'path' | 'all'>, options: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {}): Promise<{ result: ExtractResult; text: string }> {
  if (Boolean(args.path) === Boolean(args.all)) invalidInvocation('Use extract PATH or extract --all, but not both.');
  const start = await resolveRawSource(root, args.path ?? '.', config);
  const single = (await lstat(start)).isFile();
  if (single && !formatFor(start)) throw new KnowleryError('extraction_unavailable', `No extraction format for: ${args.path}`, 'Choose a supported raw source file.');
  const { sources } = await scanRawSources(root, config, args.path);
  const counts: ExtractResult['counts'] = { total: sources.length, ok: 0, partial: 0, unreadable: 0, too_large: 0, unavailable: 0 };
  const work = { extracted: 0, cached: 0 };
  const items: ExtractItem[] = [];
  const warnings = new Set<string>();
  const hashes: (RawSource & { sha256: string })[] = [];
  let omitted = 0;
  let bytes = 0;
  for (const source of sources) {
    const extraction = await getExtraction(root, source.path, { ...options, config, listing: true });
    const { state, header, sha256 } = extraction;
    counts[state]++;
    if (extraction.cached) work.cached++;
    else if (header) work.extracted++;
    for (const warning of extraction.warnings) warnings.add(warning);
    if (sha256) hashes.push({ ...source, sha256 });
    if (state === 'ok' && !single) continue;
    const item: ExtractItem = { path: source.path, format: source.format, sha256, state, units: extraction.units.length, problems: header?.problems ?? [] };
    const size = Buffer.byteLength(JSON.stringify(item)) + 1;
    if (!single && (items.length >= 50 || bytes + size > 12288)) { omitted++; continue; }
    items.push(item);
    bytes += size;
  }
  if (hashes.length && !await rememberInventoryHashes(root, hashes)) warnings.add('cache_not_written');
  const result = { counts, work, items, omitted, warnings: [...warnings] };
  const summary = `sources: ${counts.total}  ok: ${counts.ok}  partial: ${counts.partial}  unreadable: ${counts.unreadable}  too_large: ${counts.too_large}  unavailable: ${counts.unavailable}`;
  const rows = items.map((item) => `${item.path}\t${item.format}\t${item.sha256 ?? ''}\t${item.state}\t${item.units}\t${JSON.stringify(item.problems)}`);
  return { result, text: [summary, ...rows].join('\n') + '\n' };
}
