import type { App } from 'obsidian';
import { normalizePath } from 'obsidian';
import type { ExportScopeFile, ReviewStatus } from '../../types';
import { ExportScopeFileSchema } from '../../types';
import { collectBundleInputs, readRawDependency } from './collect';
import type { PageRecord, RawDependency } from './shared';
import { DEFAULT_MAX_COMPILED_HOPS, EXPORT_SCOPE_PATH, isKnowledgePath, toPosixPath } from './shared';
import { sha256 } from './hash';

export interface ScopeItem {
  id: string;
  kind: 'concept' | 'raw';
  title: string;
  path: string;
  body: string;
  frontmatter: Record<string, unknown>;
  citedBy: string[];
  isSeed: boolean;
  status: ReviewStatus;
  contentHash: string;
  contentHashAtReview: string | null;
  /**
   * Incremental-review note (§8.2 callouts): 'new' = entered the closure
   * since the last saved scope; 'changed' = had a saved approval/flag that
   * hash-invalidation reverted. Null on first-ever scope build.
   */
  reviewNote: 'new' | 'changed' | null;
}

export interface ScopeClosure {
  pages: PageRecord[];
  rawDependencies: RawDependency[];
  items: ScopeItem[];
  edges: Array<{ from: string; to: string; kind: 'compiled' | 'raw' }>;
}

export async function buildClosure(
  app: App,
  bundleId: string,
  seeds: string[],
  maxCompiledHops = DEFAULT_MAX_COMPILED_HOPS,
): Promise<ScopeClosure> {
  const { pages } = await collectBundleInputs(app);
  const pageById = new Map(pages.map((page) => [page.conceptId, page]));
  const included = new Map<string, PageRecord>();
  const rawCitations = new Map<string, Set<string>>();
  const edges: ScopeClosure['edges'] = [];
  const queue = seeds.map((seed) => ({ id: seed, depth: 0 }));

  while (queue.length > 0) {
    const next = queue.shift()!;
    if (included.has(next.id)) continue;
    const page = pageById.get(next.id);
    if (!page) continue;
    included.set(next.id, page);

    for (const link of page.outlinks) {
      if (!link.targetPath) continue;
      if (link.targetConceptId && pageById.has(link.targetConceptId)) {
        edges.push({ from: page.conceptId, to: link.targetConceptId, kind: 'compiled' });
        if (next.depth < maxCompiledHops) queue.push({ id: link.targetConceptId, depth: next.depth + 1 });
        continue;
      }
      addRawCitation(rawCitations, link.targetPath, page.conceptId);
      edges.push({ from: page.conceptId, to: toPosixPath(link.targetPath), kind: 'raw' });
    }

    for (const rawPath of rawPathsFromSources(page.frontmatter.sources)) {
      addRawCitation(rawCitations, rawPath, page.conceptId);
      edges.push({ from: page.conceptId, to: rawPath, kind: 'raw' });
    }
  }

  const rawDependencies = await readRawDependencies(app, rawCitations);
  const scopeFile = await readExportScope(app);
  const bundle = scopeFile.bundles[bundleId];
  const persistedItems = bundle?.items ?? {};
  const hasSavedScope = bundle !== undefined;
  const seedSet = new Set(seeds);
  const items: ScopeItem[] = [
    ...Array.from(included.values()).map((page) => itemFromPage(page, persistedItems[page.conceptId], hasSavedScope, seedSet.has(page.conceptId))),
    ...rawDependencies.map((raw) => itemFromRaw(raw, persistedItems[raw.path], hasSavedScope)),
  ];

  items.sort((a, b) => a.title.localeCompare(b.title));
  return { pages: Array.from(included.values()), rawDependencies, items, edges };
}

export async function readExportScope(app: App): Promise<ExportScopeFile> {
  const adapter = app.vault.adapter;
  const path = normalizePath(EXPORT_SCOPE_PATH);
  if (!(await adapter.exists(path))) return { schemaVersion: 1, bundles: {} };
  try {
    return ExportScopeFileSchema.parse(JSON.parse(await adapter.read(path)));
  } catch {
    return { schemaVersion: 1, bundles: {} };
  }
}

