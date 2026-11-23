import type { Config } from '../../core/config';
import type { ExtractionOptions } from '../../core/extract';
import { health, type HealthResult } from '../../core/health';

export async function runHealth(
  root: string,
  config: Config,
  extractionOptions: Pick<ExtractionOptions, 'registry'> = {},
): Promise<{ result: HealthResult; text: string }> {
  const result = await health(root, config, { registry: extractionOptions.registry });
  const extractorParts = Object.entries(result.extractors).map(([fmt, id]) => `${fmt}=${id ?? 'none'}`);
  const formatParts = Object.entries(result.sources.by_format).map(([fmt, count]) => `${fmt}:${count}`);
  const lines = [
    `knowlery ${result.kit}  kf ${result.kf}  node ${result.node}`,
    `config: ignore=${result.config.ignore}  mcp.raw=${result.config.mcp_raw}`,
    `extractors: ${extractorParts.join(' ')}  pdf_parser=${result.pdf_parser}`,
    `wiki: pages=${result.wiki.pages}  conventions=${result.wiki.conventions}  index=${result.wiki.index}  log=${result.wiki.log}`,
    `sources: total=${result.sources.total}${formatParts.length ? ` (${formatParts.join(', ')})` : ''}  unsupported=${result.sources.unsupported}  ignored=${result.sources.ignored}  symlinks=${result.sources.symlinks}`,
    `cache: inventory=${result.cache.inventory}  text_files=${result.cache.text_files}`,
  ];
  return { result, text: `${lines.join('\n')}\n` };
}
