import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanVault } from '../core/query/scan';
import { runQuery, type QueryResult } from '../core/query/engine';

/**
 * Entry point for the deterministic retrieval script shipped into vaults at
 * .knowlery/bin/query.mjs (spec f2, §5.2). Bundled self-contained by esbuild; runs with
 * plain Node, offline, with Obsidian closed.
 *
 *   node .knowlery/bin/query.mjs "<question>" [--k 12] [--json]
 */

const DEFAULT_K = 12;

function main(): void {
  const { question, k, json } = parseArgs(process.argv.slice(2));
  if (!question) {
    process.stderr.write('Usage: node .knowlery/bin/query.mjs "<question>" [--k 12] [--json]\n');
    process.exitCode = 2;
    return;
  }

  const root = resolveVaultRoot();
  const result = runQuery(question, scanVault(root), k);
  process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` : formatText(result));
}

/** The script lives at <vault>/.knowlery/bin/query.mjs, so the vault root is two levels up. */
function resolveVaultRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const root = resolve(scriptDir, '..', '..');
  // Sanity check for unusual setups (e.g. the script copied elsewhere): fall back to cwd.
  if (!existsSync(resolve(root, '.knowlery'))) return process.cwd();
  return root;
}

function parseArgs(argv: string[]): { question: string; k: number; json: boolean } {
  let question = '';
  let k = DEFAULT_K;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      json = true;
    } else if (arg === '--k') {
      const value = parseInt(argv[i + 1] ?? '', 10);
      if (Number.isFinite(value) && value > 0) k = value;
      i += 1;
    } else if (!question) {
      question = arg;
    }
  }
  return { question, k, json };
}

function formatText(result: QueryResult): string {
  if (result.verdict === 'no-confident-match') {
    return `No confident matches in this vault for: ${result.terms.join(', ')}\n`;
  }
  const lines: string[] = [];
  result.candidates.forEach((candidate, index) => {
    const type = candidate.type ? ` [${candidate.type}]` : '';
    const detail = candidate.description ? ` — ${candidate.description}` : '';
    lines.push(`${index + 1}. ${candidate.path}${type} (score ${candidate.score})${detail}`);
    if (candidate.evidence.length > 0) {
      lines.push(`   evidence via source: ${candidate.evidence.join(', ')}`);
    }
  });
  return `${lines.join('\n')}\n`;
}

main();