export async function writeExportScope(
  app: App,
  bundleId: string,
  update: {
    title?: string;
    seeds: string[];
    maxCompiledHops: number;
    items: Array<{ id: string; status: ReviewStatus; contentHash: string }>;
  },
): Promise<void> {
  const scope = await readExportScope(app);
  const existing = scope.bundles[bundleId]?.items ?? {};
  scope.bundles[bundleId] = {
    title: update.title ?? scope.bundles[bundleId]?.title,
    seeds: update.seeds,
    maxCompiledHops: update.maxCompiledHops,
    items: {},
  };

  for (const item of update.items) {
    scope.bundles[bundleId].items[item.id] = {
      status: item.status,
      contentHashAtReview: item.status === 'unreviewed'
        ? null
        : item.contentHash,
    };
  }

  for (const [id, item] of Object.entries(existing)) {
    if (!(id in scope.bundles[bundleId].items) && item.status === 'flagged') {
      scope.bundles[bundleId].items[id] = item;
    }
  }

  await ensureScopeDir(app);
  await app.vault.adapter.write(EXPORT_SCOPE_PATH, `${JSON.stringify(scope, null, 2)}\n`);
}

export async function summarizeBundleScope(app: App, bundleId: string): Promise<{
  seeds: number;
  approved: number;
  unreviewed: number;
  flagged: number;
}> {
  const scope = await readExportScope(app);
  const bundle = scope.bundles[bundleId];
  if (!bundle) return { seeds: 0, approved: 0, unreviewed: 0, flagged: 0 };
  const counts = { seeds: bundle.seeds.length, approved: 0, unreviewed: 0, flagged: 0 };
  for (const item of Object.values(bundle.items)) counts[item.status] += 1;
  return counts;
}

interface PersistedItem {
  status: ReviewStatus;
  contentHashAtReview: string | null;
}

function itemFromPage(page: PageRecord, persisted: PersistedItem | undefined, hasSavedScope: boolean, isSeed: boolean): ScopeItem {
  const { status, reviewNote } = effectiveStatus(page.contentHash, persisted, hasSavedScope);
  return {
    id: page.conceptId,
    kind: 'concept',
    title: typeof page.frontmatter.title === 'string' ? page.frontmatter.title : page.conceptId,
    path: page.sourcePath,
    body: page.body,
    frontmatter: page.frontmatter,
    citedBy: [],
    isSeed,
    status,
    contentHash: page.contentHash,
    contentHashAtReview: status === 'unreviewed' ? null : page.contentHash,
    reviewNote,
  };
}

function itemFromRaw(raw: RawDependency, persisted: PersistedItem | undefined, hasSavedScope: boolean): ScopeItem {
  const { status, reviewNote } = effectiveStatus(raw.contentHash, persisted, hasSavedScope);
  return {
    id: raw.path,
    kind: 'raw',
    title: raw.title,
    path: raw.path,
    body: raw.body,
    frontmatter: raw.frontmatter,
    citedBy: raw.citedBy,
    isSeed: false,
    status,
    contentHash: raw.contentHash,
    contentHashAtReview: status === 'unreviewed' ? null : raw.contentHash,
    reviewNote,
  };
}

function effectiveStatus(
  contentHash: string,
  persisted: PersistedItem | undefined,
  hasSavedScope: boolean,
): { status: ReviewStatus; reviewNote: ScopeItem['reviewNote'] } {
  if (!persisted) return { status: 'unreviewed', reviewNote: hasSavedScope ? 'new' : null };
  if (persisted.status === 'unreviewed') return { status: 'unreviewed', reviewNote: null };
  if (persisted.contentHashAtReview !== contentHash) return { status: 'unreviewed', reviewNote: 'changed' };
  return { status: persisted.status, reviewNote: null };
}

function addRawCitation(rawCitations: Map<string, Set<string>>, path: string, citedBy: string): void {
  const normalized = toPosixPath(path);
  if (isKnowledgePath(normalized) || !normalized.endsWith('.md')) return;
  if (!rawCitations.has(normalized)) rawCitations.set(normalized, new Set());
  rawCitations.get(normalized)!.add(citedBy);
}

async function readRawDependencies(app: App, rawCitations: Map<string, Set<string>>): Promise<RawDependency[]> {
  const dependencies: RawDependency[] = [];
  for (const [path, citedBy] of rawCitations.entries()) {
    const raw = await readRawDependency(app, path, Array.from(citedBy));
    if (raw) dependencies.push(raw);
  }
  return dependencies;
}

function rawPathsFromSources(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.replace(/^\[\[/, '').replace(/\]\]$/, ''))
    .map(toPosixPath)
    .filter((entry) => entry.endsWith('.md') && !entry.startsWith('http'));
}

async function ensureScopeDir(app: App): Promise<void> {
  if (!(await app.vault.adapter.exists('.knowlery'))) {
    await app.vault.adapter.mkdir('.knowlery');
  }
}

export function hashScopeBody(body: string): string {
  return sha256(body);
}
