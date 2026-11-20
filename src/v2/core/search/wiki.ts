import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { KF_SCHEMA, type RelationType } from '../../schema/kf-2.0';
import type { Config } from '../config';
import { invalidInvocation, KnowleryError } from '../errors';
import { listPages } from '../page/files';
import { pageFreshness, type PageFreshness } from '../page/freshness';
import type { ParsedPage } from '../page/model';
import { parsePage } from '../page/parse';
import {
  countSubstring,
  extractQueryTerms,
  fieldText,
  prefixMatches,
  tokenize,
  truncateUtf8,
  type FieldText,
  type QueryTerm,
} from './terms';

const WEIGHT_TITLE_ALIAS = 4;
const WEIGHT_TAG_BASENAME = 3;
const WEIGHT_DESCRIPTION = 2;
const WEIGHT_BODY = 1;
const PREFIX_MATCH_CREDIT = 0.5;
const CJK_SPECIFICITY = 2;

export const ABSTAIN_BODY_FLOOR = 2;
export const ABSTAIN_STRUCT_COVERAGE = 0.5;
export const ABSTAIN_SOFT_COVERAGE = 2 / 3;

const RELATION_KEYS = Object.keys(KF_SCHEMA.relations) as RelationType[];
const SEARCHED_SECTIONS = new Set(['Current', 'Evidence', 'Open']);
const MAX_RELATIONS = 5;
const PAGE_BYTE_BUDGET = 12288;

export interface WikiSearchRelation {
  type: RelationType;
  page: string;
  direction: 'out' | 'in';
}

export interface WikiSearchHit {
  path: string;
  title: string;
  type: string | null;
  status: string | null;
  freshness: PageFreshness;
  version: string;
  description: string;
  snippet: string;
  relations: WikiSearchRelation[];
  relations_more: number;
  score: number;
  matched: string[];
}

export interface WikiSearchOptions {
  limit?: number;
  offset?: number;
  snapshot?: string;
}

export interface WikiSearchResult {
  scope: 'wiki';
  query: string;
  verdict: 'ok' | 'no_confident_match';
  terms: string[];
  counts: { searched: number; matched: number };
  hits: WikiSearchHit[];
  offset: number;
  returned: number;
  more: boolean;
  next: { offset: number; snapshot: string } | null;
  snapshot: string;
  warnings: string[];
}

interface LoadedPage {
  path: string;
  version: string;
  page: ParsedPage;
  bodyText: string;
}

