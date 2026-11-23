import { createHash } from 'node:crypto';
import type { Config } from './config';
import { invalidInvocation, KnowleryError } from './errors';
import type { ExtractionOptions } from './extract';
import { inventoryList, resolveRawSource, type Format, type InventoryItem } from './inventory';
import { listPages, readPage } from './page/files';
import { citedSourceKeys } from './page/freshness';
import { relativePath } from './paths';

export type StaleCategory = 'changed' | 'missing' | 'moved' | 'unreadable' | 'unreferenced';

export interface StalePageRef {
  page: string;
  keys: string[];
}

export interface StaleChangedItem {
  category: 'changed';
  path: string;
  version: string;
  pages: StalePageRef[];
  pages_more: number;
}

export interface StaleMovedItem {
  category: 'moved';
  path: string;
  to: string;
  pages: StalePageRef[];
  pages_more: number;
}

export interface StaleMissingItem {
  category: 'missing';
  path: string;
  pages: StalePageRef[];
  pages_more: number;
}

export interface StaleUnreadableItem {
  category: 'unreadable';
  path: string;
  state: 'unreadable' | 'too_large';
  pages: StalePageRef[];
  pages_more: number;
}

export interface StaleUnreferencedItem {
  category: 'unreferenced';
  path: string;
  format: Format;
  size: number;
}

export type StaleItem =
  | StaleChangedItem
  | StaleMissingItem
  | StaleMovedItem
  | StaleUnreadableItem
  | StaleUnreferencedItem;

export interface StaleCounts {
  sources: number;
  pages: number;
  changed: number;
  missing: number;
  moved: number;
  unreadable: number;
  unreferenced: number;
}

export interface StaleOptions extends Pick<ExtractionOptions, 'registry' | 'ceiling'> {
  scope?: string;
  limit?: number;
  offset?: number;
  snapshot?: string;
}

export interface StaleResult {
  counts: StaleCounts;
  items: StaleItem[];
  offset: number;
  returned: number;
  more: boolean;
  next: { offset: number; snapshot: string } | null;
  snapshot: string;
  cache: { hashed: number; reused: number };
  warnings: string[];
}

interface LiveRef {
  page: string;
  key: string;
  sha256: string;
}

const MAX_PAGES_PER_ITEM = 10;

const CATEGORY_ORDER: Record<StaleCategory, number> = {
  changed: 0,
  missing: 1,
  moved: 2,
  unreadable: 3,
  unreferenced: 4,
};

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function inScope(path: string, scope: string): boolean {
  return scope === '' || path === scope || path.startsWith(`${scope}/`);
}

function buildPages(refs: LiveRef[]): { pages: StalePageRef[]; pages_more: number } {
  const byPage = new Map<string, Set<string>>();
  for (const ref of refs) {
    let keys = byPage.get(ref.page);
    if (!keys) {
      keys = new Set<string>();
      byPage.set(ref.page, keys);
    }
    keys.add(ref.key);
  }
  const allPages: StalePageRef[] = [...byPage.entries()]
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([page, keys]) => ({ page, keys: [...keys] }));
  const pages = allPages.slice(0, MAX_PAGES_PER_ITEM);
  return { pages, pages_more: Math.max(0, allPages.length - pages.length) };
}

