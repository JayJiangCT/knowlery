/**
 * The perf benchmark runner (spec 1.3 f4, §4.2): `npm run eval:perf`.
 * Measures the four user-visible paths — scan, query (scan included, three
 * questions with independent medians), orientation map, federation — over
 * seeded synthetic vaults, through the same public entry points the shells
 * use. `--src <root>` runs against another tree's core (the pairing seam);
 * `--assert-budgets` applies the ceiling / shape / federation-ratio layers.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { generateVault, QUERY_QUESTIONS, TIER_PAGES, type Tier } from './generate-vault';
import { loadEntryPoints, measure } from './measure';
import {
  assertCeilings, assertFederationRatio, assertGrowthShape,
  type PathStats, type PerfReport, type RunnerReport,
} from './budgets';
import { addKb } from '../../src/core/kb-registry';

export const BENCH_SEED = 20260724;
const FEDERATION_KBS = 3;

interface Options {
  tiers: Tier[];
  assertBudgets: boolean;
  srcRoot: string;
  allowMissingBase: boolean;
  jsonPath?: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    tiers: ['small', 'medium', 'large'],
    assertBudgets: false,
    srcRoot: process.cwd(),
    allowMissingBase: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--tiers') {
      options.tiers = String(argv[++i]).split(',').map((tier) => {
        if (!(tier in TIER_PAGES)) throw new Error(`Unknown tier: ${tier}`);
        return tier as Tier;
      });
    } else if (arg === '--assert-budgets') options.assertBudgets = true;
    else if (arg === '--src') options.srcRoot = resolve(String(argv[++i]));
    else if (arg === '--allow-missing-base') options.allowMissingBase = true;
    else if (arg === '--json') options.jsonPath = String(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function materialize(tier: Tier, scratch: string): string {
  const root = join(scratch, `vault-${tier}`);
  const { files } = generateVault(BENCH_SEED, tier);
  for (const [path, content] of files) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

export async function runBenchmark(options: Options, log: (line: string) => void): Promise<RunnerReport> {
  const role = options.srcRoot === process.cwd() ? 'head' : 'base';
  const entryPoints = await loadEntryPoints(options.srcRoot, role, options.allowMissingBase, log);
  if ('skipped' in entryPoints) return { skipped: true, reason: entryPoints.reason };
  const { scanVault, runQuery, collectOrientationMap, runFederatedQuery } = entryPoints;

  const scratch = mkdtempSync(join(tmpdir(), 'knowlery-perf-'));
  const rssBefore = process.memoryUsage().rss;
  const tiers: PerfReport['tiers'] = {};
  const scanPagesPerSec: Record<string, number> = {};
  let federation: PerfReport['federation'] = null;

  try {
    for (const tier of options.tiers) {
      const root = materialize(tier, scratch);
      const paths: Record<string, PathStats> = {};

      paths.scan = await measure(() => scanVault(root));
      scanPagesPerSec[tier] = Math.round(TIER_PAGES[tier] / (paths.scan.medianMs / 1000));
      for (const [lang, question] of Object.entries(QUERY_QUESTIONS)) {
        paths[`query-${lang}`] = await measure(() => runQuery(question, scanVault(root), 12));
      }
      paths.index = await measure(() => collectOrientationMap(root, new Date().toISOString()));

      tiers[tier] = { pages: TIER_PAGES[tier], paths };
      log(`  measured ${tier} (${TIER_PAGES[tier]} pages)`);
    }

    if (options.tiers.includes('medium')) {
      const configDir = mkdtempSync(join(tmpdir(), 'knowlery-perf-registry-'));
      const previousConfigDir = process.env.KNOWLERY_CONFIG_DIR;
      process.env.KNOWLERY_CONFIG_DIR = configDir;
      try {
        for (let i = 0; i < FEDERATION_KBS; i++) {
          // Distinct seeds per KB — federating three identical vaults would
          // dedupe into an unrealistically cheap merge.
          const root = join(scratch, `fed-${i}`);
          const { files } = generateVault(BENCH_SEED + 1 + i, 'medium');
          for (const [path, content] of files) {
            mkdirSync(join(root, dirname(path)), { recursive: true });
            writeFileSync(join(root, path), content);
          }
          await addKb(`perf-kb-${i}`, root);
        }
        const stats = await measure(() => runFederatedQuery(QUERY_QUESTIONS.en, 12));
        federation = {
          kbs: FEDERATION_KBS,
          stats,
          singleQueryMedianMs: tiers.medium.paths['query-en'].medianMs,
        };
        log(`  measured federation (${FEDERATION_KBS} medium KBs)`);
      } finally {
        if (previousConfigDir === undefined) delete process.env.KNOWLERY_CONFIG_DIR;
        else process.env.KNOWLERY_CONFIG_DIR = previousConfigDir;
        rmSync(configDir, { recursive: true, force: true });
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }

  return {
    generatedAt: new Date().toISOString(),
    seed: BENCH_SEED,
    srcRoot: options.srcRoot,
    skipped: false,
    tiers,
    federation,
    info: {
      scanPagesPerSec,
      rssDeltaMb: Math.round((process.memoryUsage().rss - rssBefore) / 1024 / 1024),
    },
  };
}

function printTable(report: PerfReport, log: (line: string) => void): void {
  log('');
  log(`path         ${Object.keys(report.tiers).map((tier) => tier.padStart(12)).join('')}`);
  const pathNames = Object.keys(Object.values(report.tiers)[0]?.paths ?? {});
  for (const path of pathNames) {
    const cells = Object.values(report.tiers).map((tier) => {
      const stats = tier.paths[path];
      return (stats ? `${stats.medianMs.toFixed(1)}ms` : '-').padStart(12);
    });
    log(`${path.padEnd(13)}${cells.join('')}`);
  }
  if (report.federation) {
    const ratio = report.federation.stats.medianMs / report.federation.singleQueryMedianMs;
    log(`federation   ${report.federation.stats.medianMs.toFixed(1)}ms over ${report.federation.kbs} medium KBs (${ratio.toFixed(2)}x a single medium query)`);
  }
  log(`info         scan throughput ${JSON.stringify(report.info.scanPagesPerSec)} pages/s · rss delta ${report.info.rssDeltaMb}MB`);
  log('');
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const log = (line: string) => process.stdout.write(`${line}\n`);
  log(`Perf benchmark (seed ${BENCH_SEED}) — src: ${options.srcRoot}`);

  const report = await runBenchmark(options, log);

  const jsonPath = options.jsonPath
    ?? join(process.cwd(), 'evals', 'reports', `perf-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  log(`Report written to ${jsonPath}`);

  if (report.skipped) return; // loud warning already printed by the loader

  printTable(report, log);

  if (options.assertBudgets) {
    const violations = [
      ...assertCeilings(report),
      ...assertGrowthShape(report),
      ...assertFederationRatio(report),
    ];
    if (violations.length > 0) {
      for (const violation of violations) process.stderr.write(`BUDGET VIOLATION — ${violation}\n`);
      process.exitCode = 1;
      return;
    }
    log('Budgets passed (ceilings, growth shape, federation ratio).');
  }
}

const invokedDirectly = process.argv[1]?.endsWith('run.ts') || process.argv[1]?.endsWith('run.js');
if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
