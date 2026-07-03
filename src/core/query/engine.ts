import type { FieldText, PageTier, ScannedBundleEntry, ScannedPage, VaultSnapshot } from './scan';
import { extractQueryTerms, prefixMatches, type QueryTerm } from './tokenize';

/**
 * Deterministic retrieval engine (spec f2, §5.1). Pure scoring and ranking over a
 * VaultSnapshot — no `obsidian` imports, no I/O, no LLM. Shared verbatim by the shipped
 * CLI script, plugin-side callers, and the eval harness.
 *
 * Weight rationale (by mechanism, not by benchmark case — spec f2, R1):
 * - title/aliases (x4): the page author's own one-line statement of what the page IS.
 * - tags/basename (x3): curated classification; almost as intentional as the title.
 * - description (x2): a summary sentence — informative but wordier, so weaker per hit.
 * - body (x1): incidental mentions; high volume, low per-hit specificity.
 * - CJK chunks count double: a multi-character CJK phrase is a far more specific match
 *   than a single latin token, and CJK gets no morphological-variant help.
 * - Tier bonuses are multiplicative nudges (agent x1.15, bundle x1.10), not gates: the
 *   baseline showed hard tier ordering buries bundle and user-note answers entirely.
 */

const WEIGHT_TITLE_ALIAS = 4;
const WEIGHT_TAG_BASENAME = 3;
const WEIGHT_DESCRIPTION = 2;
const WEIGHT_BODY = 1;
const PREFIX_MATCH_CREDIT = 0.5; // fraction of the field weight an abbreviation match earns
const CJK_SPECIFICITY = 2;
const TIER_FACTOR: Record<PageTier, number> = { agent: 1.15, bundle: 1.1, user: 1 };
const ABSTAIN_BODY_FLOOR = 2;

export interface QueryCandidate {
  path: string;
  score: number;
  tier: PageTier;
  type?: string;
  title: string;
  description?: string;
  /** Source-note paths whose own matches boosted this page (spec f2, §5.1 step 4). */
  evidence: string[];
  matchedTerms: string[];
}

export interface QueryResult {
  verdict: 'ok' | 'no-confident-match';
  terms: string[];
  candidates: QueryCandidate[];
}

export function runQuery(question: string, snapshot: VaultSnapshot, k: number): QueryResult {
  const terms = extractQueryTerms(question);
  if (terms.length === 0) {
    return { verdict: 'no-confident-match', terms: [], candidates: [] };
  }

  const bundlePaths = new Set(snapshot.bundleEntries.map((entry) => entry.path));
  const pageByPath = new Map(snapshot.pages.map((page) => [page.path, page]));

  const scored: InternalCandidate[] = [];
  for (const page of snapshot.pages) {
    // A bundle page reachable on disk is represented by its richer bundle-index entry.
    if (bundlePaths.has(page.path)) continue;
    scored.push(scorePage(page, terms));
  }
  for (const entry of snapshot.bundleEntries) {
    scored.push(scoreBundleEntry(entry, terms, pageByPath.get(entry.path)));
  }

  applySourceGraphBoost(scored, pageByPath);

  const candidates = scored
    .filter((candidate) => candidate.score > 0)
    .sort(compareCandidates)
    .slice(0, k);

  if (shouldAbstain(candidates)) {
    return { verdict: 'no-confident-match', terms: terms.map((term) => term.raw), candidates: [] };
  }

  return {
    verdict: 'ok',
    terms: terms.map((term) => term.raw),
    candidates: candidates.map(toPublicCandidate),
  };
}

interface InternalCandidate extends QueryCandidate {
  structuredHits: number;
  descriptionHits: number;
  bodyScore: number;
  reviewed: boolean;
  updated: string;
  sources: string[];
}

function scorePage(page: ScannedPage, terms: QueryTerm[]): InternalCandidate {
  const base = scoreFields(terms, {
    titleAlias: page.titleAlias,
    tagBasename: page.tagBasename,
    description: page.descriptionField,
    body: page.body,
    prefixTokens: page.prefixTokens,
  });
  return {
    path: page.path,
    score: base.score * TIER_FACTOR[page.tier],
    tier: page.tier,
    type: page.type,
    title: page.title,
    description: page.description,
    evidence: [],
    matchedTerms: base.matchedTerms,
    structuredHits: base.structuredHits,
    descriptionHits: base.descriptionHits,
    bodyScore: base.bodyScore,
    reviewed: page.status === 'reviewed',
    updated: page.updated ?? '',
    sources: page.sources,
  };
}

function scoreBundleEntry(
  entry: ScannedBundleEntry,
  terms: QueryTerm[],
  diskPage: ScannedPage | undefined,
): InternalCandidate {
  const base = scoreFields(terms, {
    titleAlias: entry.titleAlias,
    tagBasename: entry.tagBasename,
    description: entry.descriptionField,
    body: diskPage?.body,
    prefixTokens: entry.prefixTokens,
  });
  return {
    path: entry.path,
    score: base.score * TIER_FACTOR.bundle,
    tier: 'bundle',
    type: entry.type,
    title: entry.title,
    description: entry.description,
    evidence: [],
    matchedTerms: base.matchedTerms,
    structuredHits: base.structuredHits,
    descriptionHits: base.descriptionHits,
    bodyScore: base.bodyScore,
    reviewed: false,
    updated: '',
    sources: [],
  };
}

