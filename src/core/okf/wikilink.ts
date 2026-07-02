import type { UnresolvedLink } from '../../types';
import type { PageRecord, RawDependency } from './shared';
import { encodeMarkdownPath, toPosixPath } from './shared';

export interface WikilinkConversionResult {
  body: string;
  converted: number;
  unresolved: UnresolvedLink[];
}

export function convertWikilinks(
  page: PageRecord,
  includedConceptIds: Set<string>,
  approvedRawPaths: Set<string>,
): WikilinkConversionResult {
  let converted = 0;
  const unresolved: UnresolvedLink[] = [];
  const linksByRaw = new Map(page.outlinks.map((link) => [link.raw, link]));

  const body = page.body.replace(/!?\[\[([^\]]+)\]\]/g, (full, rawInner: string) => {
    const embed = full.startsWith('!');
    const link = linksByRaw.get(rawInner);
    const parsed = parseWikilink(rawInner);
    const label = parsed.alias || parsed.target.split('/').pop() || parsed.target;

    if (!link?.targetPath) {
      unresolved.push({ from: page.conceptId, raw: rawInner });
      return full;
    }

    if (link.targetConceptId && includedConceptIds.has(link.targetConceptId)) {
      converted += 1;
      return markdownLink(label, `/${encodeMarkdownPath(`${link.targetConceptId}.md`)}${headingFragment(parsed.heading)}`, embed);
    }

    const rawPath = toPosixPath(link.targetPath);
    if (approvedRawPaths.has(rawPath)) {
      converted += 1;
      return markdownLink(label, `/${encodeMarkdownPath(`_sources/${rawPath}`)}${headingFragment(parsed.heading)}`, embed);
    }

    unresolved.push({ from: page.conceptId, raw: rawInner });
    return full;
  });

  return { body, converted, unresolved };
}

export function collectRawBodyUnresolvedLinks(raw: RawDependency): UnresolvedLink[] {
  const matches = raw.body.matchAll(/!?\[\[([^\]]+)\]\]/g);
  return Array.from(matches, (match) => ({ from: `_sources/${raw.path}`, raw: match[1] }));
}

export function parseWikilink(raw: string): { target: string; heading?: string; alias?: string } {
  const [beforeAlias, alias] = raw.split('|');
  const [target, heading] = beforeAlias.split('#');
  return {
    target: target.trim(),
    heading: heading?.trim() || undefined,
    alias: alias?.trim() || undefined,
  };
}

function markdownLink(label: string, href: string, embed: boolean): string {
  return `${embed ? '!' : ''}[${escapeLabel(label)}](${href})`;
}

function escapeLabel(label: string): string {
  return label.replace(/\]/g, '\\]');
}

function headingFragment(heading?: string): string {
  if (!heading) return '';
  return `#${encodeURIComponent(heading)}`;
}
