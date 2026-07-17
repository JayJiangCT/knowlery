import matter from 'gray-matter';
import { runQuery } from '../../../src/core/query/engine';
import type { VaultSnapshot } from '../../../src/core/query/scan';

/**
 * The cook-quality checker (spec 1.3 f2, §4.1): pure functions over a loaded
 * case — judgment stays with the agents that cook; the judging of outcomes is
 * this code. No I/O, no clock, no LLM: same inputs, same report.
 *
 * Ratio metrics are baseline-compared with tolerance; boolean invariants are
 * hard floors (§4.1 as amended at spec review).
 */

export interface LoadedCookCase {
  name: string;
  /** scanVault over the cooked workspace. */
  snapshot: VaultSnapshot;
  /** Every file in the cooked workspace, path → content (markdown + SCHEMA.md). */
  files: Map<string, string>;
  /** The frozen raw material, relative path → content. */
  material: Map<string, string>;
  /** From case.yaml. */
  expectations: { mustNotCompile: string[] };
}

export interface CookFinding {
  invariant: string;
  page?: string;
  detail: string;
}

export interface CookCaseReport {
  case: string;
  metrics: {
    citationCoverage: number;
    retrievability: number;
    frontmatterCompleteness: number;
    taxonomyCompliance: number;
    connectivity: number;
  };
  booleans: {
    materialUntouched: boolean;
    decoysRespected: boolean;
    citationsResolve: boolean;
  };
  findings: CookFinding[];
  counts: { compiled: number };
}

const RETRIEVABILITY_K = 5; // pinned at spec review (§4.1.2)

/** Minimum frontmatter per type — the health-check core plus description (§4.1.3). */
const MIN_FRONTMATTER: Record<string, string[]> = {
  entity: ['type', 'created'],
  concept: ['type', 'created'],
  comparison: ['type', 'items', 'created'],
  query: ['type', 'status', 'created'],
};

