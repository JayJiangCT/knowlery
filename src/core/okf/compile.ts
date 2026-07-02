import { dirname, isAbsolute, join } from 'path';
import { mkdir, rm, writeFile as writeFsFile } from 'fs/promises';
import matter from 'gray-matter';
import type { App } from 'obsidian';
import { normalizePath } from 'obsidian';
import type { BundleFile, PageRecord, RawDependency } from './shared';
import { BUNDLE_MARKER, conceptIdFromPath, isKnowledgePath, safeMatter, toPosixPath } from './shared';
import type { CompileOptions, CompileResult, UnresolvedLink } from '../../types';
import { CompileOptionsSchema } from '../../types';
import { collectBundleInputs, readRawDependency, readSchemaMd } from './collect';
import { mapFrontmatterToOkf } from './frontmatter-map';
import { stringifyYaml, projectIndexes, type IndexEntryInput } from './index-project';
import { projectLog } from './log-project';
import { buildBundleManifest } from './manifest';
import { checkConformance } from './conformance';
import { buildReadme, buildSourceCopy } from './bundle-docs';
import { collectRawBodyUnresolvedLinks, convertWikilinks } from './wikilink';

export async function compileBundle(app: App, rawOptions: CompileOptions, now = new Date()): Promise<CompileResult> {
  const options = CompileOptionsSchema.parse(rawOptions);
  const inputs = await collectBundleInputs(app);
  const approvedConceptIds = new Set(options.approvedConceptIds);
  const approvedRawPaths = new Set(options.approvedRawPaths.map(toPosixPath));
  const pages = inputs.pages.filter((page) => approvedConceptIds.has(page.conceptId));
  const rawSources = await readApprovedRawDependencies(app, pages, approvedRawPaths);
  const files: BundleFile[] = [];
  const indexEntries: IndexEntryInput[] = [];
  const unresolvedLinks: UnresolvedLink[] = [];
  const releasedAt = now.toISOString();
  let wikilinksConverted = 0;

  for (const page of pages) {
    const mapped = mapFrontmatterToOkf(page, { includeSources: options.includeSources });
    const converted = convertWikilinks(page, approvedConceptIds, approvedRawPaths);
    wikilinksConverted += converted.converted;
    unresolvedLinks.push(...converted.unresolved);
    files.push({
      path: `${page.conceptId}.md`,
      content: stringifyYaml(converted.body, mapped.frontmatter),
      frontmatter: mapped.frontmatter,
      sourceConceptId: page.conceptId,
      kind: 'concept',
    });
    indexEntries.push({
      conceptId: page.conceptId,
      path: `${page.conceptId}.md`,
      frontmatter: mapped.frontmatter,
      backlinks: bundleConceptIds(page.backlinks, approvedConceptIds),
      outlinks: page.outlinks
        .map((link) => link.targetConceptId)
        .filter((id): id is string => id !== null && approvedConceptIds.has(id)),
    });
  }

  for (const raw of rawSources) {
    unresolvedLinks.push(...collectRawBodyUnresolvedLinks(raw));
    files.push({
      path: `_sources/${raw.path}`,
      content: buildSourceCopy(raw),
      kind: 'source',
    });
  }

  if (options.includeSchema) {
    const schema = await readSchemaMd(app);
    if (schema) {
      const reference = buildReferenceFile('SCHEMA.md', schema, 'SCHEMA');
      files.push(reference);
      indexEntries.push({
        conceptId: 'SCHEMA',
        path: 'SCHEMA.md',
        frontmatter: { type: 'Reference', title: 'SCHEMA' },
        backlinks: [],
        outlinks: [],
      });
    }
  }

  const indexProjection = projectIndexes({
    title: options.title,
    entries: indexEntries,
    rawSources,
    unresolvedLinks,
    now,
    staleThresholdDays: options.staleThresholdDays ?? 90,
  });
  files.push({ path: 'index.md', content: indexProjection.rootIndex, kind: 'index' });
  files.push(...indexProjection.dirIndexes);
  files.push({
    path: 'log.md',
    content: projectLog(inputs.activity, { includeFullLog: options.includeFullLog, releasedAt }),
    kind: 'log',
  });
  const manifest = buildBundleManifest({
    id: options.bundleId,
    title: options.title,
    version: options.version,
    creator: options.creator,
    releasedAt,
    license: options.license,
    knowleryVersion: '0.5.0',
    conceptCount: files.filter((file) => file.kind === 'concept').length,
    files,
  });

  files.push({ path: 'README.md', content: buildReadme(manifest), kind: 'readme' });
  files.push({
    path: 'agent-index.json',
    content: `${JSON.stringify(indexProjection.agentIndex, null, 2)}\n`,
    kind: 'agent-index',
  });
  files.push({
    path: BUNDLE_MARKER,
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    kind: 'manifest',
  });

  const conformance = checkConformance(files);
  await writeBundleFiles(app, options.targetDir, files, options.overwrite);

  return {
    manifest,
    conformance,
    conceptCount: pages.length,
    rawSourceCount: rawSources.length,
    wikilinksConverted,
    unresolvedLinks,
    staleCount: indexProjection.staleCount,
    targetDir: options.targetDir,
  };
}

