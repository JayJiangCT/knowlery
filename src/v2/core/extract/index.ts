import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { readConfig, type Config } from '../config';
import { KnowleryError } from '../errors';
import { cachedInventoryHash, formatFor, resolveRawSource } from '../inventory';
import { relativePath } from '../paths';
import { readTextCache, writeTextCache } from './cache';
import { registry as builtins } from './registry';
import type { Extraction, Header, Registry } from './types';

export interface ExtractionOptions {
  registry?: Registry;
  config?: Config;
  ceiling?: number;
  listing?: boolean;
}

export async function getExtraction(root: string, input: string, options: ExtractionOptions = {}): Promise<Extraction> {
  const config = options.config ?? await readConfig(root);
  const path = await resolveRawSource(root, input, config);
  const info = await lstat(path);
  const format = formatFor(path);
  if (!info.isFile() || !format) throw new KnowleryError('extraction_unavailable', `No extraction format for: ${input}`, 'Choose a supported raw source file.');
  const empty = { sha256: null, header: null, units: [], warnings: [], cached: false };
  if (info.size > (options.ceiling ?? 104857600)) return { ...empty, state: 'too_large' };
  const extractor = (options.registry ?? builtins)[format];
  const previous = options.listing ? await cachedInventoryHash(root, relativePath(root, path), info.size, info.mtimeMs) : undefined;
  if (previous && extractor) {
    const cached = await readTextCache(root, previous, extractor.id, format);
    if (cached) return { sha256: previous, state: cached.header.state, ...cached, warnings: [], cached: true };
  }
  if (!extractor && previous) return { ...empty, sha256: previous, state: 'unavailable' };
  const bytes = await readFile(path);
  const sha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (!extractor) return { ...empty, sha256, state: 'unavailable' };
  const cached = await readTextCache(root, sha256, extractor.id, format);
  if (cached) return { sha256, state: cached.header.state, ...cached, warnings: [], cached: true };
  const extracted = await extractor.extract(bytes);
  const header: Header = {
    v: 1, extractor: extractor.id, sha256, format, state: extracted.state, units: extracted.units.length,
    bytes: extracted.units.reduce((sum, unit) => sum + Buffer.byteLength(unit.text), 0), meta: extracted.meta, problems: extracted.problems,
  };
  const warnings = await writeTextCache(root, header, extracted.units) ? [] : ['cache_not_written'];
  return { sha256, state: header.state, header, units: extracted.units, warnings, cached: false };
}
