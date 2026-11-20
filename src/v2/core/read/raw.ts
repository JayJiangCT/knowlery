import { posix } from 'node:path';
import { KnowleryError } from '../errors';
import { getExtraction, type ExtractionOptions } from '../extract';
import type { Problem } from '../extract/types';
import type { Format } from '../inventory';
import { parseLocator, resolveLocator } from '../locator';
import { relativePath, resolveInside } from '../paths';
import { buildOutlineLines } from './outline';
import { LOCATOR_PAGE_CAP, OUTLINE_PAGE_CAP, outlineSegments, paginateSegments, pieceSegments } from './page';

export interface ReadRawOptions extends Pick<ExtractionOptions, 'registry' | 'config' | 'ceiling'> {
  select?: string;
  offset?: number;
  expectedVersion?: string;
}

export interface ReadRawNext {
  select: string;
  offset: number;
  expected_version: string;
}

export interface ReadRawResult {
  kind: 'raw';
  path: string;
  format: Format;
  version: string;
  select: string;
  state: 'ok' | 'partial';
  problems: Problem[];
  text: string;
  offset: number;
  bytes: number;
  total_bytes: number;
  partial: boolean;
  more: boolean;
  next: ReadRawNext | null;
  meta: Record<string, unknown>;
  cache: 'hit' | 'miss';
  warnings: string[];
}

function isWikiPath(input: string): boolean {
  const normalized = posix.normalize(input.replace(/\\/g, '/'));
  return normalized === 'wiki' || normalized.startsWith('wiki/');
}

export async function readRaw(root: string, input: string, options: ReadRawOptions = {}): Promise<ReadRawResult> {
  if (isWikiPath(input)) {
    throw new KnowleryError('invalid_selector', `Wiki pages cannot be read yet: ${input}`, 'Choose a raw source outside wiki/.');
  }

  if (options.expectedVersion !== undefined && !/^sha256:[a-f0-9]{64}$/.test(options.expectedVersion)) {
    throw new KnowleryError('invalid_selector', `Invalid expected version: ${options.expectedVersion}`, 'Pass a sha256:<64 hex> digest from a previous read.');
  }

  const extraction = await getExtraction(root, input, {
    registry: options.registry,
    config: options.config,
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

  const canonicalPath = relativePath(root, await resolveInside(root, input));
  const selectInput = options.select ?? 'outline';
  const offset = options.offset ?? 0;

  let select: string;
  let page;
  if (selectInput === 'outline') {
    select = 'outline';
    const lines = buildOutlineLines(extraction);
    page = paginateSegments(outlineSegments(lines), offset, OUTLINE_PAGE_CAP);
  } else {
    const parsed = parseLocator(selectInput);
    const resolved = resolveLocator(extraction, parsed);
    select = resolved.locator;
    page = paginateSegments(pieceSegments(resolved.pieces), offset, LOCATOR_PAGE_CAP);
  }

  const next: ReadRawNext | null = page.more
    ? { select, offset: page.offset + page.bytes, expected_version: extraction.sha256 }
    : null;

  return {
    kind: 'raw',
    path: canonicalPath,
    format: extraction.header.format,
    version: extraction.sha256,
    select,
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