async function readApprovedRawDependencies(
  app: App,
  pages: PageRecord[],
  approvedRawPaths: Set<string>,
): Promise<RawDependency[]> {
  const citedBy = new Map<string, Set<string>>();
  for (const page of pages) {
    for (const link of page.outlinks) {
      if (!link.targetPath) continue;
      const path = toPosixPath(link.targetPath);
      if (approvedRawPaths.has(path)) addCitation(citedBy, path, page.conceptId);
    }
    for (const path of rawPathsFromSources(page.frontmatter.sources)) {
      if (approvedRawPaths.has(path)) addCitation(citedBy, path, page.conceptId);
    }
  }

  const rawSources: RawDependency[] = [];
  for (const [path, citations] of citedBy.entries()) {
    const raw = await readRawDependency(app, path, Array.from(citations));
    if (raw) rawSources.push(raw);
  }
  return rawSources;
}

async function writeBundleFiles(app: App, targetDir: string, files: BundleFile[], overwrite: boolean): Promise<void> {
  assertSafeTarget(targetDir);
  const normalizedTarget = toPosixPath(targetDir);
  if (isAbsolute(targetDir)) {
    if (overwrite) await rm(targetDir, { recursive: true, force: true });
    else await assertDoesNotExistFs(targetDir);
    await mkdir(targetDir, { recursive: true });
    for (const file of files) {
      const fullPath = join(targetDir, file.path);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFsFile(fullPath, file.content, 'utf8');
    }
    return;
  }

  const adapter = app.vault.adapter;
  if (await adapter.exists(normalizedTarget)) {
    if (!overwrite) throw new Error(`Export target already exists: ${normalizedTarget}`);
    const removable = adapter as typeof adapter & { rmdir?: (path: string, recursive?: boolean) => Promise<void> };
    if (!removable.rmdir) throw new Error(`Export target already exists and cannot be removed: ${normalizedTarget}`);
    await removable.rmdir(normalizedTarget, true);
  }
  await ensureVaultDir(app, normalizedTarget);
  for (const file of files) {
    const path = normalizePath(`${normalizedTarget}/${file.path}`);
    assertSafeWritePath(path);
    await ensureVaultDir(app, dirname(path));
    await adapter.write(path, file.content);
  }
}

function buildReferenceFile(path: string, content: string, title: string): BundleFile {
  const parsed = safeMatter(content);
  const data = { ...parsed.data, type: 'Reference', title };
  return {
    path,
    content: matter.stringify(parsed.content.trimStart(), data),
    kind: 'reference',
  };
}

async function ensureVaultDir(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!normalized || normalized === '.' || normalized === '/' || await app.vault.adapter.exists(normalized)) return;
  await ensureVaultDir(app, dirname(normalized));
  await app.vault.adapter.mkdir(normalized);
}

async function assertDoesNotExistFs(path: string): Promise<void> {
  try {
    await mkdir(path, { recursive: false });
    await rm(path, { recursive: true, force: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error(`Export target already exists: ${path}`);
    }
  }
}

function assertSafeTarget(targetDir: string): void {
  const normalized = toPosixPath(targetDir);
  if (!normalized || normalized === '.' || normalized === '/') throw new Error('Export target must be a directory.');
  assertSafeWritePath(normalized);
}

function assertSafeWritePath(path: string): void {
  const normalized = toPosixPath(path);
  if (isKnowledgePath(normalized) || normalized === 'SCHEMA.md' || normalized === 'KNOWLEDGE.md' || normalized === 'INDEX.base') {
    throw new Error(`Refusing to write into source knowledge path: ${path}`);
  }
}

function addCitation(citedBy: Map<string, Set<string>>, path: string, conceptId: string): void {
  if (!citedBy.has(path)) citedBy.set(path, new Set());
  citedBy.get(path)!.add(conceptId);
}

function rawPathsFromSources(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map(toPosixPath)
    .filter((entry) => entry.endsWith('.md') && !isKnowledgePath(entry));
}

function bundleConceptIds(sourcePaths: string[], approvedConceptIds: Set<string>): string[] {
  return sourcePaths
    .filter((path) => isKnowledgePath(path))
    .map((path) => conceptIdFromPath(path))
    .filter((id) => approvedConceptIds.has(id));
}
