import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { KF_SCHEMA, type RelationType, type SectionName } from '../../schema/kf-2.0';
import { KnowleryError } from '../errors';
import { isPageFile } from '../page/files';
import type { PageSection, ParsedPage } from '../page/model';
import { parsePage } from '../page/parse';
import { isMissing, relativePath, resolveInside } from '../paths';
import { LOCATOR_PAGE_CAP, OUTLINE_PAGE_CAP, outlineSegments, paginateSegments } from './page';
import type { ReadRawNext } from './raw';

const SPECIAL_FILES = new Set<string>(KF_SCHEMA.special_files);
const RELATION_KEYS = Object.keys(KF_SCHEMA.relations) as RelationType[];
const SECTION_BY_LOWER = new Map<string, SectionName>(
  KF_SCHEMA.sections.map((name) => [name.toLowerCase(), name]),
);

export interface ReadWikiOptions {
  select?: string;
  offset?: number;
  expectedVersion?: string;
}

export interface ReadWikiPageMeta {
  type: string | null;
  title: string | null;
  status: string | null;
  description: string | null;
}

export interface ReadWikiResult {
  kind: 'wiki';
  path: string;
  version: string;
  select: string;
  page: ReadWikiPageMeta | null;
  problems: number;
  text: string;
  offset: number;
  bytes: number;
  total_bytes: number;
  partial: boolean;
  more: boolean;
  next: ReadRawNext | null;
  warnings: string[];
}

function splitNormalizedLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  if (normalized.length === 0) return [];
  const lines = normalized.split('\n');
  if (normalized.endsWith('\n')) lines.pop();
  return lines;
}

function extractSectionLines(allLines: string[], section: PageSection): string[] {
  const start = section.heading_line - 1;
  let end = section.last_line - 1;
  while (end > start && (allLines[end] ?? '').trim() === '') end--;
  return allLines.slice(start, end + 1);
}

function sectionByteLength(allLines: string[], section: PageSection): number {
  const lines = extractSectionLines(allLines, section);
  return Buffer.byteLength(lines.map((line) => `${line}\n`).join(''), 'utf8');
}

function sectionCount(parsed: ParsedPage, name: SectionName): string {
  switch (name) {
    case 'Current': return String(parsed.claims.length);
    case 'Open': return String(parsed.open.length);
    case 'Sources': return String(parsed.sources.length);
    case 'History': return String(parsed.history.length);
    case 'Evidence': return '';
  }
}

function buildWikiOutlineLines(parsed: ParsedPage, allLines: string[]): string[] {
  const fm = parsed.frontmatter;
  const headerParts = [`page ${parsed.slug}`];
  if (fm.type) headerParts.push(fm.type);
  if (fm.status) headerParts.push(fm.status);
  if (fm.updated) headerParts.push(`updated ${fm.updated}`);

  const lines: string[] = [headerParts.join(' · ')];
  if (fm.title) lines.push(`title: ${fm.title}`);
  if (fm.description) lines.push(`description: ${fm.description}`);
  if (fm.as_of) lines.push(`as_of: ${fm.as_of}`);
  if (fm.aliases && fm.aliases.length > 0) lines.push(`aliases: ${fm.aliases.join(', ')}`);
  if (fm.tags && fm.tags.length > 0) lines.push(`tags: ${fm.tags.join(', ')}`);

  for (const rel of RELATION_KEYS) {
    const targets = fm[rel];
    if (targets && targets.length > 0) {
      lines.push(`${rel}: ${targets.join(', ')}`);
    }
  }

  if (fm.protected === true) {
    lines.push('protected: true');
  } else if (Array.isArray(fm.protected) && fm.protected.length > 0) {
    lines.push(`protected: ${fm.protected.join(', ')}`);
  }

  for (const section of parsed.sections) {
    const count = sectionCount(parsed, section.name);
    const bytes = sectionByteLength(allLines, section);
    lines.push(`section ${section.name}\t${count}\t${bytes}`);
  }

  for (const source of parsed.sources) {
    lines.push(`source ${source.key}\t${source.path}\t${source.locator}`);
  }

  lines.push(`next: ^${parsed.next.claim} ^${parsed.next.open} ${parsed.next.source}`);

  if (parsed.problems.length > 0) {
    lines.push(`problems: ${parsed.problems.length}`);
  }

  return lines;
}

type WikiSelect =
  | { kind: 'all'; canonical: 'all' }
  | { kind: 'outline'; canonical: 'outline' }
  | { kind: 'section'; canonical: string; name: SectionName };

