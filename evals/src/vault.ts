import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import matter from 'gray-matter';
import type { BundleIndexEntry, FixtureBundle, FixturePage, FixtureVault, SourceTier } from './types';

const AGENT_DIRS = ['entities', 'concepts', 'comparisons', 'queries'];

/**
 * Minimum frontmatter core per agent page type. Deliberately duplicated from
 * src/core/vault-health.ts (REQUIRED_FRONTMATTER) so the harness never imports plugin code —
 * F1 guarantees zero src/ changes and zero obsidian-module dependencies. Keep in sync by hand.
 */
const MIN_FRONTMATTER: Record<string, string[]> = {
  entity: ['type', 'created'],
  concept: ['type', 'created'],
  comparison: ['type', 'items', 'created'],
  query: ['type', 'status', 'created'],
};

export function loadFixtureVault(root: string): FixtureVault {
  const pages: FixturePage[] = [];
  for (const file of walkMarkdown(root)) {
    const path = relative(root, file).split('\\').join('/');
    if (path === 'KNOWLEDGE.md' || path === 'SCHEMA.md') continue; // instruction files, not lookup targets
    pages.push(loadPage(file, path));
  }
  validateAgentPages(pages);
  return { root, pages, bundles: loadBundles(root) };
}

function loadPage(file: string, path: string): FixturePage {
  const parsed = matter(readFileSync(file, 'utf8'));
  const fm = parsed.data as Record<string, unknown>;
  const title = typeof fm.title === 'string' ? fm.title : titleFromBasename(path);
  const aliases = stringArray(fm.aliases);
  const tags = stringArray(fm.tags);
  const tier: Exclude<SourceTier, 'bundle'> = AGENT_DIRS.includes(path.split('/')[0]) ? 'agent' : 'user';
  const searchText = [
    title,
    aliases.join(' '),
    tags.join(' '),
    basename(path, '.md'),
    parsed.content,
  ]
    .join('\n')
    .toLowerCase();
  return {
    path,
    title,
    type: typeof fm.type === 'string' ? fm.type : undefined,
    tags,
    aliases,
    status: typeof fm.status === 'string' ? fm.status : undefined,
    created: scalarDate(fm.created),
    updated: scalarDate(fm.updated),
    tier,
    raw: fm,
    searchText,
    latinCounts: countLatinTokens(searchText),
  };
}

function validateAgentPages(pages: FixturePage[]): void {
  const problems: string[] = [];
  for (const page of pages) {
    if (page.tier !== 'agent') continue;
    const required = page.type ? MIN_FRONTMATTER[page.type] : undefined;
    if (!required) {
      problems.push(`${page.path}: agent page has unknown type "${page.type ?? '(none)'}"`);
      continue;
    }
    for (const field of required) {
      if (page.raw[field] === undefined || page.raw[field] === null || page.raw[field] === '') {
        problems.push(`${page.path}: missing required frontmatter field "${field}"`);
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`Fixture vault violates the minimum frontmatter core:\n${problems.join('\n')}`);
  }
}

function loadBundles(root: string): FixtureBundle[] {
  const registryPath = join(root, '.knowlery', 'bundles.json');
  let registry: { bundles: Record<string, { title: string; libraryPath: string }> };
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf8')) as { bundles: Record<string, { title: string; libraryPath: string }> };
  } catch {
    return [];
  }
  return Object.entries(registry.bundles).map(([id, entry]) => {
    const agentIndex = JSON.parse(
      readFileSync(join(root, entry.libraryPath, 'agent-index.json'), 'utf8'),
    ) as { concepts: { path: string; title: string; description?: string }[] };
    const entries: BundleIndexEntry[] = agentIndex.concepts.map((concept) => {
      const searchText = [concept.title, concept.description ?? '', concept.path]
        .join('\n')
        .toLowerCase();
      return {
        path: `${entry.libraryPath}/${concept.path}`,
        title: concept.title,
        searchText,
        latinCounts: countLatinTokens(searchText),
      };
    });
    return { id, title: entry.title, libraryPath: entry.libraryPath, entries };
  });
}

function* walkMarkdown(dir: string): Generator<string> {
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      yield* walkMarkdown(full);
    } else if (name.endsWith('.md')) {
      yield full;
    }
  }
}

export function countLatinTokens(lowerText: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of lowerText.split(/[^a-z0-9]+/)) {
    if (!token) continue;
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
