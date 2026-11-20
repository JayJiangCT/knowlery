import { lstat, readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { KF_SCHEMA } from '../../schema/kf-2.0';
import { KnowleryError } from '../errors';
import { isMissing, relativePath, resolveInside } from '../paths';
import type { ParsedPage } from './model';
import { parsePage } from './parse';

const SPECIAL_FILES = new Set<string>(KF_SCHEMA.special_files);

export function isPageFile(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\')) return false;
  if (!name.endsWith('.md')) return false;
  if (SPECIAL_FILES.has(name)) return false;
  return true;
}

export async function listPages(root: string): Promise<string[]> {
  const wikiDir = join(root, 'wiki');
  let entries;
  try {
    entries = await readdir(wikiDir, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }

  const pages: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!isPageFile(entry.name)) continue;
    pages.push(`wiki/${entry.name}`);
  }
  pages.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return pages;
}

export async function readPage(root: string, path: string): Promise<ParsedPage> {
  const resolved = await resolveInside(root, path);
  const rel = relativePath(root, resolved);
  const name = basename(rel);
  if (dirname(rel) !== 'wiki' || !isPageFile(name)) {
    throw new KnowleryError(
      'path_denied',
      `Not a wiki page directly inside wiki/: ${path}`,
      'Choose a page file directly inside wiki/ (excluding CONVENTIONS.md, index.md, and log.md).',
    );
  }

  let info;
  try {
    info = await lstat(resolved);
  } catch (error) {
    if (isMissing(error)) {
      throw new KnowleryError('not_found', `Page not found: ${path}`, 'Check the page path inside wiki/.');
    }
    throw error;
  }
  if (!info.isFile()) {
    throw new KnowleryError(
      'path_denied',
      `Wiki page path is not a regular file: ${path}`,
      'Choose a regular Markdown file directly inside wiki/.',
    );
  }

  const text = await readFile(resolved, 'utf8');
  return parsePage(text, name);
}
