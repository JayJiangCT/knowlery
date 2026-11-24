import { randomUUID } from 'node:crypto';
import { lstat, readdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Config } from '../../core/config';
import { getExtraction, type ExtractionOptions } from '../../core/extract';
import { cacheName, textCacheDirectory } from '../../core/extract/cache';
import { registry as builtins } from '../../core/extract/registry';
import { rememberInventoryHashes, scanRawSources, type RawSource } from '../../core/inventory';
import { listPages } from '../../core/page/files';
import type { ParsedPage } from '../../core/page/model';
import { parsePage } from '../../core/page/parse';
import { isMissing, WIKI_DIR } from '../../core/paths';
import { renderWikiIndex } from '../../core/wiki-index';

export interface IndexRebuildResult {
  sources: {
    total: number;
    extracted: number;
    cached: number;
    pruned: number;
  };
  pages: number;
  index: 'written' | 'unchanged' | 'no_wiki';
  warnings: string[];
}

export async function runIndexRebuild(
  root: string,
  config: Config,
  options: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {},
): Promise<{ result: IndexRebuildResult; text: string }> {
  const { sources } = await scanRawSources(root, config);
  const registry = options.registry ?? builtins;
  const warnings = new Set<string>();
  const hashes: (RawSource & { sha256: string })[] = [];
  const validCacheNames = new Set<string>();

  let extracted = 0;
  let cached = 0;

  for (const source of sources) {
    const extraction = await getExtraction(root, source.path, {
      ...options,
      config,
      listing: true,
    });
    for (const warning of extraction.warnings) warnings.add(warning);
    if (extraction.cached) cached++;
    else if (extraction.header) extracted++;
    if (extraction.sha256) {
      hashes.push({ ...source, sha256: extraction.sha256 });
      const extractor = registry[source.format];
      if (extractor) {
        validCacheNames.add(cacheName(extraction.sha256, extractor.id));
      }
    }
  }

  if (hashes.length && !await rememberInventoryHashes(root, hashes)) {
    warnings.add('cache_not_written');
  }

  let pruned = 0;
  try {
    const textDir = await textCacheDirectory(root, false);
    const entries = await readdir(textDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!validCacheNames.has(entry.name)) {
        await unlink(join(textDir, entry.name));
        pruned++;
      }
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  const wikiDir = join(root, WIKI_DIR);
  let hasWiki = false;
  try {
    const info = await lstat(wikiDir);
    hasWiki = info.isDirectory();
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  let pagesCount = 0;
  let indexStatus: 'written' | 'unchanged' | 'no_wiki' = 'no_wiki';

  if (hasWiki) {
    const pagePaths = await listPages(root);
    pagesCount = pagePaths.length;
    const parsedPages: ParsedPage[] = [];
    for (const pagePath of pagePaths) {
      const text = await readFile(join(root, pagePath), 'utf8');
      parsedPages.push(parsePage(text, basename(pagePath)));
    }

    const desired = renderWikiIndex(parsedPages);
    const indexPath = join(wikiDir, 'index.md');
    let existing: string | undefined;
    try {
      existing = await readFile(indexPath, 'utf8');
    } catch (error) {
      if (!isMissing(error)) throw error;
    }

    if (existing === desired) {
      indexStatus = 'unchanged';
    } else {
      const tempPath = join(wikiDir, `.index-${randomUUID()}.tmp`);
      try {
        await writeFile(tempPath, desired, { encoding: 'utf8', flag: 'wx' });
        await rename(tempPath, indexPath);
      } finally {
        await rm(tempPath, { force: true }).catch(() => {});
      }
      indexStatus = 'written';
    }
  }

  const warningList = [...warnings].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const result: IndexRebuildResult = {
    sources: {
      total: sources.length,
      extracted,
      cached,
      pruned,
    },
    pages: pagesCount,
    index: indexStatus,
    warnings: warningList,
  };

  const lines = [
    `index rebuild  sources: ${sources.length} (extracted ${extracted}, cached ${cached}, pruned ${pruned})  pages: ${pagesCount}  index: ${indexStatus}`,
  ];
  for (const warning of warningList) lines.push(`warning: ${warning}`);
  return { result, text: `${lines.join('\n')}\n` };
}
