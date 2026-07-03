import type { QueryResult } from './engine';

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
