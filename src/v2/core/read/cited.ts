import type { Config } from '../config';
import { KnowleryError } from '../errors';
import { getExtraction, type ExtractionOptions } from '../extract';
import type { Problem } from '../extract/types';
import type { Format } from '../inventory';
import { parseLocator, resolveLocator } from '../locator';
import { readPage } from '../page/files';
import { relativePath, resolveInside } from '../paths';
import { paginateSegments, pieceSegments } from './page';

export const CITED_PAGE_CAP = 8192;

export interface ReadCitedOptions extends Pick<ExtractionOptions, 'registry' | 'ceiling'> {
  offset?: number;
  expectedVersion?: string;
}

export interface ReadCitedNext {
  select: string;
  from: string;
  offset: number;
  expected_version: string;
}

export interface ReadCitedResult {
  kind: 'cited';
  path: string;
  format: Format;
  version: string;
  select: string;
  from: string;
  key: string;
  pin: 'match' | 'changed';
  pinned_version: string;
  locator: string;
  quote: string | null;
  state: 'ok' | 'partial';
  problems: Problem[];
  text: string;
  offset: number;
  bytes: number;
  total_bytes: number;
  partial: boolean;
  more: boolean;
  next: ReadCitedNext | null;
  meta: Record<string, unknown>;
  cache: 'hit' | 'miss';
  warnings: string[];
}

export async function readCited(
  root: string,
  config: Config,
  input: string,
  key: string,
  from: string,
  options: ReadCitedOptions = {},
): Promise<ReadCitedResult> {
  if (options.expectedVersion !== undefined && !/^sha256:[a-f0-9]{64}$/.test(options.expectedVersion)) {
    throw new KnowleryError('invalid_selector', `Invalid expected version: ${options.expectedVersion}`, 'Pass a sha256:<64 hex> digest from a previous read.');
  }

  const parsedPage = await readPage(root, from);
  const canonicalFrom = relativePath(root, await resolveInside(root, from));
  const entry = parsedPage.sources.find((source) => source.key === key);
  if (!entry) {
    throw new KnowleryError(
      'not_found',
      `Source key "${key}" not found in ${canonicalFrom}.`,
      'Check the Sources section of the wiki page for valid keys.',
    );
  }

  const canonicalPath = relativePath(root, await resolveInside(root, input));
  if (entry.path !== canonicalPath) {
    throw new KnowleryError(
      'invalid_selector',
      `Source key "${key}" in ${canonicalFrom} cites "${entry.path}", not "${canonicalPath}".`,
      `Read "${entry.path}" with --select cited:${key} --from ${canonicalFrom}.`,
    );
  }

  const extraction = await getExtraction(root, input, {
    registry: options.registry,
    config,
    ceiling: options.ceiling,
    listing: false,
  });

  if (extraction.state === 'too_large') {
    throw new KnowleryError('limit_reached', `Source exceeds extraction size limit: ${input}`, 'Reduce the source size or split the file.');
  }

  if (options.expectedVersion !== undefined && options.expectedVersion !== extraction.sha256) {
    throw new KnowleryError(
      'stale_version',
      `Source changed since version ${options.expectedVersion}.`,
      'Read again without --offset.',
    );
  }

  if (extraction.state === 'unavailable' || extraction.state === 'unreadable' || !extraction.header || !extraction.sha256) {
    const codes = extraction.header?.problems.map((problem) => problem.code) ?? [];
    const suffix = codes.length > 0 ? ` (${codes.join(', ')})` : '';
    throw new KnowleryError(
      'extraction_unavailable',
      `Source text is unavailable for ${input}${suffix}.`,
      'Check the file format and encoding.',
    );
  }

  const pinnedVersion = `sha256:${entry.sha256}`;
  const pin: 'match' | 'changed' = extraction.sha256 === pinnedVersion ? 'match' : 'changed';

  let resolved;
  try {
    const parsedLocator = parseLocator(entry.locator);
    resolved = resolveLocator(extraction, parsedLocator);
  } catch (error) {
    if (pin === 'changed') {
      throw new KnowleryError(
        'stale_version',
        `Source ${canonicalPath} changed since it was pinned and the cited location "${entry.locator}" is gone.`,
        `Read the outline of ${canonicalPath} to find the updated location.`,
      );
    }
    throw error;
  }

  const select = `cited:${key}`;
  const offset = options.offset ?? 0;
  const page = paginateSegments(pieceSegments(resolved.pieces), offset, CITED_PAGE_CAP);

  const next: ReadCitedNext | null = page.more
    ? { select, from: canonicalFrom, offset: page.offset + page.bytes, expected_version: extraction.sha256 }
    : null;

  return {
    kind: 'cited',
    path: canonicalPath,
    format: extraction.header.format,
    version: extraction.sha256,
    select,
    from: canonicalFrom,
    key,
    pin,
    pinned_version: pinnedVersion,
    locator: resolved.locator,
    quote: entry.quote,
    state: extraction.state,
    problems: extraction.header.problems,
    text: page.text,
    offset: page.offset,
    bytes: page.bytes,
    total_bytes: page.total_bytes,
    partial: page.partial,
    more: page.more,
    next,
    meta: extraction.header.meta,
    cache: extraction.cached ? 'hit' : 'miss',
    warnings: extraction.warnings,
  };
}
