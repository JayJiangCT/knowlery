import type { ExportScopeFile, ReviewStatus } from '../../types';
import { ExportScopeFileSchema } from '../../types';
import type { VaultFs } from '../vault-fs';
import { normalizeVaultPath } from '../vault-fs';
import { collectBundleInputs, readRawDependency, type BundleSource } from './collect';
import type { PageRecord, RawDependency } from './shared';
import { DEFAULT_MAX_COMPILED_HOPS, EXPORT_SCOPE_PATH, isKnowledgePath, toPosixPath } from './shared';
import { sha256, sha256Bytes } from './hash';
import { buildAttachmentIndex, collectAttachmentEmbedTargets, collectUnsupportedEmbedTargets } from './attachments';

export interface ScopeItem {
  id: string;
  kind: 'concept' | 'raw' | 'attachment';
  title: string;
  path: string;
  body: string;
  frontmatter: Record<string, unknown>;
  citedBy: string[];
  isSeed: boolean;
  status: ReviewStatus;
  contentHash: string;
  contentHashAtReview: string | null;
  /** Attachment items only: the file's byte size, for checklist display. */
  sizeBytes?: number;
  /**
   * Incremental-review note (§8.2 callouts): 'new' = entered the closure
   * since the last saved scope; 'changed' = had a saved approval/flag that
   * hash-invalidation reverted. Null on first-ever scope build.
   */
  reviewNote: 'new' | 'changed' | null;
}

/**
 * Embed problems surfaced at scope build (spec 1.3.1 f1, §4.1) —
 * presentation-level, never persisted: ambiguity refuses the export,
 * missing and unsupported targets become checklist notes.
 */
export interface EmbedIssues {
  ambiguous: Array<{ owner: string; target: string; candidates: string[] }>;
  missing: Array<{ owner: string; target: string }>;
  unsupported: Array<{ owner: string; target: string }>;
}

export interface ScopeClosure {
  pages: PageRecord[];
  rawDependencies: RawDependency[];
  items: ScopeItem[];
  edges: Array<{ from: string; to: string; kind: 'compiled' | 'raw' }>;
  embedIssues: EmbedIssues;
}

