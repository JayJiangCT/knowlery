import type { VaultFs } from '../vault-fs';
import { parseWikilink } from './wikilink';
import { toPosixPath } from './shared';

/**
 * Wikilink target resolution — the one capability VaultFs cannot provide
 * (spec 0.8 f1, §4.1). Two implementations: the Obsidian shell wraps metadataCache
 * (src/platform/obsidian-link-resolver.ts); this module provides the headless one,
 * built from a single scan pass.
 */
export interface LinkResolver {
  /** Resolve a wikilink target (already stripped of heading/alias) to a vault-relative path, or null. */
  resolve(target: string, fromPath: string): string | null;
  /** resolvedLinks-shaped map (from -> { to -> count }) for backlink computation. */
  resolvedLinks(): Record<string, Record<string, number>>;
}

const WALK_SKIP_DIRS = new Set(['.git', '.trash', 'node_modules']);

export async function listMarkdownPaths(fs: VaultFs, configDir?: string): Promise<string[]> {
  const normalizedConfigDir = configDir ? toPosixPath(configDir).replace(/\/$/, '') : null;
  const paths: string[] = [];

  async function walk(dir: string): Promise<void> {
    let listing: { files: string[]; folders: string[] };
    try {
      listing = await fs.list(dir);
    } catch {
      return;
    }
    for (const file of listing.files) {
      const normalized = toPosixPath(file);
      if (normalized.endsWith('.md')) paths.push(normalized);
    }
    for (const folder of listing.folders) {
      const normalized = toPosixPath(folder);
      const name = normalized.split('/').pop() ?? '';
      if (WALK_SKIP_DIRS.has(name)) continue;
      if (name.startsWith('.')) continue;
      if (normalizedConfigDir && (normalized === normalizedConfigDir || normalized.startsWith(`${normalizedConfigDir}/`))) continue;
      await walk(normalized);
    }
  }

  await walk('/');
  return paths.sort();
}

/**
 * Headless resolver semantics (accepted spec): exact vault-relative path first
 * (with `.md` appended when missing), then unique basename — Obsidian's
 * shortest-path convention approximated conservatively: an ambiguous basename
 * resolves to null, matching a cache miss.
 */
export async function buildHeadlessLinkResolver(
  fs: VaultFs,
  configDir?: string,
): Promise<LinkResolver> {
  const paths = await listMarkdownPaths(fs, configDir);
  const pathSet = new Set(paths);
  const byBasename = new Map<string, string[]>();
  for (const path of paths) {
    const basename = path.split('/').pop()!.replace(/\.md$/, '');
    if (!byBasename.has(basename)) byBasename.set(basename, []);
    byBasename.get(basename)!.push(path);
  }

  const resolve = (target: string): string | null => {
    const cleaned = toPosixPath(target).replace(/^\//, '');
    const withExt = cleaned.endsWith('.md') ? cleaned : `${cleaned}.md`;
    if (pathSet.has(withExt)) return withExt;
    const candidates = byBasename.get(cleaned.split('/').pop()!.replace(/\.md$/, ''));
    if (candidates && candidates.length === 1) return candidates[0];
    return null;
  };

  // Forward map for backlinks: parse every page's wikilinks once.
  const resolved: Record<string, Record<string, number>> = {};
  for (const path of paths) {
    let body: string;
    try {
      body = await fs.read(path);
    } catch {
      continue;
    }
    for (const match of body.matchAll(/(!?)\[\[([^\]]+)\]\]/g)) {
      const parsed = parseWikilink(match[2]);
      const targetPath = resolve(parsed.target);
      if (!targetPath) continue;
      resolved[path] ??= {};
      resolved[path][targetPath] = (resolved[path][targetPath] ?? 0) + 1;
    }
  }

  return {
    resolve: (target) => resolve(target),
    resolvedLinks: () => resolved,
  };
}
