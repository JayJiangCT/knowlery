import type { App, TFile } from 'obsidian';
import { normalizePath } from 'obsidian';
import type { ActivityRecord, KnowledgeDir } from '../../types';
import { KNOWLEDGE_DIRS } from '../../types';
import { readRecentActivityRecords } from '../activity-ledger';
import type { PageRecord, ResolvedLink } from './shared';
import { BUNDLE_MARKER, EXPORT_SCOPE_PATH, conceptIdFromPath, isKnowledgePath, safeMatter, titleFromPath, toPosixPath } from './shared';
import { sha256 } from './hash';
import { parseWikilink } from './wikilink';

interface MetadataCacheLike {
  getFirstLinkpathDest?: (linkpath: string, sourcePath: string) => TFile | null;
  resolvedLinks?: Record<string, Record<string, number>>;
}

export async function collectBundleInputs(app: App, options: { sinceDays?: number } = {}): Promise<{
  pages: PageRecord[];
  activity: ActivityRecord[];
}> {
  const bundleRoots = await findBundleRoots(app);
  const pages: PageRecord[] = [];

  for (const file of app.vault.getMarkdownFiles()) {
    const sourcePath = toPosixPath(file.path);
    if (!isKnowledgePath(sourcePath) && sourcePath !== 'SCHEMA.md') continue;
    if (sourcePath === EXPORT_SCOPE_PATH) continue;
    if (isInBundleRoot(sourcePath, bundleRoots)) continue;
    if (sourcePath === 'SCHEMA.md') continue;

    const dir = sourcePath.split('/')[0] as KnowledgeDir;
    if (!KNOWLEDGE_DIRS.includes(dir)) continue;
    const content = await app.vault.cachedRead(file);
    const parsed = safeMatter(content);
    const conceptId = conceptIdFromPath(sourcePath);
    pages.push({
      conceptId,
      sourcePath,
      dir,
      frontmatter: parsed.data,
      body: parsed.content.trimStart(),
      outlinks: resolveWikilinks(app, sourcePath, parsed.content),
      backlinks: backlinksFor(app, sourcePath, bundleRoots),
      contentHash: sha256(content),
    });
  }

  const activity = await readRecentActivityRecords(app, options.sinceDays ?? 36500);
  return { pages, activity: activity.records };
}

export async function readRawDependency(app: App, path: string, citedBy: string[]): Promise<import('./shared').RawDependency | null> {
  const file = app.vault.getFileByPath(normalizePath(path));
  if (!file) return null;
  const content = await app.vault.cachedRead(file);
  const parsed = safeMatter(content);
  return {
    path: toPosixPath(file.path),
    title: typeof parsed.data.title === 'string' ? parsed.data.title : titleFromPath(file.path),
    // Body without the frontmatter block — previews and risk scans read this;
    // the hash stays over the full content so any edit invalidates approval.
    body: parsed.content.trimStart(),
    frontmatter: parsed.data,
    citedBy,
    contentHash: sha256(content),
  };
}

export async function readSchemaMd(app: App): Promise<string | null> {
  const file = app.vault.getFileByPath('SCHEMA.md');
  return file ? app.vault.read(file) : null;
}

const WALK_SKIP_DIRS = new Set(['.obsidian', '.git', '.trash', 'node_modules']);

export async function findBundleRoots(app: App): Promise<Set<string>> {
  const roots = new Set<string>();
  const adapter = app.vault.adapter;

  async function walk(dir: string): Promise<void> {
    let listing: { files: string[]; folders: string[] };
    try {
      listing = await adapter.list(dir);
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
      if (WALK_SKIP_DIRS.has(name)) continue;
      // A bundle root never nests another bundle; stop descending once marked.
      if (roots.has(normalized)) continue;
      await walk(normalized);
    }
  }

  await walk('/');
  return roots;
}

function resolveWikilinks(app: App, sourcePath: string, body: string): ResolvedLink[] {
  const metadataCache = app.metadataCache as MetadataCacheLike;
  const links: ResolvedLink[] = [];
  for (const match of body.matchAll(/(!?)\[\[([^\]]+)\]\]/g)) {
    const raw = match[2];
    const parsed = parseWikilink(raw);
    const dest = metadataCache.getFirstLinkpathDest?.(parsed.target, sourcePath) ?? null;
    const targetPath = dest ? toPosixPath(dest.path) : null;
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

function backlinksFor(app: App, sourcePath: string, bundleRoots: Set<string>): string[] {
  const metadataCache = app.metadataCache as MetadataCacheLike;
  const resolved = metadataCache.resolvedLinks ?? {};
  const backlinks: string[] = [];
  for (const [from, targets] of Object.entries(resolved)) {
    const normalizedFrom = toPosixPath(from);
    if (isInBundleRoot(normalizedFrom, bundleRoots)) continue;
    if (targets[sourcePath] || targets[normalizePath(sourcePath)]) backlinks.push(normalizedFrom);
  }
  return backlinks;
}

function isInBundleRoot(path: string, bundleRoots: Set<string>): boolean {
  for (const root of bundleRoots) {
    if (root && (path === root || path.startsWith(`${root}/`))) return true;
  }
  return false;
}
