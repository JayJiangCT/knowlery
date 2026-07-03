import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanVault } from '../core/query/scan';
import { runQuery } from '../core/query/engine';
import { formatQueryResult, formatStalenessReport } from '../core/query/format';
import { computeStaleness } from '../core/query/staleness';

/**
 * Entry point for the deterministic retrieval script shipped into vaults at
 * .knowlery/bin/query.mjs (spec f2, §5.2; staleness mode per spec f3, §4.3). Bundled
 * self-contained by esbuild; runs with plain Node, offline, with Obsidian closed.
 *
 *   node .knowlery/bin/query.mjs "<question>" [--k 12] [--json]
 *   node .knowlery/bin/query.mjs --stale [--json]
 */

const DEFAULT_K = 12;

function main(): void {
  const { question, k, json, stale } = parseArgs(process.argv.slice(2));

  if (stale) {
    const report = computeStaleness(scanVault(resolveVaultRoot()));
    process.stdout.write(formatStalenessReport(report, { json }));
    return;
  }

  if (!question) {
    process.stderr.write(
      'Usage: node .knowlery/bin/query.mjs "<question>" [--k 12] [--json]\n' +
      '       node .knowlery/bin/query.mjs --stale [--json]\n',
    );
    process.exitCode = 2;
    return;
  }

  const result = runQuery(question, scanVault(resolveVaultRoot()), k);
  process.stdout.write(formatQueryResult(result, { json }));
}

/** The script lives at <vault>/.knowlery/bin/query.mjs, so the vault root is two levels up. */
function resolveVaultRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const root = resolve(scriptDir, '..', '..');
  // Sanity check for unusual setups (e.g. the script copied elsewhere): fall back to cwd.
  if (!existsSync(resolve(root, '.knowlery'))) return process.cwd();
  return root;
}

function parseArgs(argv: string[]): { question: string; k: number; json: boolean; stale: boolean } {
  let question = '';
  let k = DEFAULT_K;
  let json = false;
  let stale = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--stale') {
      stale = true;
    } else if (arg === '--k') {
      const value = parseInt(argv[i + 1] ?? '', 10);
      if (Number.isFinite(value) && value > 0) k = value;
      i += 1;
    } else if (!question) {
      question = arg;
    }
  }
  return { question, k, json, stale };
}

main();
