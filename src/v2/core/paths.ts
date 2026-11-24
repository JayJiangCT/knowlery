import { lstat, readlink, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import { KnowleryError } from './errors';

export const WIKI_DIR = '.knowlery/wiki';

export function isWikiRelPath(rel: string): boolean {
  return rel === WIKI_DIR || rel.startsWith(`${WIKI_DIR}/`);
}

export function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

export function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}

export function relativePath(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}

export async function resolveRoot(dir: string, cwd: string): Promise<string> {
  try {
    const root = await realpath(resolve(cwd, dir));
    if (!(await stat(root)).isDirectory()) {
      throw new KnowleryError('not_found', `Not a directory: ${dir}`, 'Choose an existing knowledge base directory with --dir.');
    }
    return root;
  } catch (error) {
    if (isMissing(error)) {
      throw new KnowleryError('not_found', `Directory not found: ${dir}`, 'Choose an existing knowledge base directory with --dir.');
    }
    throw error;
  }
}

export async function resolveInside(root: string, input: string): Promise<string> {
  const denied = () => new KnowleryError('path_denied', `Path is outside the knowledge base: ${input}`, 'Use a root-relative path inside the knowledge base.');
  if (isAbsolute(input) || win32.isAbsolute(input)) throw denied();
  const path = resolve(root, input);
  if (!isInside(root, path)) throw denied();

  // Missing leaves still need ancestor checks, including the targets of dangling links.
  async function check(candidate: string): Promise<void> {
    if (!isInside(root, candidate)) throw denied();
    try {
      if (!isInside(root, await realpath(candidate))) throw denied();
      return;
    } catch (error) {
      if (!isMissing(error) || candidate === root) throw error;
    }
    let target: string | undefined;
    try {
      if ((await lstat(candidate)).isSymbolicLink()) target = await readlink(candidate);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    await check(target === undefined ? dirname(candidate) : resolve(dirname(candidate), target));
  }
  await check(path);
  return path;
}
