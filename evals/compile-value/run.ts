import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { integer, parseArgs, required, runCli } from './lib/args';
import { evaluate } from './lib/evaluate';
import { assertOutsideRepo, loadFreeze } from './lib/freeze';
import { renderMarkdown } from './lib/markdown';
import { policiesFor } from './lib/policies';
import { readPrivate } from './lib/private';
import { BOOTSTRAP_RESAMPLES } from './lib/protocol';
import { loadQueue } from './lib/queue';
import { readSheet } from './lib/sheet';

/**
 * Protocol §8–§10 — compute both tiers' metrics and the pre-registered decisions.
 *
 *   npx tsx evals/compile-value/run.ts --freeze <dir> --sheet <sheet.yaml> --private <private.json> \
 *     [--intra <re-label sheet.yaml>] [--seed n] [--resamples 2000] [--out <dir>]
 *
 * Writes report.json and report.md (default: <freeze>/reports/<timestamp>/), stamped
 * with the protocol revision, freeze id and harness version. Refuses mixed freezes. The
 * report directory must not exist yet: creating it is the atomic claim, so of two
 * concurrent runs with the same --out exactly one writes and the other refuses.
 */

const USAGE = 'Usage: tsx evals/compile-value/run.ts --freeze <dir> --sheet <file> --private <file> [--intra <file>] [--seed n] [--resamples n] [--out <dir>]';

runCli(() => {
  const args = parseArgs(process.argv.slice(2));
  const freeze = loadFreeze(required(args, 'freeze', USAGE), { verify: true });
  const intraPath = args.get('intra');
  const queue = loadQueue(freeze);
  const report = evaluate({
    freeze,
    queue,
    policies: policiesFor(queue),
    privateFile: readPrivate(required(args, 'private', USAGE)),
    sheet: readSheet(required(args, 'sheet', USAGE)),
    ...(intraPath ? { intraSheet: readSheet(intraPath) } : {}),
    seed: integer(args, 'seed', 1),
    resamples: integer(args, 'resamples', BOOTSTRAP_RESAMPLES),
  });
  const out = args.get('out') ?? join(freeze.dir, 'reports', new Date().toISOString().replace(/[:.]/g, '-'));
  assertOutsideRepo(out, 'The report directory');
  mkdirSync(dirname(out), { recursive: true });
  try {
    mkdirSync(out);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Refusing to write into an existing report directory ${out}; choose a new --out`);
    throw error;
  }
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  writeFileSync(join(out, 'report.md'), renderMarkdown(report), { flag: 'wx' });
  for (const warning of report.warnings) console.warn(`warning: ${warning}`);
  console.log(report.decisionNote);
  console.log(`Report → ${join(out, 'report.md')}`);
});
