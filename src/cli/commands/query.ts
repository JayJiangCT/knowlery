import { scanVault } from '../../core/query/scan';
import { runQuery } from '../../core/query/engine';
import { formatQueryResult } from '../../core/query/format';
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
