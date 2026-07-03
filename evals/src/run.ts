import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { loadFixtureVault } from './vault';
import { baselineRetriever } from './baseline-retriever';
import { knowleryQueryRetriever } from './retrievers/knowlery-query';
import { mean, recallAtK, reciprocalRank } from './metrics';
import type {
  BaselineFile,
  CaseResult,
  EvalAggregate,
  EvalReport,
  GoldenCase,
  Retriever,
} from './types';
import { GOLDEN_CATEGORIES } from './types';

const K = 10;
const DEFAULT_TOLERANCE = 0.01;

/**
 * F2 acceptance thresholds (spec f2, §7 criterion 2). The engine retriever must clear
 * every one of these, and additionally must not fall below the frozen baseline on any
 * category's recall@10 or MRR.
 */
const F2_THRESHOLDS = {
  aggregateRecallAt10: 0.85,
  aggregateMrr: 0.53,
  aliasRecallAt10: 0.625,
  bilingualRecallAt10: 0.5,
  bundleRecallAt5: 0.667,
};

const EVALS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GOLDEN_PATH = join(EVALS_ROOT, 'golden', 'questions.yaml');
const FIXTURE_ROOT = join(EVALS_ROOT, 'fixtures', 'vault');
const REPORTS_DIR = join(EVALS_ROOT, 'reports');
const BASELINE_PATH = join(REPORTS_DIR, 'baseline.json');

function main(): void {
  const args = new Set(process.argv.slice(2));

  const cases = loadGoldenSet();
  const vault = loadFixtureVault(FIXTURE_ROOT);

  const baselineReport = runEval(baselineRetriever, cases, vault);
  const engineReport = runEval(knowleryQueryRetriever, cases, vault);

  printReport(baselineReport);
  printReport(engineReport);
  writeRunReport(baselineReport);
  writeRunReport(engineReport);

  if (args.has('--freeze')) freezeBaseline(baselineReport);
  if (args.has('--assert-baseline')) {
    assertBaseline(baselineReport);
    assertF2Thresholds(engineReport);
  }
}

function loadGoldenSet(): GoldenCase[] {
  const cases = parseYaml(readFileSync(GOLDEN_PATH, 'utf8')) as GoldenCase[];
  const seen = new Set<string>();
  for (const goldenCase of cases) {
    if (seen.has(goldenCase.id)) throw new Error(`Duplicate golden case id: ${goldenCase.id}`);
    seen.add(goldenCase.id);
    if (!GOLDEN_CATEGORIES.includes(goldenCase.category)) {
      throw new Error(`${goldenCase.id}: unknown category "${goldenCase.category}"`);
    }
    if (goldenCase.category === 'unanswerable' && goldenCase.expected.must.length > 0) {
      throw new Error(`${goldenCase.id}: unanswerable cases must declare an empty "must" list`);
    }
    if (goldenCase.category !== 'unanswerable' && goldenCase.expected.must.length === 0) {
      throw new Error(`${goldenCase.id}: non-unanswerable cases need at least one "must" page`);
    }
  }
  return cases;
}

function runEval(retriever: Retriever, cases: GoldenCase[], vault: ReturnType<typeof loadFixtureVault>): EvalReport {
  const missingPaths = collectMissingExpectedPaths(cases, vault);
  if (missingPaths.length > 0) {
    throw new Error(`Golden set references paths missing from the fixture vault:\n${missingPaths.join('\n')}`);
  }

  const results: CaseResult[] = cases.map((goldenCase) => {
    const ranked = retriever.retrieve(goldenCase.question, vault, K);
    if (goldenCase.category === 'unanswerable') {
      // Correct iff nothing clears the score floor (the retriever only returns floor-clearing pages).
      return {
        id: goldenCase.id,
        category: goldenCase.category,
        question: goldenCase.question,
        top: ranked.map((page) => page.path),
        recallAt5: null,
        recallAt10: null,
        reciprocalRank: null,
        unanswerableCorrect: ranked.length === 0,
        missedMust: [],
      };
    }
    const must = goldenCase.expected.must;
    const top = ranked.map((page) => page.path);
    return {
      id: goldenCase.id,
      category: goldenCase.category,
      question: goldenCase.question,
      top,
      recallAt5: recallAtK(must, ranked, 5),
      recallAt10: recallAtK(must, ranked, 10),
      reciprocalRank: reciprocalRank(must, ranked),
      unanswerableCorrect: null,
      missedMust: must.filter((path) => !top.includes(path)),
    };
  });

  const perCategory: Record<string, EvalAggregate> = {};
  for (const category of GOLDEN_CATEGORIES) {
    const inCategory = results.filter((result) => result.category === category);
    if (inCategory.length > 0) perCategory[category] = aggregate(inCategory);
  }

  return {
    retriever: retriever.name,
    generatedAt: new Date().toISOString(),
    k: K,
    aggregate: aggregate(results),
    perCategory,
    perQuestion: results,
  };
}

function collectMissingExpectedPaths(cases: GoldenCase[], vault: ReturnType<typeof loadFixtureVault>): string[] {
  const known = new Set(vault.pages.map((page) => page.path));
  for (const bundle of vault.bundles) for (const entry of bundle.entries) known.add(entry.path);
  const missing: string[] = [];
  for (const goldenCase of cases) {
    for (const path of [...goldenCase.expected.must, ...(goldenCase.expected.nice ?? [])]) {
      if (!known.has(path)) missing.push(`${goldenCase.id}: ${path}`);
    }
  }
  return missing;
}

