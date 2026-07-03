import type { CliData, CliFlags } from 'obsidian';
import { runQuery } from './engine';
import { formatQueryResult, formatStalenessReport } from './format';
import { computeStaleness } from './staleness';
import type { VaultSnapshot } from './scan';

/**
 * Handler body for `obsidian knowlery:query` (spec f5, §5.3).
 *
 * MUST stay fully synchronous: the CLI host only captures output produced within the
 * current microtask queue, so any await on real I/O here would make the command return
 * empty output. All I/O lives in LiveQuerySnapshot, off the query path. A unit test
 * guards this function's synchronous string return (spec f5, R4).
 */

const DEFAULT_K = 12;

export const QUERY_CLI_COMMAND = 'knowlery:query';
export const QUERY_CLI_DESCRIPTION = 'Deterministic knowledge retrieval over this vault';

export const QUERY_CLI_FLAGS: CliFlags = {
  question: { value: '<text>', description: 'The question to answer', required: true },
  k: { value: '<n>', description: `Max results (default ${DEFAULT_K})` },
  json: { description: 'Structured JSON output' },
};

export const QUERY_CLI_USAGE =
  'Usage: obsidian knowlery:query question="<text>" [k=<n>] [json]';

export const QUERY_CLI_WARMING =
  'Snapshot warming up — retry in a moment, or run: node .knowlery/bin/query.mjs "<question>"';

export const STALE_CLI_COMMAND = 'knowlery:stale';
export const STALE_CLI_DESCRIPTION =
  'Report compiled pages whose sources changed, and notes never compiled';

export const STALE_CLI_FLAGS: CliFlags = {
  json: { description: 'Structured JSON output' },
};

export const STALE_CLI_WARMING =
  'Snapshot warming up — retry in a moment, or run: node .knowlery/bin/query.mjs --stale';

/** Synchronous for the same microtask reason as handleQueryCli (spec f3, §4.3). */
export function handleStaleCli(params: CliData, snapshot: VaultSnapshot | null): string {
  if (!snapshot) return STALE_CLI_WARMING;
  const report = computeStaleness(snapshot);
  return formatStalenessReport(report, { json: params.json === 'true' }).trimEnd();
}

export function handleQueryCli(params: CliData, snapshot: VaultSnapshot | null): string {
  const question = typeof params.question === 'string' && params.question !== 'true'
    ? params.question.trim()
    : '';
  if (!question) return QUERY_CLI_USAGE;
  if (!snapshot) return QUERY_CLI_WARMING;

  let k = DEFAULT_K;
  if (typeof params.k === 'string') {
    const parsed = parseInt(params.k, 10);
    if (Number.isFinite(parsed) && parsed > 0) k = parsed;
  }

  const result = runQuery(question, snapshot, k);
  return formatQueryResult(result, { json: params.json === 'true' }).trimEnd();
}
