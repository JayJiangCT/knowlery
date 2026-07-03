import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import matter from 'gray-matter';

/**
 * Live vault scanner for the deterministic retrieval engine (spec f2, §5.1 step 1).
 *
 * Runs on node:fs so it works with Obsidian closed; never imports the `obsidian`
 * module. There is deliberately no cached index: a scan of a personal vault costs
 * milliseconds, and a cache would reintroduce the staleness problem 0.6.0 exists to
 * eliminate (spec f2, §2).
 */

export const AGENT_DIRS = ['entities', 'concepts', 'comparisons', 'queries'] as const;

/** Files that instruct agents rather than carry knowledge; never lookup targets. */
export const INSTRUCTION_FILES = new Set(['KNOWLEDGE.md', 'SCHEMA.md']);

export type PageTier = 'agent' | 'bundle' | 'user';

/** One scoreable field group, prepared for both latin token and CJK substring matching. */
export interface FieldText {
  lower: string;
  counts: Map<string, number>;
}

export interface ScannedPage {
  path: string;
  title: string;
  type?: string;
  status?: string;
  updated?: string;
  description?: string;
  sources: string[];
  /** File modification time in ms; drives the mechanical staleness tier (spec f3, §4.1). */
  mtimeMs: number;
  tier: Exclude<PageTier, 'bundle'>;
  /** Field groups by spec weight: title+aliases (x4), tags+basename (x3), description (x2), body (x1). */
  titleAlias: FieldText;
  tagBasename: FieldText;
  descriptionField: FieldText;
  body: FieldText;
  /** Tokens of title + aliases + basename, for conservative prefix (abbreviation) matching. */
  prefixTokens: string[];
}

export interface ScannedBundleEntry {
  path: string;
  bundleId: string;
  title: string;
  description?: string;
  type?: string;
  titleAlias: FieldText;
  tagBasename: FieldText;
  descriptionField: FieldText;
  prefixTokens: string[];
}

export interface VaultSnapshot {
  root: string;
  pages: ScannedPage[];
  bundleEntries: ScannedBundleEntry[];
}

export function scanVault(root: string): VaultSnapshot {
  const pages: ScannedPage[] = [];
  for (const file of walkMarkdown(root)) {
    const path = relative(root, file).split('\\').join('/');
    if (INSTRUCTION_FILES.has(path)) continue;
    const page = loadPage(file, path);
    if (page) pages.push(page);
  }
  return { root, pages, bundleEntries: loadBundleEntries(root) };
}

function loadPage(file: string, path: string): ScannedPage | null {
  let raw: string;
  let mtimeMs: number;
  try {
    raw = readFileSync(file, 'utf8');
    mtimeMs = statSync(file).mtimeMs;
  } catch {
    return null;
  }
  return buildPageFromContent(path, raw, mtimeMs);
}

/**
 * Builds a ScannedPage from raw file content. Shared by the fs scanner (query.mjs) and
 * the plugin's live snapshot (spec f5, §5.2) — both transports parse content through
 * this one function, so page construction parity is structural.
 */
export function buildPageFromContent(path: string, rawContent: string, mtimeMs: number): ScannedPage | null {
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(rawContent);
  } catch {
    return null; // malformed frontmatter — skip rather than abort the scan
  }
  const fm = parsed.data as Record<string, unknown>;
  const title = typeof fm.title === 'string' && fm.title.trim() ? fm.title : titleFromBasename(path);
  const aliases = stringArray(fm.aliases);
  const tags = stringArray(fm.tags);
  const description = typeof fm.description === 'string' ? fm.description : undefined;
  const titleAlias = fieldText([title, ...aliases].join('\n'));
  const tagBasename = fieldText([...tags, basename(path, '.md')].join('\n'));
  return {
    path,
    title,
    type: typeof fm.type === 'string' ? fm.type : undefined,
    status: typeof fm.status === 'string' ? fm.status : undefined,
    updated: scalarDate(fm.updated),
    description,
    sources: stringArray(fm.sources),
    mtimeMs,
    tier: (AGENT_DIRS as readonly string[]).includes(path.split('/')[0]) ? 'agent' : 'user',
    titleAlias,
    tagBasename,
    descriptionField: fieldText(description ?? ''),
    body: fieldText(parsed.content),
    prefixTokens: tokenize([title, ...aliases, basename(path, '.md')].join('\n').toLowerCase()),
  };
}

export interface BundleRegistryEntry {
  title?: string;
  libraryPath?: string;
}

export interface AgentIndexConceptEntry {
  path?: string;
  title?: string;
  description?: string;
  type?: string;
  tags?: unknown;
}

/**
 * Unlike the /ask waterfall this replaces, every installed bundle's agent-index is
 * read — bundle relevance is decided per entry by score, not gated on the bundle title
 * happening to share words with the question (spec f2, §5.1 step 1).
 */
function loadBundleEntries(root: string): ScannedBundleEntry[] {
  const registryPath = join(root, '.knowlery', 'bundles.json');
  if (!existsSync(registryPath)) return [];
  let registry: { bundles?: Record<string, BundleRegistryEntry> };
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  } catch {
    return [];
  }
  const entries: ScannedBundleEntry[] = [];
  for (const [bundleId, bundle] of Object.entries(registry.bundles ?? {})) {
    if (!bundle.libraryPath) continue;
    const indexPath = join(root, bundle.libraryPath, 'agent-index.json');
    if (!existsSync(indexPath)) continue;
    let agentIndex: { concepts?: AgentIndexConceptEntry[] };
    try {
      agentIndex = JSON.parse(readFileSync(indexPath, 'utf8'));
    } catch {
      continue;
    }
    entries.push(...bundleEntriesFromIndex(bundleId, bundle.libraryPath, agentIndex));
  }
  return entries;
}

/** Shared by the fs scanner and the plugin's live snapshot (spec f5, §5.2). */
export function bundleEntriesFromIndex(
  bundleId: string,
  libraryPath: string,
  agentIndex: { concepts?: AgentIndexConceptEntry[] },
): ScannedBundleEntry[] {
  const entries: ScannedBundleEntry[] = [];
  for (const concept of agentIndex.concepts ?? []) {
    if (!concept.path || !concept.title) continue;
    const tags = stringArray(concept.tags);
    entries.push({
      path: `${libraryPath}/${concept.path}`,
      bundleId,
      title: concept.title,
      description: concept.description,
      type: concept.type,
      titleAlias: fieldText(concept.title),
      tagBasename: fieldText([...tags, basename(concept.path, '.md')].join('\n')),
      descriptionField: fieldText(concept.description ?? ''),
      prefixTokens: tokenize([concept.title, basename(concept.path, '.md')].join('\n').toLowerCase()),
    });
  }
  return entries;
}

function* walkMarkdown(dir: string): Generator<string> {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return;
  }
  for (const name of names) {
    const full = join(dir, name);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      if (name.startsWith('.')) continue; // .obsidian, .knowlery, .claude, .agents, ...
      yield* walkMarkdown(full);
    } else if (name.endsWith('.md')) {
      yield full;
    }
  }
}

export function fieldText(text: string): FieldText {
  const lower = text.toLowerCase();
  return { lower, counts: countTokens(lower) };
}

export function tokenize(lowerText: string): string[] {
  return lowerText.split(/[^a-z0-9]+/).filter((token) => token.length > 0);
}

export function countTokens(lowerText: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokenize(lowerText)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function scalarDate(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return undefined;
}

function titleFromBasename(path: string): string {
  return basename(path, '.md').split('-').join(' ');
}
