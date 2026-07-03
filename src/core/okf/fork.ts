import type { App } from 'obsidian';
import { normalizePath } from 'obsidian';
import matter from 'gray-matter';
import { safeMatter, toPosixPath } from './shared';
import { KNOWLEDGE_DIRS } from '../../types';

export interface ForkOptions {
  libraryPath: string;
  sourcePath: string;
  targetPath: string;
  bundleId: string;
}

export function parseLibraryPath(path: string): { bundleId: string; relativePath: string } | null {
  const normalized = toPosixPath(path);
  if (!normalized.startsWith('Library/')) return null;
  const withoutPrefix = normalized.slice('Library/'.length);
  const slashIndex = withoutPrefix.indexOf('/');
  if (slashIndex === -1) return null;
  return {
    bundleId: withoutPrefix.slice(0, slashIndex),
    relativePath: withoutPrefix.slice(slashIndex + 1),
  };
}

export async function forkPageFromBundle(app: App, options: ForkOptions, now: Date = new Date()): Promise<void> {
  const topSegment = options.sourcePath.split('/')[0];
  if (!(KNOWLEDGE_DIRS as readonly string[]).includes(topSegment)) {
    throw new Error(`Cannot fork ${options.sourcePath}: only entities/concepts/comparisons/queries pages can be forked.`);
  }

  const sourcePath = normalizePath(`${options.libraryPath}${options.sourcePath}`);
  const sourceFile = app.vault.getFileByPath(sourcePath);
  if (!sourceFile) throw new Error(`Bundle page not found: ${options.sourcePath}`);

  const targetPath = normalizePath(options.targetPath);
  if (await app.vault.adapter.exists(targetPath)) {
    throw new Error(`A page already exists at ${options.targetPath} — rename it before forking.`);
  }

  const content = await app.vault.read(sourceFile);
  const parsed = safeMatter(content);
  const frontmatter = {
    ...parsed.data,
    forked_from_bundle: options.bundleId,
    forked_from_path: options.sourcePath,
    forked_at: now.toISOString(),
  };

  await app.vault.adapter.write(targetPath, matter.stringify(parsed.content.trimStart(), frontmatter));
}