interface FieldGroup {
  titleAlias: FieldText;
  tagBasename: FieldText;
  description: FieldText;
  body?: FieldText;
  prefixTokens: string[];
}

interface FieldScore {
  score: number;
  structuredHits: number;
  descriptionHits: number;
  bodyScore: number;
  matchedTerms: string[];
}

function scoreFields(terms: QueryTerm[], fields: FieldGroup): FieldScore {
  let score = 0;
  let structuredHits = 0;
  let descriptionHits = 0;
  let bodyScore = 0;
  const matchedTerms: string[] = [];

  for (const term of terms) {
    const titleAliasCount = countTermIn(term, fields.titleAlias);
    const tagBasenameCount = countTermIn(term, fields.tagBasename);
    const descriptionCount = countTermIn(term, fields.description);
    const bodyCount = fields.body ? countTermIn(term, fields.body) : 0;
    const specificity = term.cjk ? CJK_SPECIFICITY : 1;

    let termScore =
      titleAliasCount * WEIGHT_TITLE_ALIAS * specificity +
      tagBasenameCount * WEIGHT_TAG_BASENAME * specificity +
      descriptionCount * WEIGHT_DESCRIPTION * specificity +
      bodyCount * WEIGHT_BODY * specificity;

    let prefixCount = 0;
    if (titleAliasCount === 0 && tagBasenameCount === 0) {
      prefixCount = fields.prefixTokens.filter((token) => prefixMatches(term.raw, token)).length;
      termScore += prefixCount * WEIGHT_TITLE_ALIAS * PREFIX_MATCH_CREDIT;
    }

    if (termScore > 0) matchedTerms.push(term.raw);
    score += termScore;
    structuredHits += titleAliasCount + tagBasenameCount + prefixCount;
    descriptionHits += descriptionCount;
    bodyScore += bodyCount * WEIGHT_BODY * specificity;
  }

  return { score, structuredHits, descriptionHits, bodyScore, matchedTerms };
}

function countTermIn(term: QueryTerm, field: FieldText): number {
  if (term.cjk) return countSubstring(field.lower, term.raw);
  let count = 0;
  for (const variant of term.variants) {
    count += field.counts.get(variant) ?? 0;
  }
  return count;
}

/**
 * Evidence found in a raw note credits the compiled page that cites it in `sources`
 * (spec f2, §5.1 step 4). This is what lets a Chinese question reach the English page
 * compiled from a Chinese source note.
 */
function applySourceGraphBoost(
  scored: InternalCandidate[],
  pageByPath: Map<string, ScannedPage>,
): void {
  const scoreByPath = new Map(scored.map((candidate) => [candidate.path, candidate.score]));
  for (const candidate of scored) {
    if (candidate.tier !== 'agent') continue;
    for (const source of candidate.sources) {
      const normalized = source.split('\\').join('/');
      if (!pageByPath.has(normalized)) continue;
      const sourceScore = scoreByPath.get(normalized) ?? 0;
      if (sourceScore <= 0) continue;
      candidate.score += sourceScore * 0.5;
      candidate.evidence.push(normalized);
    }
  }
}

function compareCandidates(a: InternalCandidate, b: InternalCandidate): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.reviewed !== b.reviewed) return a.reviewed ? -1 : 1;
  if (a.updated !== b.updated) return b.updated.localeCompare(a.updated);
  return a.path.localeCompare(b.path);
}

/**
 * Abstention (spec f2, §5.1 step 6): if nothing matched any structured field or
 * description anywhere, and the best body-only score is below the floor, the honest
 * answer is "this vault has no confident match" — not a list of noise.
 */
function shouldAbstain(candidates: InternalCandidate[]): boolean {
  if (candidates.length === 0) return true;
  const anyStructured = candidates.some(
    (candidate) => candidate.structuredHits > 0 || candidate.descriptionHits > 0 || candidate.evidence.length > 0,
  );
  if (anyStructured) return false;
  const topBodyScore = Math.max(...candidates.map((candidate) => candidate.bodyScore));
  return topBodyScore < ABSTAIN_BODY_FLOOR;
}

function toPublicCandidate(candidate: InternalCandidate): QueryCandidate {
  return {
    path: candidate.path,
    score: Math.round(candidate.score * 100) / 100,
    tier: candidate.tier,
    type: candidate.type,
    title: candidate.title,
    description: candidate.description,
    evidence: candidate.evidence,
    matchedTerms: candidate.matchedTerms,
  };
}

function countSubstring(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = text.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = text.indexOf(needle, index + needle.length);
  }
  return count;
}
