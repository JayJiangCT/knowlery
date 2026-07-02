import matter from 'gray-matter';
import type { ActivityRecord, ConformanceIssue, KnowledgeDir, OkfFrontmatter } from '../../types';

/**
 * gray-matter throws on YAML-hostile content — e.g. a note whose body opens
 * with a `---` horizontal rule, making prose parse as "frontmatter" (seen on
 * a real vault: "incomplete explicit mapping pair … at line 29"). One broken
 * page must never take down collection/compile (D14: graceful degradation),
 * so fall back to "no frontmatter, full content as body".
 */
export function safeMatter(content: string): { data: Record<string, unknown>; content: string } {
  try {
    const parsed = matter(content);
    return { data: parsed.data as Record<string, unknown>, content: parsed.content };
  } catch {
    return { data: {}, content };
  }
}

export const OKF_VERSION = '0.1';
export const KNOWLERY_BUNDLE_SCHEMA_VERSION = 1;
// Real-vault calibration (Jay WorkSpace, 2026-07-02): a single seed at 2 hops
// reached 138 items / 100 raw dependencies — the vault is far denser than the
// spec's initial estimate. 1 hop is the safe default; the UI exposes 2-3.
export const DEFAULT_MAX_COMPILED_HOPS = 1;
export const EXPORT_SCOPE_PATH = '.knowlery/export-scope.json';
export const BUNDLE_MARKER = 'knowlery-bundle.json';

export const OKF_TYPE_BY_DIR: Record<KnowledgeDir, string> = {
  entities: 'Entity',
  concepts: 'Concept',
  comparisons: 'Comparison',
  queries: 'Query',
};

export interface ResolvedLink {
  raw: string;
  targetPath: string | null;
  targetConceptId: string | null;
  heading?: string;
  alias?: string;
  embed: boolean;
}

export interface PageRecord {
  conceptId: string;
  sourcePath: string;
  dir: KnowledgeDir;
  frontmatter: Record<string, unknown>;
  body: string;
  outlinks: ResolvedLink[];
  backlinks: string[];
  contentHash: string;
}

export interface RawDependency {
  path: string;
  title: string;
  body: string;
  frontmatter: Record<string, unknown>;
  citedBy: string[];
  contentHash: string;
}

export interface BundleInput {
  pages: PageRecord[];
  activity: ActivityRecord[];
}

export interface BundleFile {
  path: string;
  content: string;
  frontmatter?: OkfFrontmatter;
  sourceConceptId?: string;
  kind: 'concept' | 'reference' | 'index' | 'log' | 'manifest' | 'agent-index' | 'readme' | 'source';
}

export interface FrontmatterMapResult {
  frontmatter: OkfFrontmatter;
  warnings: ConformanceIssue[];
}

export function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/+/, '');
}

export function stripMdExtension(path: string): string {
  return path.endsWith('.md') ? path.slice(0, -3) : path;
}

export function conceptIdFromPath(path: string): string {
  return stripMdExtension(toPosixPath(path));
}

export function isKnowledgePath(path: string): boolean {
  const normalized = toPosixPath(path);
  return ['entities/', 'concepts/', 'comparisons/', 'queries/'].some((prefix) => normalized.startsWith(prefix));
}

export function dirFromConceptId(conceptId: string): KnowledgeDir | null {
  const first = conceptId.split('/')[0];
  if (first === 'entities' || first === 'concepts' || first === 'comparisons' || first === 'queries') {
    return first;
  }
  return null;
}

export function titleFromPath(path: string): string {
  const filename = toPosixPath(path).split('/').pop() ?? path;
  return filename.replace(/\.md$/i, '');
}

export function encodeMarkdownPath(path: string): string {
  return toPosixPath(path).split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

/**
 * YAML parses unquoted dates (`updated: 2026-07-01`) into Date objects —
 * the dominant form in real vaults. Normalize both shapes to ISO strings
 * (spec §5.2 "normalize to ISO 8601").
 */
export function toIsoString(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return undefined;
}

export function sanitizeBundleId(creatorName: string, kbName: string): string {
  return `${creatorName || 'creator'}.${kbName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'knowledge.bundle';
}

export function normalizeItemText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(normalizeItemText).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(normalizeItemText).join(' ');
  return '';
}
