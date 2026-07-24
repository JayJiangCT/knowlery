import matter from 'gray-matter';
import type { AgentIndex, AgentIndexConcept, OkfFrontmatter, UnresolvedLink } from '../../types';
import type { BundleFile, RawDependency } from './shared';
import { OKF_VERSION, encodeMarkdownPath, titleFromPath, toIsoString } from './shared';

const SECTION_ORDER = ['Entity', 'Person', 'Concept', 'Comparison', 'Query', 'Reference'] as const;
const DOMAIN_GROUPED_DIRS = new Set(['entities', 'concepts']);
const UNSPECIFIED_DOMAIN = 'Unspecified';

export interface IndexEntryInput {
  conceptId: string;
  path: string;
  frontmatter: OkfFrontmatter;
  backlinks: string[]; // conceptIds inside the bundle
  outlinks: string[]; // conceptIds inside the bundle
}

export interface IndexProjectionResult {
  rootIndex: string;
  dirIndexes: BundleFile[];
  agentIndex: AgentIndex;
  staleCount: number;
}

export function projectIndexes(input: {
  title: string;
  entries: IndexEntryInput[];
  /** `bundlePath` is the portable file name emitted into `_sources/`;
   * `path` stays the original vault path for provenance. */
  rawSources: Array<RawDependency & { bundlePath: string }>;
  unresolvedLinks: UnresolvedLink[];
  now: Date;
  staleThresholdDays: number;
}): IndexProjectionResult {
  const concepts = input.entries
    .map((entry) => conceptFromEntry(entry, input.now))
    .sort((a, b) => a.title.localeCompare(b.title));

  const stale = concepts
    .filter((concept) => concept.daysSinceUpdate !== null && concept.daysSinceUpdate > input.staleThresholdDays)
    .map((concept) => concept.id);

  const agentIndex: AgentIndex = {
    schemaVersion: 1,
    okfVersion: OKF_VERSION,
    generatedAt: input.now.toISOString(),
    title: input.title,
    entrypoint: 'index.md',
    concepts,
    groups: {
      byType: groupBy(concepts, (concept) => concept.type),
      byDomain: groupBy(concepts, (concept) => concept.domain || UNSPECIFIED_DOMAIN),
    },
    stale,
    unresolvedLinks: input.unresolvedLinks,
    rawSources: input.rawSources.map((source) => ({
      path: `_sources/${source.bundlePath}`,
      title: source.title,
      citedBy: source.citedBy,
    })),
  };

  return {
    rootIndex: buildRootIndex(input.title, concepts, input.rawSources),
    dirIndexes: buildDirIndexes(concepts),
    agentIndex,
    staleCount: stale.length,
  };
}

function buildRootIndex(title: string, concepts: AgentIndexConcept[], rawSources: Array<RawDependency & { bundlePath: string }>): string {
  // OKF §11: the root index carries exactly one frontmatter line, okf_version.
  const lines = ['---', `okf_version: "${OKF_VERSION}"`, '---', '', `# ${title}`, ''];

  for (const type of SECTION_ORDER) {
    const entries = concepts.filter((concept) => concept.type === type);
    if (entries.length === 0) continue;
    lines.push(`## ${pluralize(type)}`, '');
    for (const entry of entries) lines.push(indexLine(entry));
    lines.push('');
  }

  const recent = [...concepts]
    .filter((concept) => concept.timestamp)
    .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
    .slice(0, 10);
  if (recent.length > 0) {
    lines.push('## Recently Updated', '');
    for (const entry of recent) {
      lines.push(`* [${entry.title}](/${encodeMarkdownPath(entry.path)}) - ${(entry.timestamp ?? '').slice(0, 10)}`);
    }
    lines.push('');
  }

  if (rawSources.length > 0) {
    lines.push('## Sources', '');
    for (const source of [...rawSources].sort((a, b) => a.title.localeCompare(b.title))) {
      lines.push(`* [${source.title}](/${encodeMarkdownPath(`_sources/${source.bundlePath}`)})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildDirIndexes(concepts: AgentIndexConcept[]): BundleFile[] {
  const byDir = new Map<string, AgentIndexConcept[]>();
  for (const concept of concepts) {
    const dir = concept.path.split('/')[0];
    if (!concept.path.includes('/')) continue; // root-level files (SCHEMA.md) get no dir index
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(concept);
  }

  return Array.from(byDir.entries()).map(([dir, entries]) => ({
    path: `${dir}/index.md`,
    kind: 'index' as const,
    content: buildDirIndex(dir, entries),
  }));
}

function buildDirIndex(dir: string, entries: AgentIndexConcept[]): string {
  const lines = [`# ${capitalize(dir)}`, ''];

  if (DOMAIN_GROUPED_DIRS.has(dir)) {
    // Mirrors INDEX.base's groupBy: domain for entities and concepts (§5.4b).
    const byDomain = groupEntries(entries, (entry) => entry.domain || UNSPECIFIED_DOMAIN);
    for (const domain of [...byDomain.keys()].sort((a, b) => a.localeCompare(b))) {
      lines.push(`## ${domain}`, '');
      for (const entry of byDomain.get(domain)!) lines.push(indexLine(entry));
      lines.push('');
    }
  } else {
    for (const entry of entries) lines.push(indexLine(entry));
    lines.push('');
  }

  return lines.join('\n');
}

function conceptFromEntry(entry: IndexEntryInput, now: Date): AgentIndexConcept {
  const fm = entry.frontmatter as Record<string, unknown>;
  const timestamp = toIsoString(fm.timestamp);
  return {
    id: entry.conceptId,
    path: entry.path,
    type: entry.frontmatter.type,
    title: optionalString(fm.title) ?? titleFromPath(entry.path),
    description: optionalString(fm.description),
    domain: optionalString(fm.domain),
    tags: optionalStringArray(fm.tags),
    status: optionalString(fm.status),
    timestamp,
    daysSinceUpdate: daysSince(timestamp, now),
    backlinks: entry.backlinks,
    outlinks: entry.outlinks,
    sources: optionalStringArray(fm.sources),
    contradictions: optionalStringArray(fm.contradictions),
  };
}

function indexLine(entry: AgentIndexConcept): string {
  const description = entry.description ? ` - ${entry.description}` : '';
  const freshness = entry.daysSinceUpdate !== null ? ` _(updated ${entry.daysSinceUpdate}d ago)_` : '';
  return `* [${entry.title}](/${encodeMarkdownPath(entry.path)})${description}${freshness}`;
}

function groupBy(concepts: AgentIndexConcept[], key: (concept: AgentIndexConcept) => string): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const concept of concepts) {
    const group = key(concept);
    groups[group] ??= [];
    groups[group].push(concept.id);
  }
  return groups;
}

function groupEntries(
  entries: AgentIndexConcept[],
  key: (entry: AgentIndexConcept) => string,
): Map<string, AgentIndexConcept[]> {
  const groups = new Map<string, AgentIndexConcept[]>();
  for (const entry of entries) {
    const group = key(entry);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(entry);
  }
  return groups;
}

function daysSince(value: string | undefined, now: Date): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86400000));
}

function pluralize(type: string): string {
  if (type === 'Entity') return 'Entities';
  if (type === 'Query') return 'Queries';
  if (type === 'Person') return 'People';
  return `${type}s`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : undefined;
}

export function stringifyYaml(content: string, frontmatter: OkfFrontmatter): string {
  return matter.stringify(content.trimStart(), frontmatter);
}