export async function buildClosure(
  source: BundleSource,
  bundleId: string,
  seeds: string[],
  maxCompiledHops = DEFAULT_MAX_COMPILED_HOPS,
): Promise<ScopeClosure> {
  const { pages } = await collectBundleInputs(source);
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

  const rawDependencies = await readRawDependencies(source.fs, rawCitations);
  const scopeFile = await readExportScope(source.fs);
  const bundle = scopeFile.bundles[bundleId];
  const persistedItems = bundle?.items ?? {};
  const hasSavedScope = bundle !== undefined;
  const seedSet = new Set(seeds);
  const items: ScopeItem[] = [
    ...Array.from(included.values()).map((page) => itemFromPage(page, persistedItems[page.conceptId], hasSavedScope, seedSet.has(page.conceptId))),
    ...rawDependencies.map((raw) => itemFromRaw(raw, persistedItems[raw.path], hasSavedScope)),
  ];

  // Attachment discovery (spec 1.3.1 f1, §4.1): embeds of in-scope items,
  // resolved through the shared index. Owner statuses are known at this
  // point — an attachment whose every owner is flagged never enters scope
  // (flagging a page flags its evidence trail with it).
  const statusById = new Map(items.map((item) => [item.id, item.status]));
  const attachmentIndex = await buildAttachmentIndex(source.fs, source.configDir);
  const owners = new Map<string, Set<string>>();
  const embedIssues: EmbedIssues = { ambiguous: [], missing: [], unsupported: [] };
  const embedSources: Array<{ ownerId: string; body: string }> = [
    ...Array.from(included.values()).map((page) => ({ ownerId: page.conceptId, body: page.body })),
    ...rawDependencies.map((raw) => ({ ownerId: raw.path, body: raw.body })),
  ];
  const seenIssues = new Set<string>();
  for (const { ownerId, body } of embedSources) {
    if (statusById.get(ownerId) === 'flagged') continue;
    for (const target of collectAttachmentEmbedTargets(body)) {
      const resolution = attachmentIndex.resolve(target);
      if (resolution.kind === 'path') {
        if (!owners.has(resolution.path)) owners.set(resolution.path, new Set());
        owners.get(resolution.path)!.add(ownerId);
      } else if (seenIssues.add(`${ownerId}:${target}`)) {
        if (resolution.kind === 'ambiguous') embedIssues.ambiguous.push({ owner: ownerId, target, candidates: resolution.candidates });
        else embedIssues.missing.push({ owner: ownerId, target });
      }
    }
    for (const target of collectUnsupportedEmbedTargets(body)) {
      if (seenIssues.add(`${ownerId}:${target}`)) embedIssues.unsupported.push({ owner: ownerId, target });
    }
  }

  for (const [path, citedBy] of [...owners.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const item = await attachmentItem(source.fs, path, Array.from(citedBy).sort(), persistedItems[path], hasSavedScope);
    if (item) items.push(item);
  }

  items.sort((a, b) => a.title.localeCompare(b.title));
  return { pages: Array.from(included.values()), rawDependencies, items, edges, embedIssues };
}

/**
 * The shared pre-export gate (spec 1.3.1 f1, acceptance round: one gate,
 * both shells). Pure evaluation over a closure — the caller must pass a
 * closure built AFTER the latest review-state persist, because freshness
 * is the whole point: buildClosure recomputes content hashes, so an
 * approval whose file changed (a re-screenshotted attachment, an edited
 * page) has already been reverted to unreviewed/`changed` by the time
 * this gate looks. A shell that compiles from its own cached UI state
 * instead of the gate's approved sets recreates the ships-unreviewed-bytes
 * hole this exists to close.
 */
export interface ExportGateResult {
  ready: boolean;
  ambiguous: EmbedIssues['ambiguous'];
  unreviewed: ScopeItem[];
  approvedConceptIds: string[];
  approvedRawPaths: string[];
  approvedAttachmentPaths: string[];
}

export function evaluateExportGate(closure: ScopeClosure): ExportGateResult {
  const unreviewed = closure.items.filter((item) => item.status === 'unreviewed');
  const approved = closure.items.filter((item) => item.status === 'approved');
  const ambiguous = closure.embedIssues.ambiguous;
  return {
    ready: unreviewed.length === 0 && ambiguous.length === 0,
    ambiguous,
    unreviewed,
    approvedConceptIds: approved.filter((item) => item.kind === 'concept').map((item) => item.id),
    approvedRawPaths: approved.filter((item) => item.kind === 'raw').map((item) => item.id),
    approvedAttachmentPaths: approved.filter((item) => item.kind === 'attachment').map((item) => item.id),
  };
}

/** Canonical export target for a bundle+version — the single derivation both shells use. */
export function exportTargetDir(bundleId: string, version: string): string {
  return `.knowlery/exports/${bundleId}-${version}`;
}

/**
 * Resume defaults (acceptance round 3): resuming a saved bundle must
 * restore version and target dir from ITS state — the modal's resume flow
 * once kept the defaults derived from the initial bundle id, so a resumed
 * `creator.acceptance.f1` exported into `creator.my.knowledge.base-0.1.0`
 * and, with overwrite, could clobber another bundle's export.
 */
export function resumeExportDefaults(
  saved: { lastVersion?: string } | undefined,
  bundleId: string,
): { version: string; targetDir: string } {
  const version = saved?.lastVersion ?? '0.1.0';
  return { version, targetDir: exportTargetDir(bundleId, version) };
}

export async function readExportScope(fs: VaultFs): Promise<ExportScopeFile> {
  const path = normalizeVaultPath(EXPORT_SCOPE_PATH);
  if (!(await fs.exists(path))) return { schemaVersion: 1, bundles: {} };
  try {
    return ExportScopeFileSchema.parse(JSON.parse(await fs.read(path)));
  } catch {
    return { schemaVersion: 1, bundles: {} };
  }
}

export async function writeExportScope(
  fs: VaultFs,
  bundleId: string,
  update: {
    title?: string;
    seeds: string[];
    maxCompiledHops: number;
    items: Array<{ id: string; status: ReviewStatus; contentHash: string }>;
  },
): Promise<void> {
  const scope = await readExportScope(fs);
  const existing = scope.bundles[bundleId]?.items ?? {};
  scope.bundles[bundleId] = {
    title: update.title ?? scope.bundles[bundleId]?.title,
    seeds: update.seeds,
    maxCompiledHops: update.maxCompiledHops,
    // Persisted publish/version metadata survives scope rewrites (spec 0.9 f2, §4.2).
    lastVersion: scope.bundles[bundleId]?.lastVersion,
    publish: scope.bundles[bundleId]?.publish,
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

  await ensureScopeDir(fs);
  await fs.write(EXPORT_SCOPE_PATH, `${JSON.stringify(scope, null, 2)}\n`);
}

/** Merge publish/version metadata into a bundle's scope entry without touching review state. */
export async function writeBundleMeta(
  fs: VaultFs,
  bundleId: string,
  meta: { lastVersion?: string; publish?: import('../../types').PublishConfig },
): Promise<void> {
  const scope = await readExportScope(fs);
  const bundle = scope.bundles[bundleId];
  if (!bundle) return;
  if (meta.lastVersion !== undefined) bundle.lastVersion = meta.lastVersion;
  if (meta.publish !== undefined) bundle.publish = meta.publish;
  await fs.write(EXPORT_SCOPE_PATH, `${JSON.stringify(scope, null, 2)}\n`);
}

export async function summarizeBundleScope(fs: VaultFs, bundleId: string): Promise<{
  seeds: number;
  approved: number;
  unreviewed: number;
  flagged: number;
}> {
  const scope = await readExportScope(fs);
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

/**
 * Attachment scope item (spec 1.3.1 f1, §4.2): exactly the persisted
 * fields every item has — status and contentHashAtReview, here computed
 * over the bytes, so a re-exported screenshot invalidates its approval
 * like an edited page. No new scope-state fields, no migration.
 */
async function attachmentItem(
  fs: VaultFs,
  path: string,
  citedBy: string[],
  persisted: PersistedItem | undefined,
  hasSavedScope: boolean,
): Promise<ScopeItem | null> {
  let data: ArrayBuffer;
  try {
    data = await fs.readBinary(normalizeVaultPath(path));
  } catch {
    return null;
  }
  const bytes = new Uint8Array(data);
  const contentHash = sha256Bytes(bytes);
  const { status, reviewNote } = effectiveStatus(contentHash, persisted, hasSavedScope);
  return {
    id: path,
    kind: 'attachment',
    title: path.split('/').pop() ?? path,
    path,
    body: '',
    frontmatter: {},
    citedBy,
    isSeed: false,
    status,
    contentHash,
    contentHashAtReview: status === 'unreviewed' ? null : contentHash,
    sizeBytes: bytes.byteLength,
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

async function readRawDependencies(fs: VaultFs, rawCitations: Map<string, Set<string>>): Promise<RawDependency[]> {
  const dependencies: RawDependency[] = [];
  for (const [path, citedBy] of rawCitations.entries()) {
    const raw = await readRawDependency(fs, path, Array.from(citedBy));
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

async function ensureScopeDir(fs: VaultFs): Promise<void> {
  if (!(await fs.exists('.knowlery'))) {
    await fs.mkdir('.knowlery');
  }
}

export function hashScopeBody(body: string): string {
  return sha256(body);
}
