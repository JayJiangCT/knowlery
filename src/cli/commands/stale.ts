import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scanVault } from '../../core/query/scan';
import { computeStaleness } from '../../core/query/staleness';
import { formatStalenessReport } from '../../core/query/format';
import { autoTriage } from '../../core/jev/auto-triage';
import { nodeJevTransport } from '../../platform/node-jev';
import type { JevTransport } from '../../core/jev/client';
import { nodeVaultFs } from '../../platform/node-fs';

export interface StaleCommandOptions {
  json?: boolean;
  log: (line: string) => void;
  /** Diagnostics that must not pollute `--json` stdout; the CLI wires this to stderr. */
  warn?: (line: string) => void;
  /**
   * Jev key from the environment (`TYPESAFE_API_KEY`). When present, uncooked notes
   * without a current score are scored first (cap 40) and the result is written to
   * `.knowlery/triage.json` so every other transport sees the same ranking.
   */
  jevApiKey?: string;
  jevTransport?: JevTransport;
}

/**
 * `knowlery stale` (spec 0.7 f3): the global-CLI transport of the mechanical
 * staleness report. Read-only live scan, no init gate — except that with a Jev key in
 * the environment it also refreshes the triage store, the one write this command does.
 */
export async function runStaleCommand(root: string, options: StaleCommandOptions): Promise<void> {
  const snapshot = scanVault(root);
  let report = computeStaleness(snapshot);

  if (options.jevApiKey) {
    try {
      const result = await autoTriage({
        fs: nodeVaultFs(root),
        snapshot,
        readNote: (path) => readFile(join(root, path), 'utf8'),
        transport: options.jevTransport ?? nodeJevTransport,
        apiKey: options.jevApiKey,
      });
      report = result.report;
      if (result.outcome) {
        const { scores, failures, skipped } = result.outcome;
        const parts = [`Jev scored ${scores.length} note(s)`];
        if (skipped > 0) parts.push(`${skipped} beyond the per-run cap left for next time`);
        if (failures.length > 0) parts.push(`${failures.length} failed: ${failures[0].message.replace(/\.$/, '')}`);
        options.warn?.(`${parts.join('; ')}.`);
      }
    } catch (error) {
      // Jev is a ranking hint: a failed call degrades to the mechanical report.
      options.warn?.(`Jev triage skipped: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  options.log(formatStalenessReport(report, { json: options.json }).trimEnd());
}
