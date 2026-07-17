import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { scanVault } from '../../../src/core/query/scan';
import { checkCookCase, type CookCaseReport, type LoadedCookCase } from './checker';

/**
 * The cook eval runner (spec 1.3 f2, §4.2/§4.4): loads the golden material +
 * committed cooked outputs, runs the deterministic checker, and compares
 * against frozen floors. Structure is a necessary-not-sufficient proxy for
 * quality — this catches "cook stopped citing" and "taxonomy exploded", not
 * "this summary misrepresents its source" (§4.5).
 *
 * Never runs an LLM; never makes a network call.
 */

const COOK_ROOT = join(__dirname, '..', '..', 'cook');
const FIXTURES_DIR = join(COOK_ROOT, 'fixtures');
const BASELINE_PATH = join(COOK_ROOT, 'baseline.json');
const REPORTS_DIR = join(__dirname, '..', '..', 'reports');
const DEFAULT_TOLERANCE = 0.01;

export interface CookEvalReport {
  suite: 'cook';
  generatedAt: string;
  disclaimer: string;
  cases: CookCaseReport[];
}

interface BaselineFile {
  tolerance: number;
  cases: Array<{ case: string; metrics: CookCaseReport['metrics'] }>;
}

export function loadCase(name: string): LoadedCookCase {
  const caseDir = join(FIXTURES_DIR, name);
  const cookedDir = join(caseDir, 'cooked');
  const materialDir = join(caseDir, 'material');

  const files = new Map<string, string>();
  for (const file of walk(cookedDir)) {
    files.set(relative(cookedDir, file).split('\\').join('/'), readFileSync(file, 'utf8'));
  }
  const material = new Map<string, string>();
  for (const file of walk(materialDir)) {
    material.set(relative(materialDir, file).split('\\').join('/'), readFileSync(file, 'utf8'));
  }
  const caseConfig = parseYaml(readFileSync(join(caseDir, 'case.yaml'), 'utf8')) as {
    must_not_compile?: string[];
  };

  return {
    name,
    snapshot: scanVault(cookedDir),
    files,
    material,
    expectations: { mustNotCompile: caseConfig.must_not_compile ?? [] },
  };
}

export function runCookEval(): CookEvalReport {
  const cases = readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return {
    suite: 'cook',
    generatedAt: new Date().toISOString(),
    disclaimer: 'Structural invariants only — necessary, not sufficient, for cook quality (spec 1.3 f2 §4.5). Semantic fidelity stays with human/agent review.',
    cases: cases.map((name) => checkCookCase(loadCase(name))),
  };
}

/** Boolean invariants are hard floors; ratios compare with tolerance (§4.1). */
export function compareToBaseline(report: CookEvalReport, baseline: BaselineFile): string[] {
  const failures: string[] = [];
  for (const caseReport of report.cases) {
    for (const [name, value] of Object.entries(caseReport.booleans)) {
      if (!value) failures.push(`${caseReport.case}: ${name} is false (hard floor)`);
    }
    const baselineCase = baseline.cases.find((entry) => entry.case === caseReport.case);
    if (!baselineCase) {
      failures.push(`${caseReport.case}: no baseline entry — freeze one deliberately (--freeze)`);
      continue;
    }
    for (const [metric, floor] of Object.entries(baselineCase.metrics)) {
      const value = caseReport.metrics[metric as keyof CookCaseReport['metrics']];
      if (value < floor - baseline.tolerance) {
        failures.push(`${caseReport.case}: ${metric} ${value.toFixed(3)} below baseline ${floor.toFixed(3)} (tolerance ${baseline.tolerance})`);
      }
    }
  }
  return failures;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function main(): void {
  const args = new Set(process.argv.slice(2));
  const report = runCookEval();

  for (const caseReport of report.cases) {
    console.log(`\n[cook:${caseReport.case}] compiled=${caseReport.counts.compiled}`);
    for (const [metric, value] of Object.entries(caseReport.metrics)) {
      console.log(`  ${metric}: ${value.toFixed(3)}`);
    }
    for (const [name, value] of Object.entries(caseReport.booleans)) {
      console.log(`  ${name}: ${value ? 'ok' : 'FAIL'}`);
    }
    for (const finding of caseReport.findings) {
      console.log(`  finding[${finding.invariant}]${finding.page ? ` ${finding.page}` : ''}: ${finding.detail}`);
    }
  }

  mkdirSync(REPORTS_DIR, { recursive: true });
  const reportPath = join(REPORTS_DIR, `cook-${report.generatedAt.split(':').join('-')}.json`);
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport written to ${reportPath}`);

  if (args.has('--freeze')) {
    const baseline: BaselineFile = {
      tolerance: DEFAULT_TOLERANCE,
      cases: report.cases.map((caseReport) => ({ case: caseReport.case, metrics: caseReport.metrics })),
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`Baseline frozen at ${BASELINE_PATH}`);
  }

  if (args.has('--assert-baseline')) {
    if (!existsSync(BASELINE_PATH)) {
      console.error('No cook baseline; run with --freeze first (a deliberate act).');
      process.exit(1);
    }
    const failures = compareToBaseline(report, JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as BaselineFile);
    if (failures.length > 0) {
      for (const failure of failures) console.error(`cook-eval: ${failure}`);
      process.exit(1);
    }
    console.log('Cook baseline check passed.');
  }
}

if (process.argv[1]?.endsWith('run.ts')) main();