export function checkCookCase(loaded: LoadedCookCase): CookCaseReport {
  const findings: CookFinding[] = [];
  const compiled = loaded.snapshot.pages.filter((page) => page.tier === 'agent');
  const compiledPaths = new Set(compiled.map((page) => page.path));

  // --- 1. citation coverage (ratio) + citations resolve (hard) ---------------
  let withSources = 0;
  let allResolve = true;
  for (const page of compiled) {
    if (page.sources.length > 0) withSources += 1;
    else findings.push({ invariant: 'citation-coverage', page: page.path, detail: 'no sources: frontmatter — invisible to staleness' });
    for (const raw of page.sources) {
      const source = raw.split('\\').join('/');
      if (!loaded.files.has(source) && !compiledPaths.has(source)) {
        allResolve = false;
        findings.push({ invariant: 'citations-resolve', page: page.path, detail: `dangling source: ${source}` });
      }
    }
  }

  // --- 2. retrievability under competition (ratio; §4.1.2 pinned) -----------
  let retrievable = 0;
  for (const page of compiled) {
    const probes = [page.title, ...(page.description ? [page.description] : [])];
    const hit = probes.some((probe) => {
      const result = runQuery(probe, loaded.snapshot, RETRIEVABILITY_K);
      return result.verdict === 'ok' && result.candidates.some((candidate) => candidate.path === page.path);
    });
    if (hit) retrievable += 1;
    else findings.push({ invariant: 'retrievability', page: page.path, detail: `not in top-${RETRIEVABILITY_K} for its own title/description probes` });
  }

  // --- 3. frontmatter completeness (ratio) -----------------------------------
  let complete = 0;
  for (const page of compiled) {
    const raw = loaded.files.get(page.path);
    const fm = raw ? (matter(raw).data as Record<string, unknown>) : {};
    const type = typeof fm.type === 'string' ? fm.type.toLowerCase() : undefined;
    const required = (type && MIN_FRONTMATTER[type]) || ['type', 'created'];
    const missing = required.filter((field) => fm[field] === undefined);
    if (fm.description === undefined) missing.push('description');
    if (missing.length === 0) complete += 1;
    else findings.push({ invariant: 'frontmatter', page: page.path, detail: `missing: ${missing.join(', ')}` });
  }

  // --- 4. taxonomy discipline, static predicate (ratio; §4.1.4 rewritten) ---
  const schema = loaded.files.get('SCHEMA.md') ?? '';
  const schemaTokens = extractTaxonomyTokens(schema);
  const used = new Set<string>();
  for (const page of compiled) {
    const raw = loaded.files.get(page.path);
    const fm = raw ? (matter(raw).data as Record<string, unknown>) : {};
    for (const tag of Array.isArray(fm.tags) ? fm.tags : []) {
      if (typeof tag === 'string') used.add(tag);
    }
    if (typeof fm.domain === 'string') used.add(fm.domain);
  }
  let inSchema = 0;
  for (const token of used) {
    if (schemaTokens.has(token.toLowerCase())) inSchema += 1;
    else findings.push({ invariant: 'taxonomy', detail: `"${token}" used by compiled pages but absent from SCHEMA.md` });
  }
  // Synonym-shaped near-duplicates across the used set (findings only).
  const normalized = new Map<string, string>();
  for (const token of used) {
    const norm = token.toLowerCase().split('-').join('').replace(/s$/, '');
    const prior = normalized.get(norm);
    if (prior && prior !== token) {
      findings.push({ invariant: 'taxonomy-near-duplicate', detail: `"${prior}" vs "${token}"` });
    }
    normalized.set(norm, token);
  }

  // --- 5. wiki connectivity (ratio) ------------------------------------------
  const titleIndex = new Map<string, string>();
  for (const page of compiled) {
    titleIndex.set(page.title.toLowerCase(), page.path);
    const base = page.path.split('/').pop()!.replace(/\.md$/, '').toLowerCase();
    titleIndex.set(base, page.path);
  }
  let connected = 0;
  for (const page of compiled) {
    const body = loaded.files.get(page.path) ?? '';
    const links = [...body.matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].trim().toLowerCase());
    const linksToCompiled = links.some((link) => {
      const target = titleIndex.get(link) ?? titleIndex.get(link.replace(/\.md$/, ''));
      return target !== undefined && target !== page.path;
    });
    if (linksToCompiled) connected += 1;
    else findings.push({ invariant: 'connectivity', page: page.path, detail: 'no wikilink to another compiled page' });
  }

  // --- 6. user material untouched (hard) --------------------------------------
  let materialUntouched = true;
  for (const [path, content] of loaded.material) {
    if (loaded.files.get(path) !== content) {
      materialUntouched = false;
      findings.push({ invariant: 'material-untouched', detail: `${path} differs from the frozen material (cook must never rewrite notes)` });
    }
  }

  // --- 7. restraint: must_not_compile decoys (hard) ---------------------------
  let decoysRespected = true;
  for (const decoy of loaded.expectations.mustNotCompile) {
    const citedBy = compiled.filter((page) => page.sources.some((source) => source.split('\\').join('/') === decoy));
    if (citedBy.length > 0) {
      decoysRespected = false;
      findings.push({ invariant: 'restraint', detail: `decoy ${decoy} was compiled (cited by ${citedBy.map((page) => page.path).join(', ')})` });
    }
  }

  const total = compiled.length || 1;
  return {
    case: loaded.name,
    metrics: {
      citationCoverage: withSources / total,
      retrievability: retrievable / total,
      frontmatterCompleteness: complete / total,
      taxonomyCompliance: used.size === 0 ? 1 : inSchema / used.size,
      connectivity: connected / total,
    },
    booleans: { materialUntouched, decoysRespected, citationsResolve: allResolve },
    findings,
    counts: { compiled: compiled.length },
  };
}

/**
 * Tokens from SCHEMA.md's taxonomy sections: list items and inline code under
 * headings containing "taxonomy" (case-insensitive) — deliberately liberal;
 * the predicate is "declared somewhere in the taxonomy", not a format check.
 */
export function extractTaxonomyTokens(schema: string): Set<string> {
  const tokens = new Set<string>();
  let inTaxonomy = false;
  for (const line of schema.split('\n')) {
    const heading = line.match(/^#+\s+(.*)/);
    if (heading) {
      inTaxonomy = /taxonomy|domains/i.test(heading[1]);
      continue;
    }
    if (!inTaxonomy) continue;
    for (const code of line.matchAll(/`([^`]+)`/g)) tokens.add(code[1].toLowerCase());
    const item = line.match(/^\s*[-*]\s+([\w][\w/-]*)/);
    if (item) tokens.add(item[1].toLowerCase());
  }
  return tokens;
}
