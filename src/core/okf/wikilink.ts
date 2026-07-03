import { posix } from 'path';
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
  const fromDir = posix.dirname(`${page.conceptId}.md`);

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
      const href = relativeLinkPath(fromDir, `${link.targetConceptId}.md`);
      return markdownLink(label, `${href}${headingFragment(parsed.heading)}`, embed);
    }

    const rawPath = toPosixPath(link.targetPath);
    if (approvedRawPaths.has(rawPath)) {
      converted += 1;
      const href = relativeLinkPath(fromDir, `_sources/${rawPath}`);
      return markdownLink(label, `${href}${headingFragment(parsed.heading)}`, embed);
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

// §5.2 of OKF v0.1 (standard relative markdown links) instead of §5.1's
// bundle-root-absolute form — a leading "/" is interpreted relative to
// Obsidian's *vault* root once a bundle is installed under Library/<id>/,
// not the bundle's own root, so absolute links silently break (or worse,
// resolve to an unrelated same-named page already in the host vault).
function relativeLinkPath(fromDir: string, targetPath: string): string {
  return encodeMarkdownPath(posix.relative(fromDir, targetPath));
}

function escapeLabel(label: string): string {
  return label.replace(/\]/g, '\\]');
}

function headingFragment(heading?: string): string {
  if (!heading) return '';
  return `#${encodeURIComponent(heading)}`;
}
