/**
 * The paired base/head comparison CLI (spec 1.3 f4, §4.3):
 * `tsx evals/perf/compare.ts <head.json> <base.json>`. Same runner, same
 * methodology (both reports come from head's runner); the 1.5× per-path
 * budget catches the uniform slowdown the other layers cannot see. The
 * printed ratios — not absolute times — are what the observational window
 * records toward the required-flip graduation criteria.
 */

import { readFileSync } from 'node:fs';
import { comparePaired, PerfReportSchema, SkippedReportSchema } from './budgets';

function main(): void {
  const [headPath, basePath] = process.argv.slice(2);
  if (!headPath || !basePath) {
    process.stderr.write('Usage: tsx evals/perf/compare.ts <head-report.json> <base-report.json>\n');
    process.exitCode = 2;
    return;
  }

  const baseRaw: unknown = JSON.parse(readFileSync(basePath, 'utf8'));
  const skipped = SkippedReportSchema.safeParse(baseRaw);
  if (skipped.success) {
    process.stdout.write(`Paired comparison SKIPPED — ${skipped.data.reason}\n`);
    process.stdout.write('(--allow-missing-base bootstrap: valid only for the F4 landing PR.)\n');
    return;
  }

  const head = PerfReportSchema.parse(JSON.parse(readFileSync(headPath, 'utf8')));
  const base = PerfReportSchema.parse(baseRaw);
  const { violations, ratios } = comparePaired(head, base);

  process.stdout.write('Paired ratios (head/base, same runner — the graduation-window record):\n');
  for (const [path, ratio] of Object.entries(ratios)) {
    process.stdout.write(`  ${path.padEnd(24)} ${ratio.toFixed(3)}\n`);
  }

  if (violations.length > 0) {
    for (const violation of violations) process.stderr.write(`PAIRED VIOLATION — ${violation}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Paired comparison passed.\n');
}

main();