export async function staleList(
  root: string,
  config: Config,
  options: StaleOptions = {},
): Promise<StaleResult> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0) {
    invalidInvocation('Invalid stale pagination.');
  }

  let scope = '';
  if (options.scope !== undefined) {
    const resolvedScope = await resolveRawSource(root, options.scope, config);
    scope = relativePath(root, resolvedScope);
  }

  const inv = await inventoryList(root, config, {
    ceiling: options.ceiling,
    registry: options.registry,
  });

  const inventoryByPath = new Map<string, InventoryItem>();
  const pathsByHash = new Map<string, string[]>();
  for (const item of inv.items) {
    inventoryByPath.set(item.path, item);
    const list = pathsByHash.get(item.sha256);
    if (list) list.push(item.path);
    else pathsByHash.set(item.sha256, [item.path]);
  }

  const pagePaths = await listPages(root);
  const liveRefsByPath = new Map<string, LiveRef[]>();
  const anyReferencedPaths = new Set<string>();

  for (const pagePath of pagePaths) {
    const page = await readPage(root, pagePath);
    const citedKeys = citedSourceKeys(page);
    const invalidSourceLines = new Set(
      page.problems
        .filter((problem) => problem.code === 'source_path_invalid')
        .map((problem) => problem.line),
    );

    for (const source of page.sources) {
      if (invalidSourceLines.has(source.line)) continue;
      anyReferencedPaths.add(source.path);
      if (!citedKeys.has(source.key)) continue;

      let refs = liveRefsByPath.get(source.path);
      if (!refs) {
        refs = [];
        liveRefsByPath.set(source.path, refs);
      }
      refs.push({
        page: pagePath,
        key: source.key,
        sha256: `sha256:${source.sha256}`,
      });
    }
  }

  const allItems: StaleItem[] = [];
  const classifiedPaths = new Set<string>();
  const movedTargets = new Set<string>();

  // 1. Paths with live citations: changed, moved, or missing.
  for (const [sourcePath, refs] of liveRefsByPath.entries()) {
    const invItem = inventoryByPath.get(sourcePath);
    if (invItem) {
      const changedRefs = refs.filter((ref) => ref.sha256 !== invItem.sha256);
      if (changedRefs.length > 0) {
        const { pages, pages_more } = buildPages(changedRefs);
        allItems.push({
          category: 'changed',
          path: sourcePath,
          version: invItem.sha256,
          pages,
          pages_more,
        });
        classifiedPaths.add(sourcePath);
      }
      continue;
    }

    // Not an inventoried source: moved if a pinned hash uniquely matches one inventoried source.
    const matchedTargets = new Set<string>();
    let ambiguous = false;
    for (const ref of refs) {
      const matches = pathsByHash.get(ref.sha256);
      if (!matches || matches.length === 0) continue;
      if (matches.length > 1) {
        ambiguous = true;
        break;
      }
      matchedTargets.add(matches[0]);
    }

    const { pages, pages_more } = buildPages(refs);
    if (!ambiguous && matchedTargets.size === 1) {
      const [to] = matchedTargets;
      movedTargets.add(to);
      allItems.push({
        category: 'moved',
        path: sourcePath,
        to,
        pages,
        pages_more,
      });
    } else {
      allItems.push({
        category: 'missing',
        path: sourcePath,
        pages,
        pages_more,
      });
    }
    classifiedPaths.add(sourcePath);
  }

  // 2. Remaining inventoried sources: unreadable or unreferenced.
  for (const invItem of inv.items) {
    if (classifiedPaths.has(invItem.path)) continue;

    if (invItem.extraction === 'unreadable' || invItem.extraction === 'too_large') {
      const refs = liveRefsByPath.get(invItem.path) ?? [];
      const { pages, pages_more } = buildPages(refs);
      allItems.push({
        category: 'unreadable',
        path: invItem.path,
        state: invItem.extraction,
        pages,
        pages_more,
      });
      classifiedPaths.add(invItem.path);
      continue;
    }

    if (!anyReferencedPaths.has(invItem.path) && !movedTargets.has(invItem.path)) {
      allItems.push({
        category: 'unreferenced',
        path: invItem.path,
        format: invItem.format,
        size: invItem.size,
      });
    }
  }

  // Filter by scope.
  const scopedItems = scope === ''
    ? allItems
    : allItems.filter((item) => {
        if (inScope(item.path, scope)) return true;
        if (item.category === 'moved' && inScope(item.to, scope)) return true;
        return false;
      });

  scopedItems.sort((a, b) => {
    const catCmp = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
    if (catCmp !== 0) return catCmp;
    return compareStrings(a.path, b.path);
  });

  const counts: StaleCounts = {
    sources: scope === '' ? inv.items.length : inv.items.filter((item) => inScope(item.path, scope)).length,
    pages: pagePaths.length,
    changed: 0,
    missing: 0,
    moved: 0,
    unreadable: 0,
    unreferenced: 0,
  };
  for (const item of scopedItems) {
    counts[item.category]++;
  }

  const snapshot = `sha256:${createHash('sha256').update(JSON.stringify(scopedItems)).digest('hex')}`;
  if (options.snapshot !== undefined && options.snapshot !== snapshot) {
    throw new KnowleryError(
      'stale_version',
      'Stale results changed since the previous page.',
      'Start again at offset 0.',
    );
  }

  const pageItems: StaleItem[] = [];
  let bytes = 0;
  for (let i = offset; i < scopedItems.length && pageItems.length < limit; i++) {
    const size = Buffer.byteLength(JSON.stringify(scopedItems[i]), 'utf8') + 1;
    if (pageItems.length && bytes + size > 12288) break;
    pageItems.push(scopedItems[i]);
    bytes += size;
  }
  const more = offset + pageItems.length < scopedItems.length;

  return {
    counts,
    items: pageItems,
    offset,
    returned: pageItems.length,
    more,
    next: more ? { offset: offset + pageItems.length, snapshot } : null,
    snapshot,
    cache: inv.cache,
    warnings: inv.warnings,
  };
}
