import { listKbs } from './kb-registry';
import { scanVault } from './query/scan';
import { runQuery, type QueryCandidate } from './query/engine';

/**
 * Federated query over the KB registry (spec 1.0 f1, §4.4) — the shared core
 * behind both the CLI's `query --kb '*'` and the MCP `query` tool, so the two
 * surfaces cannot drift (spec 1.0 f2, §5.6).
 */

export interface FederatedResult {
  question: string;
  /** Per-KB verdicts, including skipped entries with their reason. */
  verdictByKb: Record<string, string>;
  candidates: Array<{ kb: string } & QueryCandidate>;
}

export async function runFederatedQuery(
  question: string,
  k: number,
  onSkip?: (kbName: string, reason: string) => void,
): Promise<FederatedResult> {
  const kbs = await listKbs();
  const merged: Array<{ kb: string } & QueryCandidate> = [];
  const verdictByKb: Record<string, string> = {};

  for (const kb of kbs) {
    if (kb.state !== 'ok') {
      verdictByKb[kb.name] = `skipped (${kb.state})`;
      onSkip?.(kb.name, `${kb.state}: ${kb.path}`);
      continue;
    }
    const result = runQuery(question, scanVault(kb.path), k);
    verdictByKb[kb.name] = result.verdict;
    for (const candidate of result.candidates) {
      merged.push({ kb: kb.name, ...candidate });
    }
  }

  merged.sort((a, b) => b.score - a.score);
  return { question, verdictByKb, candidates: merged.slice(0, k) };
}
