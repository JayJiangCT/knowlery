import { lstat } from 'node:fs/promises';
import type { Config } from '../config';
import { KnowleryError } from '../errors';
import { hashFile } from '../hash';
import { cachedInventoryHash, resolveRawSource } from '../inventory';
import { isMissing, relativePath } from '../paths';
import type { ParsedPage } from './model';

export type PageFreshness =
  | 'superseded'
  | 'deprecated'
  | 'disputed'
  | 'source_missing'
  | 'source_changed'
  | 'ok';

export function citedSourceKeys(page: ParsedPage): Set<string> {
  const citedKeys = new Set<string>();
  for (const claim of page.claims) {
    for (const key of claim.sources) citedKeys.add(key);
  }
  for (const item of page.open) {
    for (const key of item.sources) citedKeys.add(key);
  }
  return citedKeys;
}

export async function pageFreshness(root: string, config: Config, page: ParsedPage): Promise<PageFreshness> {
  const status = page.frontmatter.status;
  if (status === 'superseded' || status === 'deprecated' || status === 'disputed') {
    return status;
  }

  const citedKeys = citedSourceKeys(page);

  if (citedKeys.size === 0) return 'ok';

  const sourceByKey = new Map(page.sources.map((entry) => [entry.key, entry]));
  let changed = false;

  for (const key of citedKeys) {
    const entry = sourceByKey.get(key);
    if (!entry) return 'source_missing';

    let resolved: string;
    try {
      resolved = await resolveRawSource(root, entry.path, config);
    } catch (error) {
      if (error instanceof KnowleryError && (error.code === 'not_found' || error.code === 'path_denied')) {
        return 'source_missing';
      }
      throw error;
    }

    let info;
    try {
      info = await lstat(resolved);
    } catch (error) {
      if (isMissing(error)) return 'source_missing';
      throw error;
    }
    if (!info.isFile()) return 'source_missing';

    const rel = relativePath(root, resolved);
    const currentHash = await cachedInventoryHash(root, rel, info.size, info.mtimeMs)
      ?? await hashFile(resolved);
    if (currentHash !== `sha256:${entry.sha256}`) {
      changed = true;
    }
  }

  return changed ? 'source_changed' : 'ok';
}
