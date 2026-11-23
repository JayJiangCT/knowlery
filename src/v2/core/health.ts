import { lstat, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { KF_VERSION, KIT_VERSION } from '../version';
import type { Config } from './config';
import { renderConventions } from './conventions';
import { textCacheDirectory } from './extract/cache';
import { loadPdfjs } from './extract/pdf';
import { registry as builtins } from './extract/registry';
import type { Registry } from './extract/types';
import { scanRawSources, type Format, type InventoryResult } from './inventory';
import { listPages } from './page/files';
import { isMissing } from './paths';

const FORMATS: readonly Format[] = ['markdown', 'txt', 'csv', 'pdf', 'docx', 'xlsx'];

export interface HealthResult {
  kit: string;
  kf: string;
  node: string;
  config: {
    ignore: number;
    mcp_raw: boolean;
  };
  extractors: Record<Format, string | null>;
  pdf_parser: 'available' | 'missing';
  wiki: {
    pages: number;
    conventions: 'current' | 'outdated' | 'missing';
    index: 'present' | 'missing';
    log: 'present' | 'missing';
  };
  sources: InventoryResult['counts'];
  cache: {
    inventory: 'present' | 'missing';
    text_files: number;
  };
}

async function isRegularFile(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export async function health(
  root: string,
  config: Config,
  options: { registry?: Registry } = {},
): Promise<HealthResult> {
  const registry = options.registry ?? builtins;

  const extractors = {} as Record<Format, string | null>;
  for (const format of FORMATS) {
    extractors[format] = registry[format]?.id ?? null;
  }

  let pdfParser: 'available' | 'missing';
  try {
    await loadPdfjs();
    pdfParser = 'available';
  } catch {
    pdfParser = 'missing';
  }

  const pages = await listPages(root);

  let conventionsState: 'current' | 'outdated' | 'missing' = 'missing';
  try {
    const existing = await readFile(join(root, 'wiki/CONVENTIONS.md'), 'utf8');
    conventionsState = existing === renderConventions() ? 'current' : 'outdated';
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  const indexState = await isRegularFile(join(root, 'wiki/index.md')) ? 'present' : 'missing';
  const logState = await isRegularFile(join(root, 'wiki/log.md')) ? 'present' : 'missing';

  const { counts: sources } = await scanRawSources(root, config);

  const inventoryCacheState = await isRegularFile(join(root, '.knowlery/cache/inventory.jsonl'))
    ? 'present'
    : 'missing';

  let textFiles = 0;
  try {
    const textDir = await textCacheDirectory(root, false);
    const entries = await readdir(textDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        textFiles++;
      }
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  return {
    kit: KIT_VERSION,
    kf: KF_VERSION,
    node: process.version,
    config: {
      ignore: config.ignore.length,
      mcp_raw: config.mcp.raw,
    },
    extractors,
    pdf_parser: pdfParser,
    wiki: {
      pages: pages.length,
      conventions: conventionsState,
      index: indexState,
      log: logState,
    },
    sources,
    cache: {
      inventory: inventoryCacheState,
      text_files: textFiles,
    },
  };
}
