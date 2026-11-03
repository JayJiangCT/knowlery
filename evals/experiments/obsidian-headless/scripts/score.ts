/**
 * Scores groups A–E against the frozen golden set and writes:
 *   <private>/scored.local.json   — per-question results with real paths (never committed)
 *   <private>/pseudonyms.local.json — real path -> P#### mapping (never committed)
 *   <out>/results.json (pass1)    — scrubbed: question ids, categories, pseudonymous page ids,
 *                                   page classes, ranks, metrics. No question text, no paths.
 *
 * Usage: npx tsx scripts/score.ts <privateDir> <snapshotRoot> <outDir> [pass]
 * D is computed here (RRF of A and C) — it is not a separate run.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { scanVault } from '../../../../src/core/query/scan';
import { K, rrf, type GroupRun } from './plan';

interface Golden {
  id: string;
  category: string;
  must_slots: string[][];
  nice: string[];
  unanswerable: boolean;
  confidence: string;
  main_metric: boolean;
  owner_reviewed: boolean;
}

const [privateDir, snapshotRoot, outDir, pass = 'pass1'] = process.argv.slice(2);
const golden: Golden[] = JSON.parse(readFileSync(join(privateDir, 'golden.frozen.json'), 'utf8'));

function load(file: string): Map<string, GroupRun> {
  const m = new Map<string, GroupRun>();
  if (!existsSync(file)) return m;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as GroupRun;
    m.set(r.qid, r);
  }
  return m;
}
const runs: Record<string, Map<string, GroupRun>> = {
  A: load(join(privateDir, `runs/headless/A.${pass}.jsonl`)),
  B: load(join(privateDir, `runs/obsidian/B.${pass}.jsonl`)),
  C: load(join(privateDir, `runs/obsidian/C.${pass}.jsonl`)),
  E: load(join(privateDir, `runs/headless/E.${pass}.jsonl`)),
  Esupp: load(join(privateDir, `runs/headless/Esupp.pass1.jsonl`)),
};
// D = RRF(A, C), fixed in plan.ts; latency/calls are the sum (sequential execution assumed).
runs.D = new Map();
for (const g of golden) {
  const a = runs.A.get(g.id), c = runs.C.get(g.id);
  if (!a || !c) continue;
  const results = rrf([a.results, c.results]);
  runs.D.set(g.id, {
    group: 'D', qid: g.id, terms: c.terms, results, abstained: a.abstained && c.abstained, ranked: true,
    cliCalls: a.cliCalls + c.cliCalls, queries: a.queries + c.queries, latencyMs: a.latencyMs + c.latencyMs,
    cold: a.cold, commands: [], extra: { dedupe: 1 - new Set([...a.results, ...c.results]).size / Math.max(1, a.results.length + c.results.length) },
  });
}
// Post-hoc sensitivity variants (see run-a-terms.ts): At = A with subject terms;
// Dt = RRF(At, C); Et = RRF(At, Esupp). Same fusion rule as D/E.
runs.At = load(join(privateDir, 'runs/headless/A_terms.pass1.jsonl'));
runs.Dt = new Map();
runs.Et = new Map();
for (const g of golden) {
  const a = runs.At.get(g.id), c = runs.C.get(g.id), s = runs.Esupp.get(g.id);
  if (!a || !c || !s) continue;
  const mk = (group: 'D' | 'E', other: GroupRun): GroupRun => ({
    group, qid: g.id, terms: a.terms, results: rrf([a.results, other.results]), abstained: a.abstained && other.abstained, ranked: true,
    cliCalls: a.cliCalls + other.cliCalls, queries: a.queries + other.queries, latencyMs: a.latencyMs + other.latencyMs, cold: true, commands: [],
    extra: { dedupe: 1 - new Set([...a.results, ...other.results]).size / Math.max(1, a.results.length + other.results.length) },
  });
  runs.Dt.set(g.id, mk('D', c));
  runs.Et.set(g.id, mk('E', s));
}
const GROUPS = ['A', 'B', 'C', 'D', 'E', 'Esupp', 'At', 'Dt', 'Et'].filter((G) => runs[G].size > 0);

// Pages 1.x cannot see (frontmatter parse failure) — scanned in this fresh process, each file parsed once.
const scanned = new Set(scanVault(snapshotRoot).pages.map((p) => p.path));

const slotHit = (slot: string[], top: string[]) => slot.some((p) => top.includes(p));
const recall = (g: Golden, res: string[], k: number) =>
  g.must_slots.length === 0 ? null : g.must_slots.filter((s) => slotHit(s, res.slice(0, k))).length / g.must_slots.length;
function rr(g: Golden, res: string[]): number {
  const want = new Set(g.must_slots.flat());
  const i = res.findIndex((p) => want.has(p));
  return i < 0 ? 0 : 1 / (i + 1);
}
function firstRanks(g: Golden, res: string[]): (number | null)[] {
  return g.must_slots.map((s) => {
    const i = res.findIndex((p) => s.includes(p));
    return i < 0 ? null : i + 1;
  });
}

// Pseudonyms: stable order = sorted real paths seen anywhere.
const allPaths = new Set<string>();
for (const g of golden) { g.must_slots.flat().forEach((p) => allPaths.add(p)); g.nice.forEach((p) => allPaths.add(p)); }
for (const m of Object.values(runs)) for (const r of m.values()) r.results.forEach((p) => allPaths.add(p));
const sorted = [...allPaths].sort();
const pseudo = new Map(sorted.map((p, i) => [p, `P${String(i + 1).padStart(4, '0')}`]));
function pageClass(p: string): string {
  const top = p.split('/')[0];
  if (['entities', 'concepts', 'comparisons', 'queries'].includes(top)) return `compiled:${top}`;
  if (top === 'Library') return 'bundle';
  if (top === 'teams') return 'reference:team-kb';
  if (!p.includes('/')) return 'root';
  return 'user-note';
}

const perQuestion: any[] = [];
const local: any[] = [];
for (const g of golden) {
  const row: any = { id: g.id, category: g.category, confidence: g.confidence, unanswerable: g.unanswerable, main_metric: g.main_metric, must_slots: g.must_slots.length, groups: {} };
  const lrow: any = { ...g, groups: {} };
  for (const G of GROUPS) {
    const r = runs[G].get(g.id);
    if (!r) { row.groups[G] = { missing: true }; continue; }
    const res = r.results.slice(0, K);
    row.groups[G] = {
      abstained: r.abstained,
      recall5: recall(g, res, 5), recall10: recall(g, res, 10),
      rr: r.ranked ? (g.unanswerable ? null : rr(g, res)) : null,
      mustFirstRanks: firstRanks(g, res),
      niceIn10: g.nice.filter((p) => res.includes(p)).length,
      results: res.map((p) => ({ id: pseudo.get(p), cls: pageClass(p), invisibleTo1x: !scanned.has(p) })),
      n: res.length, totalHits: r.totalHits ?? null, cliCalls: r.cliCalls, queries: r.queries, latencyMs: Math.round(r.latencyMs),
      error: r.error ? 'error' : undefined,
    };
    lrow.groups[G] = { results: res, abstained: r.abstained, error: r.error };
  }
  perQuestion.push(row);
  local.push(lrow);
}

function pct(xs: number[], q: number) { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]; }
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
function aggregate(filter: (row: any) => boolean) {
  const out: any = {};
  for (const G of GROUPS) {
    const rows = perQuestion.filter(filter).filter((r) => !r.groups[G]?.missing);
    const ans = rows.filter((r) => !r.unanswerable);
    const un = rows.filter((r) => r.unanswerable);
    out[G] = {
      n: rows.length,
      recall5: avg(ans.map((r) => r.groups[G].recall5)),
      recall10: avg(ans.map((r) => r.groups[G].recall10)),
      mrr: G === 'B' ? null : avg(ans.map((r) => r.groups[G].rr)),
      fullMustCoverage10: avg(ans.map((r) => (r.groups[G].recall10 === 1 ? 1 : 0))),
      noAnswerAccuracy: un.length ? avg(un.map((r) => (r.groups[G].abstained ? 1 : 0))) : null,
      falseAbstainRate: ans.length ? avg(ans.map((r) => (r.groups[G].abstained ? 1 : 0))) : null,
      latencyMedianMs: pct(rows.map((r) => r.groups[G].latencyMs), 0.5),
      latencyP95Ms: pct(rows.map((r) => r.groups[G].latencyMs), 0.95),
      cliCallsMean: avg(rows.map((r) => r.groups[G].cliCalls)),
      queriesMean: avg(rows.map((r) => r.groups[G].queries)),
      candidatesMean: avg(rows.map((r) => r.groups[G].n)),
    };
  }
  return out;
}
const categories = [...new Set(golden.map((g) => g.category))];
const summary = {
  main: aggregate((r) => r.main_metric),
  highConfidenceOnly: aggregate((r) => r.main_metric && r.confidence === 'high'),
  perCategory: Object.fromEntries(categories.map((c) => [c, aggregate((r) => r.main_metric && r.category === c)])),
};

// Unique correct must-slot hits in top-10 per group (main set, answerable).
const uniq: any = {};
for (const G of ['A', 'B', 'C', 'E']) uniq[G] = 0;
const obsidianOnly: any[] = [];
for (const g of golden.filter((x) => x.main_metric && !x.unanswerable)) {
  g.must_slots.forEach((slot, si) => {
    const hit = (G: string) => { const r = runs[G].get(g.id); return !!r && slotHit(slot, r.results.slice(0, K)); };
    const hits = ['A', 'B', 'C', 'E'].filter(hit);
    if (hits.length === 1) uniq[hits[0]]++;
    if ((hit('B') || hit('C')) && !hit('A') && !hit('E')) obsidianOnly.push({ id: g.id, slot: si, invisibleTo1x: slot.every((p) => !scanned.has(p)) });
  });
}
const dd = [...runs.D.values()].map((r) => (r.extra as any).dedupe as number);

const results = {
  schema: 'knowlery-retrieval-benchmark/obsidian-headless@1',
  pass, k: K, generatedAt: new Date().toISOString(),
  goldenOwnerReviewed: golden.every((g) => g.owner_reviewed),
  questions: golden.length, mainMetricQuestions: golden.filter((g) => g.main_metric).length,
  summary, uniqueCorrectSlots: uniq, obsidianOnlySlots: obsidianOnly,
  dDedupeRateMean: avg(dd), perQuestion,
};
writeFileSync(join(outDir, pass === 'pass1' ? 'results.json' : `results.${pass}.json`), JSON.stringify(results, null, 1));
writeFileSync(join(privateDir, `scored.${pass}.local.json`), JSON.stringify(local, null, 1));
writeFileSync(join(privateDir, 'pseudonyms.local.json'), JSON.stringify(Object.fromEntries(pseudo), null, 1));
console.log(JSON.stringify(summary.main, null, 1));
