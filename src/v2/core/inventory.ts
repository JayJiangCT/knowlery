import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join, posix } from 'node:path';
import { isObject, type Config } from './config';
import { invalidInvocation, KnowleryError } from './errors';
import { hashFile } from './hash';
import { createIgnoreMatcher } from './ignore';
import { isMissing, relativePath, resolveInside } from './paths';

export type Format = 'markdown' | 'txt' | 'csv' | 'pdf' | 'docx' | 'xlsx';
export interface InventoryItem {
  path: string;
  format: Format;
  size: number;
  sha256: string;
  extraction: 'pending' | 'too_large';
}
interface CacheLine {
  path: string;
  size: number;
  mtimeMs: number;
  sha256: string;
  format: Format;
}
export interface InventoryOptions {
  scope?: string;
  limit?: number;
  offset?: number;
  snapshot?: string;
  ceiling?: number;
}
export interface InventoryResult {
  counts: { total: number; by_format: Partial<Record<Format, number>>; unsupported: number; ignored: number; symlinks: number };
  items: InventoryItem[];
  offset: number;
  returned: number;
  more: boolean;
  next: { offset: number; snapshot: string } | null;
  snapshot: string;
  cache: { hashed: number; reused: number };
  warnings: string[];
}
export type PathItem = { path: string; exists: false } | { path: string; exists: true; size: number; sha256: string };

export function formatFor(path: string): Format | undefined {
  switch (extname(path).toLowerCase()) {
    case '.md':
    case '.markdown': return 'markdown';
    case '.txt': return 'txt';
    case '.csv': return 'csv';
    case '.pdf': return 'pdf';
    case '.docx': return 'docx';
    case '.xlsx': return 'xlsx';
    default: return undefined;
  }
}

function inScope(path: string, scope: string): boolean {
  return scope === '' || path === scope || path.startsWith(`${scope}/`);
}

async function cacheDirectory(root: string, create: boolean): Promise<string> {
  for (const part of ['.knowlery', '.knowlery/cache']) {
    const path = join(root, part);
    if (create && part.endsWith('/cache')) await mkdir(path, { recursive: false }).catch((error: unknown) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    });
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Unsafe cache directory.');
  }
  return join(root, '.knowlery/cache');
}

async function readCache(root: string): Promise<Map<string, CacheLine>> {
  try {
    const path = join(await cacheDirectory(root, false), 'inventory.jsonl');
    if (!(await lstat(path)).isFile()) return new Map();
    const text = await readFile(path, 'utf8');
    const cache = new Map<string, CacheLine>();
    for (const line of text.split('\n')) {
      if (!line) continue;
      const value: unknown = JSON.parse(line) as unknown;
      if (!isObject(value) || typeof value.path !== 'string' || value.path === '' || value.path.startsWith('/') || posix.normalize(value.path) !== value.path || value.path.split('/').includes('..') ||
          typeof value.size !== 'number' || !Number.isSafeInteger(value.size) || value.size < 0 ||
          typeof value.mtimeMs !== 'number' || !Number.isFinite(value.mtimeMs) ||
          typeof value.sha256 !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value.sha256) ||
          value.format !== formatFor(value.path) || value.format === undefined || cache.has(value.path)) return new Map();
      cache.set(value.path, { path: value.path, size: value.size, mtimeMs: value.mtimeMs, sha256: value.sha256, format: value.format as Format });
    }
    return cache;
  } catch {
    return new Map();
  }
}

async function writeCache(root: string, lines: CacheLine[]): Promise<boolean> {
  let temp: string | undefined;
  try {
    const directory = await cacheDirectory(root, true);
    temp = join(directory, `inventory-${randomUUID()}.tmp`);
    lines.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    await writeFile(temp, lines.map((line) => `${JSON.stringify(line)}\n`).join(''), { flag: 'wx' });
    await rename(temp, join(directory, 'inventory.jsonl'));
    return true;
  } catch {
    return false;
  } finally {
    if (temp) await rm(temp, { force: true }).catch(() => {});
  }
}

export async function resolveRawSource(root: string, input: string, config: Config): Promise<string> {
  const path = await resolveInside(root, input);
  const rel = relativePath(root, path);
  const parts = rel.split('/').filter(Boolean);
  const ignores = createIgnoreMatcher(config.ignore);
  const denied = () => new KnowleryError('path_denied', `Not an inventoried source path: ${input}`, 'Choose a visible, non-ignored raw source outside wiki/ and .knowlery/.');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const prefix = parts.slice(0, i + 1).join('/');
    if (part.startsWith('.') || part.startsWith('~$') || (i === 0 && (part === 'wiki' || part === 'AGENTS.md')) || ignores(prefix)) throw denied();
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw denied();
    } catch (error) {
      if (isMissing(error)) throw new KnowleryError('not_found', `Source not found: ${input}`, 'Choose an existing raw source.');
      throw error;
    }
  }
  if (await realpath(path) !== path) throw denied();
  return path;
}

