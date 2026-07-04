import { scanVault } from '../../core/query/scan';
import { computeStaleness } from '../../core/query/staleness';
import { formatStalenessReport } from '../../core/query/format';

export interface StaleCommandOptions {
  json?: boolean;
  log: (line: string) => void;
}

/**
 * `knowlery stale` (spec 0.7 f3): the global-CLI transport of the mechanical
 * staleness report. Read-only live scan, no init gate.
 */
export function runStaleCommand(root: string, options: StaleCommandOptions): void {
  const report = computeStaleness(scanVault(root));
  options.log(formatStalenessReport(report, { json: options.json }).trimEnd());
}
