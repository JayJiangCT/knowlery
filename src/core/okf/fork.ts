import type { App } from 'obsidian';
import { normalizePath } from 'obsidian';
import matter from 'gray-matter';
import { safeMatter } from './shared';

export interface ForkOptions {
  libraryPath: string;
  sourcePath: string;
  targetPath: string;
  bundleId: string;
}

export async function forkPageFromBundle(app: App, options: ForkOptions, now: Date = new Date()): Promise<void> {
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
