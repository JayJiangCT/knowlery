import { createHash } from 'node:crypto';
import type { Config } from '../config';
import { invalidInvocation, KnowleryError } from '../errors';
import { getExtraction, type ExtractionOptions } from '../extract';
import type { Unit } from '../extract/types';
import { rememberInventoryHashes, scanRawSources, type Format, type RawSource } from '../inventory';
import { formatLocator, type Locator } from '../locator';
import { countSubstring, extractQueryTerms, tokenize, type QueryTerm } from './terms';

const PAGE_BYTE_BUDGET = 12288;
const SNIPPET_MAX_BYTES = 500;

export interface RawSearchHit {
  path: string;
  format: Format;
  version: string;
  locator: string;
  phrase: boolean;
  matches: number;
  title: string | null;
  description: string | null;
  snippet: string;
}

export interface RawSearchOptions extends Pick<ExtractionOptions, 'registry' | 'ceiling'> {
  limit?: number;
  offset?: number;
  snapshot?: string;
}

export interface RawSearchResult {
  scope: 'raw';
  query: string;
  verdict: 'ok' | 'no_confident_match';
  terms: string[];
  counts: {
    searched: number;
    matched: number;
    not_searched: {
      unreadable: number;
      too_large: number;
      unavailable: number;
    };
  };
  hits: RawSearchHit[];
  offset: number;
  returned: number;
  more: boolean;
  next: { offset: number; snapshot: string } | null;
  snapshot: string;
  warnings: string[];
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function unitToLocator(unit: Unit): Locator {
  switch (unit.kind) {
    case 'heading':
      return { kind: 'heading', path: unit.path };
    case 'block':
      if ('page' in unit && unit.page !== undefined) {
        return { kind: 'pages', start: unit.page, end: unit.page };
      }
      return { kind: 'heading', path: unit.path };
    case 'lines':
      return { kind: 'lines', start: unit.start, end: unit.end };
    case 'row':
      if (unit.sheet !== undefined && unit.col !== undefined) {
        const cellCount = unit.text.split('\t').length;
        const endCol = unit.col + Math.max(0, cellCount - 1);
        return {
          kind: 'sheet',
          sheet: unit.sheet,
          range: {
            startCol: unit.col,
            startRow: unit.row,
            endCol,
            endRow: unit.row,
          },
        };
      }
      return { kind: 'rows', start: unit.row, end: unit.row };
  }
}

interface UnitMatch {
  unit: Unit;
  collapsed: string;
  phrase: boolean;
  occurrences: number;
  firstMatchOffset: number;
}

function findFirstTermOffset(lower: string, terms: QueryTerm[]): number {
  let best = -1;
  for (const term of terms) {
    if (term.cjk) {
      const idx = lower.indexOf(term.raw);
      if (idx !== -1 && (best === -1 || idx < best)) best = idx;
    } else {
      const re = /[a-z0-9]+/g;
      const variantSet = new Set(term.variants);
      let match: RegExpExecArray | null;
      while ((match = re.exec(lower)) !== null) {
        if (variantSet.has(match[0])) {
          if (best === -1 || match.index < best) best = match.index;
          break;
        }
      }
    }
  }
  return best === -1 ? 0 : best;
}

function matchUnit(unit: Unit, collapsedQuery: string, terms: QueryTerm[]): UnitMatch | null {
  const collapsed = collapseWhitespace(unit.text);
  if (!collapsed) return null;
  const lower = collapsed.toLowerCase();

  const phraseIdx = collapsedQuery.length > 0 ? lower.indexOf(collapsedQuery) : -1;
  const isPhrase = phraseIdx !== -1;

  let occurrences = 0;
  let allTermsMatched = terms.length > 0;

  if (terms.length > 0) {
    let tokenCounts: Map<string, number> | undefined;
    for (const term of terms) {
      let count = 0;
      if (term.cjk) {
        count = countSubstring(lower, term.raw);
      } else {
        if (!tokenCounts) {
          tokenCounts = new Map<string, number>();
          for (const token of tokenize(lower)) {
            tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1);
          }
        }
        for (const variant of term.variants) {
          count += tokenCounts.get(variant) ?? 0;
        }
      }
      if (count === 0) allTermsMatched = false;
      occurrences += count;
    }
  }

  if (!isPhrase && !allTermsMatched) return null;

  const firstMatchOffset = isPhrase ? phraseIdx : findFirstTermOffset(lower, terms);
  return {
    unit,
    collapsed,
    phrase: isPhrase,
    occurrences,
    firstMatchOffset,
  };
}

function buildSnippet(collapsed: string, matchOffset: number, maxBytes: number): string {
  if (Buffer.byteLength(collapsed, 'utf8') <= maxBytes) return collapsed;

  const chars = Array.from(collapsed);
  // Map UTF-16 code unit offset (matchOffset) to character index.
  let matchCharIdx = 0;
  let utf16Pos = 0;
  while (matchCharIdx < chars.length && utf16Pos < matchOffset) {
    utf16Pos += chars[matchCharIdx].length;
    matchCharIdx++;
  }

  // Try to start up to 80 bytes before the first match so context precedes it.
  let startCharIdx = matchCharIdx;
  let backBytes = 0;
  while (startCharIdx > 0 && backBytes < 80) {
    const prevBytes = Buffer.byteLength(chars[startCharIdx - 1], 'utf8');
    if (backBytes + prevBytes > 80) break;
    backBytes += prevBytes;
    startCharIdx--;
  }

  // Fill forward up to maxBytes from startCharIdx.
  let endCharIdx = startCharIdx;
  let totalBytes = 0;
  while (endCharIdx < chars.length) {
    const chBytes = Buffer.byteLength(chars[endCharIdx], 'utf8');
    if (totalBytes + chBytes > maxBytes) break;
    totalBytes += chBytes;
    endCharIdx++;
  }

  // If we hit the end of the text with room to spare, expand backwards.
  while (startCharIdx > 0) {
    const prevBytes = Buffer.byteLength(chars[startCharIdx - 1], 'utf8');
    if (totalBytes + prevBytes > maxBytes) break;
    totalBytes += prevBytes;
    startCharIdx--;
  }

  return chars.slice(startCharIdx, endCharIdx).join('');
}

