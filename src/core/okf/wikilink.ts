import { posix } from 'path';
import type { UnresolvedLink } from '../../types';
import type { PageRecord, RawDependency } from './shared';
import { encodeMarkdownPath, toPosixPath } from './shared';

export interface WikilinkConversionResult {
  body: string;
  converted: number;
  unresolved: UnresolvedLink[];
}

/**
 * Shipped-attachment lookup for embed rewriting (spec 1.3.1 f1, §4.3):
 * resolves an embed target to a vault path and maps shipped vault paths to
 * their emitted `_attachments/<name>`.
 */
export interface AttachmentLinkMap {
  resolveTarget(target: string): string | null;
  bundleNameByVaultPath: Map<string, string>;
}

export function convertWikilinks(
  page: PageRecord,
  includedConceptIds: Set<string>,
  approvedRawPaths: Set<string>,
  /** Original vault path → portable bundle path (compile.ts owns the map;
   * links must point at the file names actually emitted into `_sources/`). */
  sourceBundlePaths: Map<string, string> = new Map(),
  attachments?: AttachmentLinkMap,
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

    // Attachment embeds resolve through the attachment index, not the md
    // link resolver (whose targetPath is md-only and null for images on
    // the headless shell).
    if (embed && attachments) {
      const attachmentHref = attachmentLinkHref(parsed.target, fromDir, attachments);
      if (attachmentHref) {
        converted += 1;
        return markdownLink(label, attachmentHref, true);
      }
    }

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
      const bundlePath = sourceBundlePaths.get(rawPath) ?? rawPath;
      const href = relativeLinkPath(fromDir, `_sources/${bundlePath}`);
      return markdownLink(label, `${href}${headingFragment(parsed.heading)}`, embed);
    }

    unresolved.push({ from: page.conceptId, raw: rawInner });
    return full;
  });

  return { body, converted, unresolved };
}

export function collectRawBodyUnresolvedLinks(raw: RawDependency, bundlePath: string = raw.path): UnresolvedLink[] {
  const matches = raw.body.matchAll(/!?\[\[([^\]]+)\]\]/g);
  return Array.from(matches, (match) => ({ from: `_sources/${bundlePath}`, raw: match[1] }));
}

/**
 * Attachment-embed rewrite for `_sources/` copies (spec 1.3.1 f1, §4.3):
 * convertWikilinks covers knowledge pages only and raw copies ship
 * otherwise-verbatim, so their `![[flow.png]]` would arrive broken in
 * every consumer vault. Rewrites attachment embeds only — page wikilinks
 * in raw copies keep today's behavior. `fromDir` is the emitted copy's own
 * directory (e.g. `_sources/Idea`), so nesting depth is correct by
 * construction.
 */
export function convertAttachmentEmbedsInBody(
  body: string,
  fromDir: string,
  attachments: AttachmentLinkMap,
): { body: string; converted: number } {
  let converted = 0;
  const rewritten = body.replace(/!\[\[([^\]]+)\]\]/g, (full, rawInner: string) => {
    const parsed = parseWikilink(rawInner);
    const label = parsed.alias || parsed.target.split('/').pop() || parsed.target;
    const href = attachmentLinkHref(parsed.target, fromDir, attachments);
    if (!href) return full;
    converted += 1;
    return markdownLink(label, href, true);
  });
  return { body: rewritten, converted };
}

function attachmentLinkHref(target: string, fromDir: string, attachments: AttachmentLinkMap): string | null {
  const vaultPath = attachments.resolveTarget(target);
  if (!vaultPath) return null;
  const bundleName = attachments.bundleNameByVaultPath.get(vaultPath);
  if (!bundleName) return null;
  return relativeLinkPath(fromDir, `_attachments/${bundleName}`);
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