export async function cachedInventoryHash(root: string, path: string, size: number, mtimeMs: number): Promise<string | undefined> {
  const previous = (await readCache(root)).get(path);
  return previous?.size === size && previous.mtimeMs === mtimeMs ? previous.sha256 : undefined;
}

export async function inventory(root: string, config: Config, options: InventoryOptions = {}): Promise<InventoryResult> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const ceiling = options.ceiling ?? 104857600;
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0) invalidInvocation('Invalid inventory pagination.');
  const start = await resolveInside(root, options.scope ?? '.');
  try {
    await lstat(start);
  } catch (error) {
    if (isMissing(error)) throw new KnowleryError('not_found', `Scope not found: ${options.scope}`, 'Choose an existing scope.');
    throw error;
  }
  const scope = relativePath(root, start);
  const oldCache = await readCache(root);
  const updated: CacheLine[] = [];
  const items: InventoryItem[] = [];
  const counts: InventoryResult['counts'] = { total: 0, by_format: {}, unsupported: 0, ignored: 0, symlinks: 0 };
  const cache = { hashed: 0, reused: 0 };
  const ignores = createIgnoreMatcher(config.ignore);

  async function walk(path: string): Promise<void> {
    const rel = relativePath(root, path);
    const parts = rel.split('/');
    if (rel && parts.some((part) => part.startsWith('.'))) return;
    const info = await lstat(path);
    if (rel === 'AGENTS.md' && !info.isDirectory()) return;
    if ((parts[0] === 'wiki' || parts[0] === '.knowlery') && (parts.length > 1 || info.isDirectory())) return;
    if (info.isSymbolicLink()) {
      counts.symlinks++;
      return;
    }
    if (info.isDirectory()) {
      for (const entry of await readdir(path)) await walk(join(path, entry));
      return;
    }
    if (!info.isFile() || parts[parts.length - 1].startsWith('~$')) return;
    if (ignores(rel)) {
      counts.ignored++;
      return;
    }
    const format = formatFor(rel);
    if (!format) {
      counts.unsupported++;
      return;
    }
    const previous = oldCache.get(rel);
    let sha256: string;
    if (previous && previous.size === info.size && previous.mtimeMs === info.mtimeMs) {
      sha256 = previous.sha256;
      cache.reused++;
    } else {
      sha256 = await hashFile(path);
      cache.hashed++;
    }
    updated.push({ path: rel, size: info.size, mtimeMs: info.mtimeMs, sha256, format });
    items.push({ path: rel, format, size: info.size, sha256, extraction: info.size > ceiling ? 'too_large' : 'pending' });
    counts.by_format[format] = (counts.by_format[format] ?? 0) + 1;
  }

  let walkStart = root;
  for (const part of scope.split('/').filter(Boolean)) {
    walkStart = join(walkStart, part);
    if ((await lstat(walkStart)).isSymbolicLink()) break;
  }
  await walk(walkStart);
  items.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  counts.total = items.length;
  counts.by_format = Object.fromEntries(Object.entries(counts.by_format).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  const hash = createHash('sha256');
  for (const item of items) hash.update(`${item.path}\t${item.sha256}\n`);
  const snapshot = `sha256:${hash.digest('hex')}`;
  if (options.snapshot !== undefined && options.snapshot !== snapshot) {
    throw new KnowleryError('stale_version', 'The inventory changed since the previous page.', 'Start again at offset 0.');
  }
  const page: InventoryItem[] = [];
  let bytes = 0;
  for (let i = offset; i < items.length && page.length < limit; i++) {
    const size = Buffer.byteLength(JSON.stringify(items[i]), 'utf8') + 1;
    if (page.length && bytes + size > 12288) break;
    page.push(items[i]);
    bytes += size;
  }
  const more = offset + page.length < items.length;
  const kept = [...oldCache.values()].filter((line) => !inScope(line.path, scope));
  const warnings = await writeCache(root, [...kept, ...updated]) ? [] : ['cache_not_written'];
  return { counts, items: page, offset, returned: page.length, more, next: more ? { offset: offset + page.length, snapshot } : null, snapshot, cache, warnings };
}

export async function inventoryPaths(root: string, paths: string[]): Promise<{ paths: PathItem[] }> {
  const items: PathItem[] = [];
  for (const input of paths) {
    const path = await resolveInside(root, input);
    const rel = relativePath(root, path);
    try {
      const info = await stat(path);
      if (!info.isFile()) invalidInvocation(`--paths requires files, not folders: ${input}`);
      items.push({ path: rel, exists: true, size: info.size, sha256: await hashFile(path) });
    } catch (error) {
      if (!isMissing(error)) throw error;
      items.push({ path: rel, exists: false });
    }
  }
  return { paths: items };
}
