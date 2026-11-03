/**
 * Frozen retrieval plan for the Obsidian-vs-headless benchmark.
 *
 * Everything in this file was fixed BEFORE any group was run against the golden set,
 * and must not be tuned against golden labels. Backends (Obsidian CLI for B/C,
 * plain files for E) only collect raw hit data; ranking for C and for E's supplement
 * is this one shared function, so the C-vs-E gap measures the backend, not the ranker.
 */
import { extractQueryTerms } from '../../../../src/core/query/tokenize';

/** Final candidate budget for every group. */
export const K = 10;
/** Max query terms used for per-term searches (C and E). */
export const MAX_TERMS = 6;
/** Reciprocal Rank Fusion constant (standard value, not tuned). */
export const RRF_K = 60;
/** Link expansion: neighbours of the top-N seeds are appended after scored hits. */
export const LINK_SEEDS = 3;
/** Field weights for the shared supplement ranker (fixed a priori, not tuned). */
export const W_META = 3; // term matches basename / title / aliases / tags
export const W_AND = 2; // file matches every term (all-terms query)

/** Shared query terms: A's own extractor, raw form, first MAX_TERMS. */
export function planTerms(question: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of extractQueryTerms(question)) {
    if (seen.has(t.raw)) continue;
    seen.add(t.raw);
    out.push(t.raw);
  }
  return out.slice(0, MAX_TERMS);
}

/** Raw hit data any backend must produce for one question. */
export interface BackendHits {
  terms: string[];
  /** Total markdown files in the corpus the backend sees. */
  corpusSize: number;
  /** term -> set of files whose content (incl. frontmatter) matches the term. */
  perTerm: Record<string, string[]>;
  /** files matching ALL terms in one query. */
  allTerms: string[];
  /** file -> number of terms matching basename/title/aliases/tags (metadata index). */
  metaHits: Record<string, number>;
  /** file -> linked neighbours (outlinks + backlinks), resolved paths. */
  neighbours: Record<string, string[]>;
}

export interface Ranked {
  path: string;
  score: number;
  via: string;
}

/**
 * Shared ranker: score = W_META*metaHits + W_AND*[all-terms] + sum(idf(term) for matched terms),
 * idf = ln(1 + N/df). Ties: path ascending. Then neighbours of the top LINK_SEEDS seeds are
 * appended (score 0, via=link) until K. Returns [] (abstain) when no file matches at least
 * min(2, terms.length) distinct terms and no file has a metadata hit.
 */
export function rankSupplement(h: BackendHits, k = K): Ranked[] {
  const n = Math.max(1, h.corpusSize);
  const score = new Map<string, number>();
  const covered = new Map<string, number>();
  for (const term of h.terms) {
    const files = h.perTerm[term] ?? [];
    if (files.length === 0) continue;
    const idf = Math.log(1 + n / files.length);
    for (const f of files) {
      score.set(f, (score.get(f) ?? 0) + idf);
      covered.set(f, (covered.get(f) ?? 0) + 1);
    }
  }
  for (const f of h.allTerms) score.set(f, (score.get(f) ?? 0) + W_AND);
  for (const [f, m] of Object.entries(h.metaHits)) if (m > 0) score.set(f, (score.get(f) ?? 0) + W_META * m);

  const need = Math.min(2, h.terms.length);
  const anyCovered = [...covered.values()].some((c) => c >= need);
  const anyMeta = Object.values(h.metaHits).some((m) => m > 0);
  if (!anyCovered && !anyMeta) return [];

  const ranked: Ranked[] = [...score.entries()]
    .map(([path, s]) => ({ path, score: s, via: 'score' }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const top = ranked.slice(0, k);
  if (top.length < k) {
    const have = new Set(top.map((r) => r.path));
    for (const seed of top.slice(0, LINK_SEEDS)) {
      for (const nb of (h.neighbours[seed.path] ?? []).slice().sort()) {
        if (top.length >= k) break;
        if (have.has(nb)) continue;
        have.add(nb);
        top.push({ path: nb, score: 0, via: 'link' });
      }
    }
  }
  return top;
}

/** Reciprocal Rank Fusion of ranked path lists; ties by first-list order then path. */
export function rrf(lists: string[][], k = K): string[] {
  const s = new Map<string, number>();
  for (const list of lists) list.forEach((p, i) => s.set(p, (s.get(p) ?? 0) + 1 / (RRF_K + i + 1)));
  return [...s.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, k).map(([p]) => p);
}

/** Per-group raw result record written by runners (private; contains real paths). */
export interface GroupRun {
  group: 'A' | 'B' | 'C' | 'D' | 'E';
  qid: string;
  terms: string[];
  /** Ordered candidate paths (<= K). For B this is Obsidian's returned order, NOT a relevance rank. */
  results: string[];
  /** True when the group returned no candidates / abstained. */
  abstained: boolean;
  /** Whether `results` order is a meaningful relevance ranking (false for B). */
  ranked: boolean;
  /** Total hits before truncation, when the backend reports it. */
  totalHits?: number;
  cliCalls: number;
  queries: number;
  latencyMs: number;
  cold: boolean;
  commands: string[];
  error?: string;
  /** Free-form backend extras (e.g. A's evidence-via-source paths). */
  extra?: Record<string, unknown>;
}