interface ScoredCandidate {
  loaded: LoadedPage;
  title: string;
  score: number;
  structuredTermCount: number;
  descriptionHits: number;
  bodyScore: number;
  matchedTerms: string[];
  updated: string;
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function countTermIn(term: QueryTerm, field: FieldText): number {
  if (term.cjk) return countSubstring(field.lower, term.raw);
  let count = 0;
  for (const variant of term.variants) {
    count += field.counts.get(variant) ?? 0;
  }
  return count;
}

function termWeight(term: QueryTerm): number {
  return term.cjk ? term.raw.length : 1;
}

function weightedCoverage(matchedRaw: string[], terms: QueryTerm[]): number {
  const weights = new Map(terms.map((term) => [term.raw, termWeight(term)]));
  const total = terms.reduce((sum, term) => sum + termWeight(term), 0);
  if (total === 0) return 0;
  let matched = 0;
  for (const raw of new Set(matchedRaw)) {
    matched += weights.get(raw) ?? 0;
  }
  return matched / total;
}

function shouldAbstain(candidates: ScoredCandidate[], terms: QueryTerm[]): boolean {
  if (candidates.length === 0) return true;
  const top = candidates[0];
  const coverage = weightedCoverage(top.matchedTerms, terms);
  if (top.structuredTermCount > 0 && coverage >= ABSTAIN_STRUCT_COVERAGE) return false;
  if (coverage >= ABSTAIN_SOFT_COVERAGE && top.descriptionHits + top.bodyScore >= ABSTAIN_BODY_FLOOR) return false;
  return true;
}

function extractBodyText(rawText: string, page: ParsedPage): string {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const parts: string[] = [];
  for (const section of page.sections) {
    if (!SEARCHED_SECTIONS.has(section.name)) continue;
    if (section.first_line <= section.heading_line) continue;
    parts.push(lines.slice(section.first_line - 1, section.last_line).join('\n'));
  }
  return parts.join('\n');
}

function scorePage(loaded: LoadedPage, terms: QueryTerm[]): ScoredCandidate {
  const { page } = loaded;
  const title = page.frontmatter.title ?? page.slug;
  const aliases = page.frontmatter.aliases ?? [];
  const tags = page.frontmatter.tags ?? [];
  const description = page.frontmatter.description ?? '';

  const titleAlias = fieldText([title, ...aliases].join('\n'));
  const tagBasename = fieldText([...tags, page.slug].join('\n'));
  const descriptionField = fieldText(description);
  const body = fieldText(loaded.bodyText);
  const prefixTokens = tokenize([title, ...aliases, page.slug].join('\n').toLowerCase());

  let score = 0;
  let structuredTermCount = 0;
  let descriptionHits = 0;
  let bodyScore = 0;
  const matchedTerms: string[] = [];

  for (const term of terms) {
    const titleAliasCount = countTermIn(term, titleAlias);
    const tagBasenameCount = countTermIn(term, tagBasename);
    const descriptionCount = countTermIn(term, descriptionField);
    const bodyCount = countTermIn(term, body);
    const specificity = term.cjk ? CJK_SPECIFICITY : 1;

    let termScore =
      titleAliasCount * WEIGHT_TITLE_ALIAS * specificity +
      tagBasenameCount * WEIGHT_TAG_BASENAME * specificity +
      descriptionCount * WEIGHT_DESCRIPTION * specificity +
      bodyCount * WEIGHT_BODY * specificity;

    let prefixCount = 0;
    if (titleAliasCount === 0 && tagBasenameCount === 0) {
      prefixCount = prefixTokens.filter((token) => prefixMatches(term.raw, token)).length;
      termScore += prefixCount * WEIGHT_TITLE_ALIAS * PREFIX_MATCH_CREDIT;
    }

    if (termScore > 0) matchedTerms.push(term.raw);
    score += termScore;
    if (titleAliasCount + tagBasenameCount + prefixCount > 0) structuredTermCount += 1;
    descriptionHits += descriptionCount;
    bodyScore += bodyCount * WEIGHT_BODY * specificity;
  }

  return {
    loaded,
    title,
    score,
    structuredTermCount,
    descriptionHits,
    bodyScore,
    matchedTerms,
    updated: page.frontmatter.updated ?? '',
  };
}

function compareCandidates(a: ScoredCandidate, b: ScoredCandidate): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.updated !== b.updated) return compareStrings(b.updated, a.updated);
  return compareStrings(a.loaded.path, b.loaded.path);
}

function bestClaimSnippet(page: ParsedPage, terms: QueryTerm[]): string {
  let bestCount = 0;
  let bestText = '';
  for (const claim of page.claims) {
    const field = fieldText(claim.text);
    let distinctMatched = 0;
    for (const term of terms) {
      if (countTermIn(term, field) > 0) distinctMatched += 1;
    }
    if (distinctMatched > bestCount) {
      bestCount = distinctMatched;
      bestText = `${claim.text} ^${claim.id}`;
    }
  }
  return bestCount > 0 ? truncateUtf8(bestText, 500) : '';
}

function collectRelations(
  slug: string,
  page: ParsedPage,
  incomingBySlug: Map<string, Array<{ type: RelationType; page: string }>>,
): { relations: WikiSearchRelation[]; relations_more: number } {
  const all: WikiSearchRelation[] = [];
  for (const type of RELATION_KEYS) {
    for (const target of page.frontmatter[type] ?? []) {
      all.push({ type, page: target, direction: 'out' });
    }
  }
  const incoming = incomingBySlug.get(slug) ?? [];
  for (const rel of incoming) {
    all.push({ type: rel.type, page: rel.page, direction: 'in' });
  }
  if (all.length <= MAX_RELATIONS) {
    return { relations: all, relations_more: 0 };
  }
  return {
    relations: all.slice(0, MAX_RELATIONS),
    relations_more: all.length - MAX_RELATIONS,
  };
}