function isBetterUnit(a: UnitMatch, b: UnitMatch): boolean {
  if (a.phrase !== b.phrase) return a.phrase;
  if (a.occurrences !== b.occurrences) return a.occurrences > b.occurrences;
  return a.unit.i < b.unit.i;
}

function compareHits(a: RawSearchHit, b: RawSearchHit): number {
  if (a.phrase !== b.phrase) return a.phrase ? -1 : 1;
  if (a.matches !== b.matches) return b.matches - a.matches;
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

export async function searchRaw(
  root: string,
  config: Config,
  query: string,
  options: RawSearchOptions = {},
): Promise<RawSearchResult> {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25 || !Number.isSafeInteger(offset) || offset < 0) {
    invalidInvocation('Invalid search pagination.');
  }

  const terms = extractQueryTerms(query);
  const termStrings = terms.map((term) => term.raw);
  const collapsedQuery = collapseWhitespace(query).toLowerCase();

  const { sources } = await scanRawSources(root, config);
  const notSearched = { unreadable: 0, too_large: 0, unavailable: 0 };
  const warnings = new Set<string>();
  const hashes: (RawSource & { sha256: string })[] = [];
  const snapshotHash = createHash('sha256');
  const allHits: RawSearchHit[] = [];

  for (const source of sources) {
    const extraction = await getExtraction(root, source.path, {
      config,
      registry: options.registry,
      ceiling: options.ceiling,
      listing: true,
    });
    for (const warning of extraction.warnings) warnings.add(warning);
    if (extraction.sha256) {
      hashes.push({ ...source, sha256: extraction.sha256 });
    }
    snapshotHash.update(`${source.path}\t${extraction.sha256 ?? ''}\n`);

    if (extraction.state === 'unreadable') {
      notSearched.unreadable++;
      continue;
    }
    if (extraction.state === 'too_large') {
      notSearched.too_large++;
      continue;
    }
    if (extraction.state === 'unavailable') {
      notSearched.unavailable++;
      continue;
    }

    if (collapsedQuery.length === 0 && terms.length === 0) continue;

    let best: UnitMatch | null = null;
    let matchingUnits = 0;
    for (const unit of extraction.units) {
      const m = matchUnit(unit, collapsedQuery, terms);
      if (!m) continue;
      matchingUnits++;
      if (!best || isBetterUnit(m, best)) {
        best = m;
      }
    }

    if (best && extraction.sha256) {
      const meta = extraction.header?.meta ?? {};
      const title = typeof meta.title === 'string' ? meta.title : null;
      const description = typeof meta.description === 'string' ? meta.description : null;
      allHits.push({
        path: source.path,
        format: source.format,
        version: extraction.sha256,
        locator: formatLocator(unitToLocator(best.unit)),
        phrase: best.phrase,
        matches: matchingUnits,
        title,
        description,
        snippet: buildSnippet(best.collapsed, best.firstMatchOffset, SNIPPET_MAX_BYTES),
      });
    }
  }

  if (hashes.length && !await rememberInventoryHashes(root, hashes)) {
    warnings.add('cache_not_written');
  }

  const snapshot = `sha256:${snapshotHash.digest('hex')}`;
  if (options.snapshot !== undefined && options.snapshot !== snapshot) {
    throw new KnowleryError('stale_version', 'The raw sources changed since the previous page.', 'Start again at offset 0.');
  }

  const warningList = [...warnings].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  if (allHits.length === 0) {
    return {
      scope: 'raw',
      query,
      verdict: 'no_confident_match',
      terms: termStrings,
      counts: {
        searched: sources.length,
        matched: 0,
        not_searched: notSearched,
      },
      hits: [],
      offset,
      returned: 0,
      more: false,
      next: null,
      snapshot,
      warnings: warningList,
    };
  }

  allHits.sort(compareHits);

  const pageHits: RawSearchHit[] = [];
  let bytes = 0;
  for (let i = offset; i < allHits.length && pageHits.length < limit; i++) {
    const size = Buffer.byteLength(JSON.stringify(allHits[i]), 'utf8') + 1;
    if (pageHits.length > 0 && bytes + size > PAGE_BYTE_BUDGET) break;
    pageHits.push(allHits[i]);
    bytes += size;
  }

  const more = offset + pageHits.length < allHits.length;
  return {
    scope: 'raw',
    query,
    verdict: 'ok',
    terms: termStrings,
    counts: {
      searched: sources.length,
      matched: allHits.length,
      not_searched: notSearched,
    },
    hits: pageHits,
    offset,
    returned: pageHits.length,
    more,
    next: more ? { offset: offset + pageHits.length, snapshot } : null,
    snapshot,
    warnings: warningList,
  };
}
