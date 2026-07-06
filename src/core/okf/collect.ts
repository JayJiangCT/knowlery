import type { ActivityRecord, KnowledgeDir } from '../../types';
import { KNOWLEDGE_DIRS } from '../../types';
import type { VaultFs } from '../vault-fs';
import { normalizeVaultPath } from '../vault-fs';
import { readRecentActivityRecords } from '../activity-ledger';
import type { PageRecord, ResolvedLink } from './shared';
import { BUNDLE_MARKER, EXPORT_SCOPE_PATH, conceptIdFromPath, isKnowledgePath, safeMatter, titleFromPath, toPosixPath } from './shared';
import { sha256 } from './hash';
import { parseWikilink } from './wikilink';
import type { LinkResolver } from './link-resolver';
import { listMarkdownPaths } from './link-resolver';

/**
 * The vault access an export needs (spec 0.8 f1, §4.1): file I/O plus wikilink
 * resolution. The Obsidian shell passes obsidianVaultFs + obsidianLinkResolver; the
 * CLI passes nodeVaultFs + the headless resolver.
 */
export interface BundleSource {
  fs: VaultFs;
  resolver: LinkResolver;
  /**
   * Obsidian config dir to skip while walking. Dot-directories are always skipped;
   * this only matters when the vault uses a non-dot custom config folder.
   */
  configDir?: string;
}

export async function collectBundleInputs(source: BundleSource, options: { sinceDays?: number } = {}): Promise<{
  pages: PageRecord[];
  activity: ActivityRecord[];
}> {
  const configDir = source.configDir;
  const bundleRoots = await findBundleRoots(source.fs, configDir);
  const pages: PageRecord[] = [];

  for (const sourcePath of await listMarkdownPaths(source.fs, configDir)) {
    if (!isKnowledgePath(sourcePath) && sourcePath !== 'SCHEMA.md') continue;
    if (sourcePath === EXPORT_SCOPE_PATH) continue;
    if (isInBundleRoot(sourcePath, bundleRoots)) continue;
    if (sourcePath === 'SCHEMA.md') continue;

    const dir = sourcePath.split('/')[0] as KnowledgeDir;
    if (!KNOWLEDGE_DIRS.includes(dir)) continue;
    const content = await source.fs.read(sourcePath);
    const parsed = safeMatter(content);
    const conceptId = conceptIdFromPath(sourcePath);
    pages.push({
      conceptId,
      sourcePath,
      dir,
      frontmatter: parsed.data,
      body: parsed.content.trimStart(),
      outlinks: resolveWikilinks(source.resolver, sourcePath, parsed.content),
      backlinks: backlinksFor(source.resolver, sourcePath, bundleRoots),
      contentHash: sha256(content),
    });
  }

  const activity = await readRecentActivityRecords(source.fs, options.sinceDays ?? 36500);
  return { pages, activity: activity.records };
}

export async function readRawDependency(fs: VaultFs, path: string, citedBy: string[]): Promise<import('./shared').RawDependency | null> {
  const normalized = normalizeVaultPath(path);
  if (!(await fs.exists(normalized))) return null;
  const content = await fs.read(normalized);
  const parsed = safeMatter(content);
  return {
    path: toPosixPath(normalized),
    title: typeof parsed.data.title === 'string' ? parsed.data.title : titleFromPath(normalized),
    // Body without the frontmatter block — previews and risk scans read this;
    // the hash stays over the full content so any edit invalidates approval.
    body: parsed.content.trimStart(),
    frontmatter: parsed.data,
    citedBy,
    contentHash: sha256(content),
  };
}

export async function readSchemaMd(fs: VaultFs): Promise<string | null> {
  return (await fs.exists('SCHEMA.md')) ? fs.read('SCHEMA.md') : null;
}

const WALK_SKIP_DIRS = new Set(['.git', '.trash', 'node_modules']);

export async function findBundleRoots(fs: VaultFs, configDir?: string): Promise<Set<string>> {
  const roots = new Set<string>();
  const normalizedConfigDir = configDir ? toPosixPath(configDir).replace(/\/$/, '') : null;

  async function walk(dir: string): Promise<void> {
    let listing: { files: string[]; folders: string[] };
    try {
      listing = await fs.list(dir);
    } catch {
      return;
    }
    for (const file of listing.files) {
      const normalized = toPosixPath(file);
      if (normalized.endsWith(`/${BUNDLE_MARKER}`) || normalized === BUNDLE_MARKER) {
        const root = normalized.slice(0, -BUNDLE_MARKER.length).replace(/\/$/, '');
        roots.add(root);
      }
    }
    for (const folder of listing.folders) {
      const normalized = toPosixPath(folder);
      const name = normalized.split('/').pop() ?? '';
      if (WALK_SKIP_DIRS.has(name) || name.startsWith('.')) continue;
      if (normalizedConfigDir && (normalized === normalizedConfigDir || normalized.startsWith(`${normalizedConfigDir}/`))) continue;
      // A bundle root never nests another bundle; stop descending once marked.
      if (roots.has(normalized)) continue;
      await walk(normalized);
    }
  }

  await walk('/');
  return roots;
}

function resolveWikilinks(resolver: LinkResolver, sourcePath: string, body: string): ResolvedLink[] {
  const links: ResolvedLink[] = [];
  for (const match of body.matchAll(/(!?)\[\[([^\]]+)\]\]/g)) {
    const raw = match[2];
    const parsed = parseWikilink(raw);
    const targetPath = resolver.resolve(parsed.target, sourcePath);
    links.push({
      raw,
      targetPath,
      targetConceptId: targetPath && isKnowledgePath(targetPath) ? conceptIdFromPath(targetPath) : null,
      heading: parsed.heading,
      alias: parsed.alias,
      embed: match[1] === '!',
    });
  }
  return links;
}

function backlinksFor(resolver: LinkResolver, sourcePath: string, bundleRoots: Set<string>): string[] {
  const resolved = resolver.resolvedLinks();
  const backlinks: string[] = [];
  for (const [from, targets] of Object.entries(resolved)) {
    const normalizedFrom = toPosixPath(from);
    if (isInBundleRoot(normalizedFrom, bundleRoots)) continue;
    if (targets[sourcePath] || targets[normalizeVaultPath(sourcePath)]) backlinks.push(normalizedFrom);
  }
  return backlinks;
}

function isInBundleRoot(path: string, bundleRoots: Set<string>): boolean {
  for (const root of bundleRoots) {
    if (root && (path === root || path.startsWith(`${root}/`))) return true;
  }
  return false;
}