function aggregate(results: CaseResult[]): EvalAggregate {
  const scored = results.filter((result) => result.recallAt10 !== null);
  const unanswerable = results.filter((result) => result.unanswerableCorrect !== null);
  return {
    cases: results.length,
    recallAt5: mean(scored.map((result) => result.recallAt5 as number)),
    recallAt10: mean(scored.map((result) => result.recallAt10 as number)),
    mrr: mean(scored.map((result) => result.reciprocalRank as number)),
    unanswerableAccuracy: unanswerable.length > 0
      ? unanswerable.filter((result) => result.unanswerableCorrect).length / unanswerable.length
      : null,
  };
}

function printReport(report: EvalReport): void {
  const rows = [
    ...Object.entries(report.perCategory).map(([category, agg]) => formatRow(category, agg)),
    formatRow('ALL', report.aggregate),
  ];
  const header = formatCells(['category', 'cases', 'recall@5', 'recall@10', 'MRR', 'unanswerable']);
  console.log(`\nRetriever: ${report.retriever} (k=${report.k})\n`);
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const row of rows) console.log(row);

  const misses = report.perQuestion.filter(
    (result) => (result.missedMust.length > 0) || result.unanswerableCorrect === false,
  );
  if (misses.length > 0) {
    console.log(`\nMisses (${misses.length}):`);
    for (const miss of misses) {
      const detail = miss.unanswerableCorrect === false
        ? `returned ${miss.top.length} result(s) for an unanswerable question`
        : `missed: ${miss.missedMust.join(', ')}`;
      console.log(`  [${miss.category}] ${miss.id} — ${detail}`);
    }
  }
  console.log('');
}

function formatRow(label: string, agg: EvalAggregate): string {
  return formatCells([
    label,
    String(agg.cases),
    formatScore(agg.recallAt5),
    formatScore(agg.recallAt10),
    formatScore(agg.mrr),
    formatScore(agg.unanswerableAccuracy),
  ]);
}

function formatCells(cells: string[]): string {
  const widths = [14, 6, 9, 10, 6, 13];
  return cells.map((cell, i) => cell.padEnd(widths[i])).join(' ');
}

function formatScore(value: number | null): string {
  return value === null ? '—' : value.toFixed(3);
}

function writeRunReport(report: EvalReport): void {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = report.generatedAt.split(':').join('-');
  const path = join(REPORTS_DIR, `${report.retriever}-${stamp}.json`);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report written to ${path}`);
}

function freezeBaseline(report: EvalReport): void {
  const baseline: BaselineFile = { ...report, tolerance: DEFAULT_TOLERANCE };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline frozen at ${BASELINE_PATH}`);
}

function assertBaseline(report: EvalReport): void {
  if (!existsSync(BASELINE_PATH)) {
    console.error('No committed baseline found; run with --freeze first.');
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as BaselineFile;
  const failures: string[] = [];
  checkMetric(failures, 'recall@10', report.aggregate.recallAt10, baseline.aggregate.recallAt10, baseline.tolerance);
  checkMetric(failures, 'MRR', report.aggregate.mrr, baseline.aggregate.mrr, baseline.tolerance);
  if (failures.length > 0) {
    console.error(`Baseline regression detected:\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log(
    `Baseline check passed (recall@10 ${formatScore(report.aggregate.recallAt10)} vs ` +
    `${formatScore(baseline.aggregate.recallAt10)}, MRR ${formatScore(report.aggregate.mrr)} vs ` +
    `${formatScore(baseline.aggregate.mrr)}, tolerance ${baseline.tolerance}).`,
  );
}

function checkMetric(
  failures: string[],
  label: string,
  current: number | null,
  frozen: number | null,
  tolerance: number,
): void {
  if (frozen === null) return;
  if (current === null || current < frozen - tolerance) {
    failures.push(`  ${label}: ${formatScore(current)} < baseline ${formatScore(frozen)} - tolerance ${tolerance}`);
  }
}

/** Spec f2, §7 criterion 2 — enforced in CI alongside the frozen-baseline check. */
function assertF2Thresholds(engineReport: EvalReport): void {
  if (!existsSync(BASELINE_PATH)) {
    console.error('No committed baseline found; F2 thresholds need it for the no-regression check.');
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as BaselineFile;
  const failures: string[] = [];

  const checkFloor = (label: string, current: number | null, floor: number) => {
    if (current === null || current < floor) {
      failures.push(`  ${label}: ${formatScore(current)} < required ${floor}`);
    }
  };

  checkFloor('aggregate recall@10', engineReport.aggregate.recallAt10, F2_THRESHOLDS.aggregateRecallAt10);
  checkFloor('aggregate MRR', engineReport.aggregate.mrr, F2_THRESHOLDS.aggregateMrr);
  checkFloor('alias recall@10', engineReport.perCategory.alias?.recallAt10 ?? null, F2_THRESHOLDS.aliasRecallAt10);
  checkFloor('bilingual recall@10', engineReport.perCategory.bilingual?.recallAt10 ?? null, F2_THRESHOLDS.bilingualRecallAt10);
  checkFloor('bundle recall@5', engineReport.perCategory.bundle?.recallAt5 ?? null, F2_THRESHOLDS.bundleRecallAt5);
  checkFloor(
    'unanswerable accuracy',
    engineReport.aggregate.unanswerableAccuracy,
    baseline.aggregate.unanswerableAccuracy ?? 0,
  );

  for (const [category, frozen] of Object.entries(baseline.perCategory)) {
    if (category === 'unanswerable') continue;
    const current = engineReport.perCategory[category];
    checkFloor(`${category} recall@10 (no regression)`, current?.recallAt10 ?? null, frozen.recallAt10 ?? 0);
    checkFloor(`${category} MRR (no regression)`, current?.mrr ?? null, frozen.mrr ?? 0);
  }

  if (failures.length > 0) {
    console.error(`F2 thresholds not met by ${engineReport.retriever}:\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log(`F2 thresholds passed for ${engineReport.retriever}.`);
}

main();
