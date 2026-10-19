import type { Interval } from './metrics';
import type { Estimate, EvaluationReport } from './evaluate';

function num(value: number | null | undefined, digits = 3): string {
  return value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
}

function ci(interval: Interval | null): string {
  return interval && Number.isFinite(interval[0]) ? `[${num(interval[0])}, ${num(interval[1])}]` : '—';
}

function estimate(value: Estimate | null | undefined): string {
  if (!value || value.value === null) return '—';
  return value.ci ? `${num(value.value)} ${ci(value.ci)}` : num(value.value);
}

function table(header: string[], rows: string[][]): string {
  return [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.join(' | ')} |`)].join('\n');
}

export function renderMarkdown(report: EvaluationReport): string {
  const out: string[] = [];
  out.push(`# Compile-value evaluation — ${report.protocol} r${report.protocolRevision}`);
  out.push('');
  out.push(`Freeze \`${report.freezeId.slice(0, 16)}…\` (frozen ${report.frozenAt}) · queue ${report.queueSize} notes · seed ${report.seed} · ${report.resamples} bootstrap resamples · harness knowlery ${report.harness}.`);
  out.push('');
  out.push(`> Intervals are 95% bootstrap intervals, **${report.intervalScope}**: they describe this vault's labelled material, not other vaults. Generalisation needs a second freeze (protocol §10 rule 4).`);
  out.push('');
  if (report.warnings.length > 0) {
    out.push('## Warnings', '', ...report.warnings.map((warning) => `- ${warning}`), '');
  }
  const c = report.counts;
  out.push('## Counts', '');
  out.push(`Sheet ${c.sheet} (labelled ${c.labelled}, unlabelled ${c.unlabelled}) · diagnostic ${c.diagnostic} (labelled ${c.diagnosticLabelled}) · pool ${c.pool} (labelled ${c.poolLabelled}) · seeded ${c.seeded} · ineligible snapshots ${c.ineligible} · selected_next ${c.selectedNext}.`);
  out.push('');

  out.push('## Policies', '');
  out.push(table(['Policy', 'Kind', 'Status', 'Description'], report.availability.map((row) => [
    row.policy, row.kind, row.available ? (row.pooled ? 'available, pooled' : 'available') : `not available — missing: ${(row.missing ?? []).join('; ')}`,
    row.note ? `${row.description} (${row.note})` : row.description,
  ])));
  out.push('', `B1 — ${report.b1.description}: ${estimate(report.b1.prevalence)}.`, '');

  out.push('## Operational tier (full frozen queue)', '');
  out.push(...report.operational.notes.map((note) => `- ${note}`));
  out.push('');
  out.push(table(['Policy', 'P@10', 'P@20', 'nDCG@10', 'Δ P@10 vs B0', 'Δ P@10 vs B2'], report.operational.rows.map((row) => [
    row.policy, estimate(row.precisionAt10), estimate(row.precisionAt20), estimate(row.ndcgAt10),
    estimate(row.diffVsB0?.precisionAt10), estimate(row.diffVsB2?.precisionAt10),
  ])));
  out.push('', `Oracle ceiling: P@10 ${num(report.operational.oracle.precisionAt10)}, P@20 ${num(report.operational.oracle.precisionAt20)}.`, '');

  out.push('## Actionable-critical misses (estimated over the full queue)', '');
  out.push(...report.misses.notes.map((note) => `- ${note}`));
  out.push('', `Estimated actionable-critical notes in the queue: ${estimate(report.misses.estimatedActionableCritical)}.`, '');
  const ks = report.misses.rows[0]?.recall.map((entry) => entry.k) ?? [];
  out.push(table(
    ['Policy', 'Bottom-20% share', ...ks.map((k) => `Recall@${k}`), 'Worst observed pct', 'Δ share vs B0', 'Δ share vs B2'],
    report.misses.rows.map((row) => [
      row.policy, estimate(row.bottom20Share),
      ...row.recall.map((entry) => `${estimate(entry.estimate)}${entry.labelledInTopK !== null ? ` (${entry.labelledInTopK} labelled)` : ''}`),
      num(row.worstObservedPercentile, 1), estimate(row.diffVsB0), estimate(row.diffVsB2),
    ]),
  ));
  out.push('');

  out.push('## Diagnostic tier (sample only)', '');
  out.push(table(['Policy', 'P@10 within sample', 'P@20 within sample'], report.diagnostic.withinSample.map((row) => [row.policy, num(row.precisionAt10), num(row.precisionAt20)])));
  out.push('', 'Mean full-queue rank percentile of sampled notes (lower is earlier):', '');
  out.push(table(['Policy', 'Dimension', 'Group', 'n', 'Mean percentile'], report.diagnostic.groups.map((row) => [row.policy, row.dimension, row.group, String(row.n), num(row.meanPercentile, 1)])));
  if (report.diagnostic.calibration) {
    out.push('', '1.6.0 Jev worth band vs `worth` label (diagnostic notes):', '');
    out.push(table(['Band', 'yes', 'no', 'unsure', 'share yes', 'Wilson 95%'], report.diagnostic.calibration.bands.map((band) => [
      band.band, String(band.yes), String(band.no), String(band.unsure), num(band.precisionYes), ci(band.wilson),
    ])));
  }
  out.push('', `Signals not available in this round: ${report.diagnostic.signalsNotAvailable.join(', ')}.`, '');

  if (report.seeded.length > 0) {
    out.push('## Seeded notes (individually)', '');
    const policies = Object.keys(report.seeded[0].percentiles);
    out.push(table(['Id', 'Actionable critical', ...policies.map((policy) => `${policy} pct`)], report.seeded.map((entry) => [
      entry.id, entry.actionableCritical === null ? 'unlabelled' : entry.actionableCritical ? 'yes' : 'no',
      ...policies.map((policy) => num(entry.percentiles[policy], 1)),
    ])));
    out.push('');
  }

  if (report.kappa) {
    out.push('## Intra-rater agreement', '');
    out.push(table(['Label', 'n', 'κ', 'Usable for decisions'], report.kappa.map((row) => [row.label, String(row.n), num(row.kappa), row.usable ? 'yes' : 'no'])));
    out.push('');
  }

  out.push('## Decisions (pre-registered, §10)', '', report.decisionNote, '');
  for (const decision of report.decisions) {
    out.push(`### ${decision.policy}: ${decision.outcome}`, '');
    out.push(table(['Rule', 'Outcome', 'Detail'], decision.checks.map((check) => [check.rule, check.outcome, check.detail])));
    out.push('');
  }
  out.push('## Cost', '', report.cost, '');
  return `${out.join('\n')}\n`;
}