export async function searchWiki(
  root: string,
  config: Config,
  query: string,
  options: WikiSearchOptions = {},
): Promise<WikiSearchResult> {
  const limit = options.limit ?? 10;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25 || !Number.isSafeInteger(offset) || offset < 0) {
    invalidInvocation('Invalid search pagination.');
  }

  const pagePaths = await listPages(root);
  const loadedPages: LoadedPage[] = [];
  const snapshotHash = createHash('sha256');

  for (const pagePath of pagePaths) {
    const bytes = await readFile(join(root, pagePath));
    const version = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    snapshotHash.update(`${pagePath}\t${version}\n`);
    const text = bytes.toString('utf8');
    const page = parsePage(text, basename(pagePath));
    loadedPages.push({
      path: pagePath,
      version,
      page,
      bodyText: extractBodyText(text, page),
    });
  }

  const snapshot = `sha256:${snapshotHash.digest('hex')}`;
  if (options.snapshot !== undefined && options.snapshot !== snapshot) {
    throw new KnowleryError('stale_version', 'The wiki changed since the previous page.', 'Start again at offset 0.');
  }

  const terms = extractQueryTerms(query);
  const termStrings = terms.map((term) => term.raw);
  if (terms.length === 0) {
    return {
      scope: 'wiki',
      query,
      verdict: 'no_confident_match',
      terms: [],
      counts: { searched: loadedPages.length, matched: 0 },
      hits: [],
      offset,
      returned: 0,
      more: false,
      next: null,
      snapshot,
      warnings: [],
    };
  }

  const candidates = loadedPages
    .map((loaded) => scorePage(loaded, terms))
    .filter((candidate) => candidate.score > 0)
    .sort(compareCandidates);

  if (shouldAbstain(candidates, terms)) {
    return {
      scope: 'wiki',
      query,
      verdict: 'no_confident_match',
      terms: termStrings,
      counts: { searched: loadedPages.length, matched: 0 },
      hits: [],
      offset,
      returned: 0,
      more: false,
      next: null,
      snapshot,
      warnings: [],
    };
  }

  // Build incoming relation map across all pages.
  const incomingBySlug = new Map<string, Array<{ type: RelationType; page: string }>>();
  for (const { page } of loadedPages) {
    for (const type of RELATION_KEYS) {
      for (const target of page.frontmatter[type] ?? []) {
        const list = incomingBySlug.get(target);
        if (list) list.push({ type, page: page.slug });
        else incomingBySlug.set(target, [{ type, page: page.slug }]);
      }
    }
  }
  for (const list of incomingBySlug.values()) {
    list.sort((a, b) => compareStrings(a.type, b.type) || compareStrings(a.page, b.page));
  }

  const hits: WikiSearchHit[] = [];
  let bytes = 0;
  for (let i = offset; i < candidates.length && hits.length < limit; i++) {
    const candidate = candidates[i];
    const { loaded } = candidate;
    const { page } = loaded;
    const { relations, relations_more } = collectRelations(page.slug, page, incomingBySlug);
    const freshness = await pageFreshness(root, config, page);
    const hit: WikiSearchHit = {
      path: loaded.path,
      title: truncateUtf8(candidate.title, 200),
      type: page.frontmatter.type ?? null,
      status: page.frontmatter.status ?? null,
      freshness,
      version: loaded.version,
      description: truncateUtf8(page.frontmatter.description ?? '', 300),
      snippet: bestClaimSnippet(page, terms),
      relations,
      relations_more,
      score: Math.round(candidate.score * 100) / 100,
      matched: candidate.matchedTerms,
    };
    const size = Buffer.byteLength(JSON.stringify(hit), 'utf8') + 1;
    if (hits.length > 0 && bytes + size > PAGE_BYTE_BUDGET) break;
    hits.push(hit);
    bytes += size;
  }

  const more = offset + hits.length < candidates.length;
  return {
    scope: 'wiki',
    query,
    verdict: 'ok',
    terms: termStrings,
    counts: { searched: loadedPages.length, matched: candidates.length },
    hits,
    offset,
    returned: hits.length,
    more,
    next: more ? { offset: offset + hits.length, snapshot } : null,
    snapshot,
    warnings: [],
  };
}