function parseWikiSelect(input: string): WikiSelect {
  if (input === 'all') return { kind: 'all', canonical: 'all' };
  if (input === 'outline') return { kind: 'outline', canonical: 'outline' };
  if (input === 'current') return { kind: 'section', canonical: 'current', name: 'Current' };
  if (input === 'history') return { kind: 'section', canonical: 'history', name: 'History' };
  if (input.startsWith('section:')) {
    const rawName = input.slice('section:'.length);
    const sectionName = SECTION_BY_LOWER.get(rawName.toLowerCase());
    if (sectionName) {
      return { kind: 'section', canonical: `section:${sectionName.toLowerCase()}`, name: sectionName };
    }
  }
  throw new KnowleryError(
    'invalid_selector',
    `Invalid selector for wiki page: ${input}`,
    'Use current, history, outline, section:<name>, or all.',
  );
}

export async function readWiki(root: string, input: string, options: ReadWikiOptions = {}): Promise<ReadWikiResult> {
  if (options.expectedVersion !== undefined && !/^sha256:[a-f0-9]{64}$/.test(options.expectedVersion)) {
    throw new KnowleryError('invalid_selector', `Invalid expected version: ${options.expectedVersion}`, 'Pass a sha256:<64 hex> digest from a previous read.');
  }

  const resolved = await resolveInside(root, input);
  const rel = relativePath(root, resolved);
  const name = basename(rel);
  const inWikiRoot = dirname(rel) === 'wiki';
  const isSpecial = inWikiRoot && SPECIAL_FILES.has(name);
  const isPage = inWikiRoot && isPageFile(name);

  if (!isPage && !isSpecial) {
    throw new KnowleryError(
      'path_denied',
      `Path under wiki/ cannot be read: ${input}`,
      'Choose a wiki page or special file (CONVENTIONS.md, index.md, log.md) directly inside wiki/.',
    );
  }

  let select: WikiSelect;
  if (isSpecial) {
    const requested = options.select ?? 'all';
    if (requested !== 'all') {
      throw new KnowleryError(
        'invalid_selector',
        `Invalid selector for special wiki file ${rel}: ${requested}`,
        'Use --select all or omit --select.',
      );
    }
    select = { kind: 'all', canonical: 'all' };
  } else {
    select = parseWikiSelect(options.select ?? 'current');
  }

  let info;
  try {
    info = await lstat(resolved);
  } catch (error) {
    if (isMissing(error)) {
      throw new KnowleryError('not_found', `Page not found: ${input}`, 'Check the page path inside wiki/.');
    }
    throw error;
  }
  if (!info.isFile()) {
    throw new KnowleryError(
      'path_denied',
      `Wiki path is not a regular file: ${input}`,
      'Choose a regular Markdown file directly inside wiki/.',
    );
  }

  const rawBytes = await readFile(resolved);
  const version = `sha256:${createHash('sha256').update(rawBytes).digest('hex')}`;

  if (options.expectedVersion !== undefined && options.expectedVersion !== version) {
    throw new KnowleryError(
      'stale_version',
      `Page changed since version ${options.expectedVersion}.`,
      'Read again without --offset.',
    );
  }

  const text = rawBytes.toString('utf8');
  const allLines = splitNormalizedLines(text);
  const offset = options.offset ?? 0;

  let lines: string[];
  let cap = LOCATOR_PAGE_CAP;
  let pageMeta: ReadWikiPageMeta | null = null;
  let problems = 0;

  if (isSpecial) {
    lines = allLines;
  } else {
    const parsed = parsePage(text, name);
    pageMeta = {
      type: parsed.frontmatter.type ?? null,
      title: parsed.frontmatter.title ?? null,
      status: parsed.frontmatter.status ?? null,
      description: parsed.frontmatter.description ?? null,
    };
    problems = parsed.problems.length;

    if (select.kind === 'all') {
      lines = allLines;
    } else if (select.kind === 'outline') {
      lines = buildWikiOutlineLines(parsed, allLines);
      cap = OUTLINE_PAGE_CAP;
    } else {
      const section = parsed.sections.find((sec) => sec.name === select.name);
      lines = section ? extractSectionLines(allLines, section) : [];
    }
  }

  const paged = paginateSegments(outlineSegments(lines), offset, cap);
  const next: ReadRawNext | null = paged.more
    ? { select: select.canonical, offset: paged.offset + paged.bytes, expected_version: version }
    : null;

  return {
    kind: 'wiki',
    path: rel,
    version,
    select: select.canonical,
    page: pageMeta,
    problems,
    text: paged.text,
    offset: paged.offset,
    bytes: paged.bytes,
    total_bytes: paged.total_bytes,
    partial: paged.partial,
    more: paged.more,
    next,
    warnings: [],
  };
}
