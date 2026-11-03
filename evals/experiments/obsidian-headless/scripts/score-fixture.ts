/**
 * Scores the public-fixture headless run (A, E, E_supp) against evals/golden/questions.yaml
 * with the repo's own metrics (evals/src/metrics.ts). Public-safe: fixture paths only.
 * Usage: npx tsx evals/experiments/obsidian-headless/scripts/score-fixture.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'yaml';
import { mean, recallAtK, reciprocalRank } from '../../../src/metrics';
import type { GroupRun } from './plan';

const dir = 'evals/experiments/obsidian-headless/fixture-results';
const golden = parse(readFileSync('evals/golden/questions.yaml', 'utf8')) as {
  id: string; category: string; expected: { must: string[] };
}[];
const out: Record<string, unknown> = {};
for (const g of ['A', 'E', 'Esupp']) {
  const runs = new Map<string, GroupRun>();
  for (const l of readFileSync(`${dir}/headless/${g}.jsonl`, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l); runs.set(r.qid, r); }
  const ans = golden.filter((q) => q.category !== 'unanswerable');
  const un = golden.filter((q) => q.category === 'unanswerable');
  const ranked = (q: { id: string }) => (runs.get(q.id)?.results ?? []).map((path) => ({ path, score: 0, tier: 'user' as const }));
  out[g] = {
    cases: golden.length,
    recallAt5: mean(ans.map((q) => recallAtK(q.expected.must, ranked(q), 5))),
    recallAt10: mean(ans.map((q) => recallAtK(q.expected.must, ranked(q), 10))),
    mrr: mean(ans.map((q) => reciprocalRank(q.expected.must, ranked(q)))),
    unanswerableAccuracy: mean(un.map((q) => (runs.get(q.id)?.abstained ? 1 : 0))),
    falseAbstainRate: mean(ans.map((q) => (runs.get(q.id)?.abstained ? 1 : 0))),
  };
}
writeFileSync(`${dir}/summary.json`, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
