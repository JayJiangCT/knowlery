import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scanVault } from '../../core/query/scan';
import { autoTriageAll } from '../../core/jev/auto-triage';
import { JEV_API_KEY_ENV, PLUGIN_DATA_PATH, type ResolvedJevKey } from '../../core/jev/api-key';
import { CONFIDENT_NO, CONFIDENT_YES } from '../../core/jev/triage-store';
import { JEV_PRICE_PER_MTOK, type JevTransport } from '../../core/jev/client';
import { nodeJevTransport } from '../../platform/node-jev';
import { nodeVaultFs } from '../../platform/node-fs';
import { CliError } from './shared';

export interface TriageCommandOptions {
  json?: boolean;
  log: (line: string) => void;
  /** Progress lines; the CLI wires this to stderr so `--json` stdout stays clean. */
  warn?: (line: string) => void;
  key: ResolvedJevKey | null;
  jevTransport?: JevTransport;
}

export interface TriageSummary {
  scored: number;
  failed: number;
  remaining: number;
  passes: number;
  inputTokens: number;
  costUsd: number;
  /** How the scored notes fall across Jev's confidence bands, for judging the ≤ 0.2 band. */
  bands: { likely: number; uncertain: number; unlikely: number };
  keySource: ResolvedJevKey['source'];
}

/**
 * `knowlery triage`: score every uncooked note that lacks a current Jev score, in
 * passes of TRIAGE_CAP, and write `.knowlery/triage.json`. The one deliberate,
 * whole-backlog pass — `stale` only tops up 40 notes per call so it never makes an
 * agent wait. Idempotent: notes already scored at their current mtime are not sent.
 */
export async function runTriageCommand(root: string, options: TriageCommandOptions): Promise<void> {
  if (!options.key) {
    throw new CliError(
      `No Jev key. Export ${JEV_API_KEY_ENV} or add the key in the Knowlery plugin settings (${PLUGIN_DATA_PATH}).`,
    );
  }
  const snapshot = scanVault(root);
  const progress = options.json ? options.warn : options.log;
  let lastReported = -1;
  const result = await autoTriageAll({
    fs: nodeVaultFs(root),
    snapshot,
    readNote: (path) => readFile(join(root, path), 'utf8'),
    transport: options.jevTransport ?? nodeJevTransport,
    apiKey: options.key.apiKey,
    onProgress: (done, total) => {
      // One line per completed batch rather than per note.
      if (done === total || (done % 40 === 0 && done !== lastReported)) {
        lastReported = done;
        progress?.(`Jev: ${done}/${total} processed`);
      }
    },
  });

  if (result.scores.length === 0 && result.failures.length > 0) {
    throw new CliError(`Jev scored nothing: ${result.failures[0].message}`);
  }

  const inputTokens = result.scores.reduce((sum, score) => sum + score.inputTokens, 0);
  const summary: TriageSummary = {
    scored: result.scores.length,
    failed: result.failures.length,
    remaining: result.remaining,
    passes: result.passes,
    inputTokens,
    costUsd: (inputTokens / 1e6) * JEV_PRICE_PER_MTOK,
    bands: {
      likely: result.scores.filter((score) => score.worth >= CONFIDENT_YES).length,
      uncertain: result.scores.filter((score) => score.worth > CONFIDENT_NO && score.worth < CONFIDENT_YES).length,
      unlikely: result.scores.filter((score) => score.worth <= CONFIDENT_NO).length,
    },
    keySource: options.key.source,
  };

  options.log(options.json ? JSON.stringify(summary, null, 2) : renderSummary(summary));
}

function renderSummary(summary: TriageSummary): string {
  if (summary.scored === 0 && summary.failed === 0) {
    return 'Jev triage: every uncooked note already has a current score — nothing sent.';
  }
  const cost = summary.costUsd < 0.0001 ? '<0.0001' : summary.costUsd.toFixed(4);
  const lines = [
    `Jev triage: ${summary.scored} note(s) scored in ${summary.passes} pass(es), ${summary.inputTokens} input tokens ≈ $${cost}.`,
    `  > ${CONFIDENT_YES} likely knowledge: ${summary.bands.likely}`,
    `  ${CONFIDENT_NO}–${CONFIDENT_YES} uncertain:      ${summary.bands.uncertain}`,
    `  ≤ ${CONFIDENT_NO} unlikely:         ${summary.bands.unlikely}`,
  ];
  if (summary.failed > 0) lines.push(`  ${summary.failed} note(s) failed; ${summary.remaining} left unscored — rerun to retry.`);
  lines.push(`Key from ${summary.keySource === 'env' ? JEV_API_KEY_ENV : 'plugin settings'}. Scores saved to .knowlery/triage.json; knowlery stale, the MCP stale tool, and the dashboard now show this ranking.`);
  return lines.join('\n');
}
