import type { QueryResult } from './engine';
import type { StalenessReport } from './staleness';

/**
 * Shared renderer for both retrieval transports (spec f5, §5.1). The vault-shipped
 * query.mjs and the in-app `obsidian knowlery:query` handler both call this, so output
 * parity between transports is structural rather than maintained by hand.
 */
export function formatQueryResult(result: QueryResult, options: { json?: boolean } = {}): string {
  if (options.json) return `${JSON.stringify(result, null, 2)}\n`;
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

const UNCOOKED_DISPLAY_CAP = 10;

/** Shared renderer for the staleness report; both transports call this (spec f3, §4.3). */
export function formatStalenessReport(
  report: StalenessReport,
  options: { json?: boolean } = {},
): string {
  if (options.json) return `${JSON.stringify(report, null, 2)}\n`;
  const lines: string[] = [];

  if (report.stalePages.length === 0) {
    lines.push('Stale pages: none.');
  } else {
    lines.push(`Stale pages (${report.stalePages.length}):`);
    report.stalePages.forEach((finding, index) => {
      lines.push(`${index + 1}. ${finding.path} — sources changed after last compile:`);
      for (const source of finding.changedSources) {
        lines.push(
          `   ${source.path} (source ${formatTime(source.sourceMtimeMs)} > page ${formatTime(source.pageMtimeMs)})`,
        );
      }
    });
  }

  if (report.uncookedNotes.length === 0) {
    lines.push('Uncooked notes: none.');
  } else {
    const shown = report.uncookedNotes.slice(0, UNCOOKED_DISPLAY_CAP);
    const scored = report.uncookedNotes.filter((note) => note.jev).length;
    const order = scored > 0
      ? `Jev-ranked, ${scored} of ${report.uncookedNotes.length} scored; unscored in mtime order`
      : 'most recent first';
    lines.push(`Uncooked notes (${order}, ${shown.length} of ${report.uncookedNotes.length}):`);
    shown.forEach((note, index) => {
      const jev = note.jev
        ? `  jev ${note.jev.worth.toFixed(2)} → ${note.jev.target ? `update ${note.jev.target.path}` : 'new page'}`
        : '';
      lines.push(`${index + 1}. ${note.path} (${formatTime(note.mtimeMs).slice(0, 10)})${jev}`);
    });
  }

  if (report.danglingSources.length > 0) {
    lines.push(`Dangling sources (${report.danglingSources.length}):`);
    for (const dangling of report.danglingSources) {
      lines.push(`- ${dangling.page} cites missing note: ${dangling.source}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function formatTime(mtimeMs: number): string {
  return new Date(mtimeMs).toISOString().slice(0, 16).replace('T', ' ');
}
