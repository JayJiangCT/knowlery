import { scanVault } from '../../core/query/scan';
import { runQuery, type QueryCandidate } from '../../core/query/engine';
import { formatQueryResult } from '../../core/query/format';
import { listKbs } from '../../core/kb-registry';
import { CliError } from './shared';

const DEFAULT_K = 12;

export interface QueryCommandOptions {
  question?: string;
  k?: number;
  json?: boolean;
  log: (line: string) => void;
}

/**
 * `knowlery query` (spec 0.7 f3): the global-CLI transport of the retrieval engine.
 * Read-only live scan — works on any markdown folder, no init gate. Abstention is a
 * result, not an error (exit 0), matching the other two transports.
 */
export function runQueryCommand(root: string, options: QueryCommandOptions): void {
  const question = options.question?.trim();
  if (!question) {
    throw new CliError('Usage: knowlery query "<question>" [--dir <path>] [--k <n>] [--json]', 2);
  }
  const result = runQuery(question, scanVault(root), options.k ?? DEFAULT_K);
  options.log(formatQueryResult(result, { json: options.json }).trimEnd());
}

/**
 * Federated query over the KB registry (spec 1.0 f1, §4.4): the standard engine
 * per registered KB, results merged by score (comparable by construction — same
 * engine, same weights), every candidate attributed to its KB.
 */
export async function runFederatedQueryCommand(options: QueryCommandOptions): Promise<void> {
  const question = options.question?.trim();
  if (!question) {
    throw new CliError(`Usage: knowlery query "<question>" --kb '*' [--k <n>] [--json]`, 2);
  }
  const k = options.k ?? DEFAULT_K;
  const kbs = await listKbs();
  if (kbs.length === 0) {
    throw new CliError('No knowledge bases registered. Add one: knowlery kb add <name> <path>');
  }

  const merged: Array<{ kb: string; candidate: QueryCandidate }> = [];
  const verdictByKb: Record<string, string> = {};
  for (const kb of kbs) {
    if (kb.state !== 'ok') {
      verdictByKb[kb.name] = `skipped (${kb.state})`;
      process.stderr.write(`Note: ${kb.name} skipped (${kb.state}: ${kb.path})\n`);
      continue;
    }
    const result = runQuery(question, scanVault(kb.path), k);
    verdictByKb[kb.name] = result.verdict;
    for (const candidate of result.candidates) {
      merged.push({ kb: kb.name, candidate });
    }
  }

  merged.sort((a, b) => b.candidate.score - a.candidate.score);
  const top = merged.slice(0, k);

  if (options.json) {
    options.log(JSON.stringify({
      question,
      verdictByKb,
      candidates: top.map(({ kb, candidate }) => ({ kb, ...candidate })),
    }, null, 2));
    return;
  }

  if (top.length === 0) {
    const consulted = Object.keys(verdictByKb).join(', ');
    options.log(`No confident matches in any registered KB (consulted: ${consulted}).`);
    return;
  }
  for (const { kb, candidate } of top) {
    options.log(`${candidate.score.toFixed(2).padStart(7)}  ${kb}: ${candidate.path} — ${candidate.title}`);
  }
}
