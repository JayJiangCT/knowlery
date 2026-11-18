import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isObject } from '../config';
import type { Format } from '../inventory';
import type { Header, Unit } from './types';

export async function textCacheDirectory(root: string, create = false): Promise<string> {
  for (const part of ['.knowlery', '.knowlery/cache', '.knowlery/cache/text']) {
    const path = join(root, part);
    if (create && part !== '.knowlery') await mkdir(path).catch((error: unknown) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    });
    const info = await lstat(path);
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Unsafe text cache directory.');
  }
  return join(root, '.knowlery/cache/text');
}

export function cacheName(sha256: string, id: string): string {
  if (!/^sha256:[a-f0-9]{64}$/.test(sha256) || !/^[a-z]+@[0-9]+$/.test(id)) throw new Error('Invalid extraction cache key.');
  return `${sha256.slice(7)}.${id}.jsonl`;
}

const natural = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => natural(value) && value > 0;

function validHeader(value: unknown, sha256: string, id: string, format: Format): value is Header {
  return isObject(value) && value.v === 1 && value.extractor === id && value.sha256 === sha256 && value.format === format &&
    ['ok', 'partial', 'unreadable'].includes(String(value.state)) && natural(value.units) && natural(value.bytes) &&
    isObject(value.meta) && Array.isArray(value.problems) && value.problems.every((p: unknown) => isObject(p) && typeof p.code === 'string' && typeof p.detail === 'string') &&
    (value.state !== 'unreadable' || (value.units === 0 && value.bytes === 0 && value.problems.length > 0)) &&
    (value.state !== 'partial' || (value.units > 0 && value.problems.length > 0));
}

function validUnit(value: unknown, i: number, format: Format): value is Unit {
  if (!isObject(value) || value.i !== i || typeof value.text !== 'string') return false;
  switch (value.kind) {
    case 'heading': return (format === 'markdown' || format === 'docx') && positive(value.level) && value.level <= 6 && typeof value.path === 'string';
    case 'block': return format === 'pdf' ? positive(value.page) : (format === 'markdown' || format === 'docx') && typeof value.path === 'string';
    case 'lines': return format === 'txt' && positive(value.start) && positive(value.end) && value.end >= value.start && value.text.split('\n').length === value.end - value.start + 1;
    case 'row': return positive(value.row) && (format === 'csv' || (format === 'xlsx' && typeof value.sheet === 'string' && positive(value.col)));
    default: return false;
  }
}

async function firstLine(path: string): Promise<string> {
  const stream = createReadStream(path);
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of stream) {
      const bytes = chunk as Buffer;
      const end = bytes.indexOf(10);
      chunks.push(bytes.subarray(0, end === -1 ? bytes.length : end));
      if (end !== -1) break;
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { stream.destroy(); }
}

export async function readTextCache(root: string, sha256: string, id: string, format: Format, headerOnly: true): Promise<Header | undefined>;
export async function readTextCache(root: string, sha256: string, id: string, format: Format, headerOnly?: false): Promise<{ header: Header; units: Unit[] } | undefined>;
export async function readTextCache(root: string, sha256: string, id: string, format: Format, headerOnly = false): Promise<Header | { header: Header; units: Unit[] } | undefined> {
  try {
    const path = join(await textCacheDirectory(root), cacheName(sha256, id));
    if (!(await lstat(path)).isFile()) return undefined;
    if (headerOnly) {
      const header: unknown = JSON.parse(await firstLine(path));
      return validHeader(header, sha256, id, format) ? header : undefined;
    }
    const lines = (await readFile(path, 'utf8')).split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    const header: unknown = JSON.parse(lines.shift() ?? '');
    if (!validHeader(header, sha256, id, format) || lines.length !== header.units) return undefined;
    const units: unknown[] = lines.map((line) => JSON.parse(line) as unknown);
    if (!units.every((unit, i) => validUnit(unit, i, format))) return undefined;
    const checked = units;
    if (checked.reduce((sum, unit) => sum + Buffer.byteLength(unit.text), 0) !== header.bytes) return undefined;
    return { header, units: checked };
  } catch { return undefined; }
}

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, ordered(value[key])]));
  return value;
}

export async function writeTextCache(root: string, header: Header, units: Unit[]): Promise<boolean> {
  let temp: string | undefined;
  try {
    const directory = await textCacheDirectory(root, true);
    temp = join(directory, `${randomUUID()}.tmp`);
    const content = [header, ...units].map((value) => JSON.stringify(ordered(value))).join('\n') + '\n';
    await writeFile(temp, content, { flag: 'wx' });
    await rename(temp, join(directory, cacheName(header.sha256, header.extractor)));
    return true;
  } catch { return false; }
  finally { if (temp) await rm(temp, { force: true }).catch(() => {}); }
}
