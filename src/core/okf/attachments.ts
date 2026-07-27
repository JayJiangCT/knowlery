import type { VaultFs } from '../vault-fs';
import { toPosixPath } from './shared';
import { parseWikilink } from './wikilink';

/**
 * Attachment discovery and resolution (spec 1.3.1 f1, §4.1). Both shells run
 * this identical, index-based resolution — deliberately NOT Obsidian's
 * metadataCache, so export behavior is byte-identical cross-shell and
 * ambiguity is a deterministic refusal rather than a silent guess.
 */

/** Soft total-size warning threshold (spec §4.2) — informed consent, never a block. */
export const ATTACHMENT_TOTAL_WARN_BYTES = 20 * 1024 * 1024;

/** Human-readable size for checklist lines. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ATTACHMENT_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp',
  'pdf', 'mp3', 'wav', 'm4a', 'mp4', 'webm', 'mov',
]);

export type EmbedTargetKind = 'attachment' | 'md' | 'unsupported';

/**
 * An embed target without an extension is a note by Obsidian convention;
 * an allowlisted extension is an attachment; anything else (`.exe`, …) is
 * unsupported — skipped with a checklist note, never silently included.
 */
export function classifyEmbedTarget(target: string): EmbedTargetKind {
  const basename = target.split('/').pop() ?? '';
  const dot = basename.lastIndexOf('.');
  if (dot <= 0) return 'md';
  const ext = basename.slice(dot + 1).toLowerCase();
  if (ext === 'md') return 'md';
  return ATTACHMENT_EXTENSIONS.has(ext) ? 'attachment' : 'unsupported';
}

export type AttachmentResolution =
  | { kind: 'path'; path: string }
  | { kind: 'ambiguous'; candidates: string[] }
  | { kind: 'missing' };

export interface AttachmentIndex {
  resolve(target: string): AttachmentResolution;
  paths: string[];
}

const WALK_SKIP_DIRS = new Set(['.git', '.trash', 'node_modules']);

/**
 * Resolution semantics mirror the headless md resolver: exact
 * vault-relative path first, then unique basename. An ambiguous basename
 * is surfaced as such — the caller refuses with the candidate list (§4.1;
 * the fix-it is to embed the fuller path).
 */
export async function buildAttachmentIndex(fs: VaultFs, configDir?: string): Promise<AttachmentIndex> {
  const normalizedConfigDir = configDir ? toPosixPath(configDir).replace(/\/$/, '') : null;
  const paths: string[] = [];

  async function walk(dir: string): Promise<void> {
    let listing: { files: string[]; folders: string[] };
    try {
      listing = await fs.list(dir);
    } catch {
      return;
    }
    for (const file of listing.files) {
      const normalized = toPosixPath(file);
      if (classifyEmbedTarget(normalized) === 'attachment') paths.push(normalized);
    }
    for (const folder of listing.folders) {
      const normalized = toPosixPath(folder);
      const name = normalized.split('/').pop() ?? '';
      if (WALK_SKIP_DIRS.has(name) || name.startsWith('.')) continue;
      if (normalizedConfigDir && (normalized === normalizedConfigDir || normalized.startsWith(`${normalizedConfigDir}/`))) continue;
      await walk(normalized);
    }
  }

  await walk('/');
  paths.sort();

  const pathSet = new Set(paths);
  const byBasename = new Map<string, string[]>();
  for (const path of paths) {
    const basename = path.split('/').pop()!.toLowerCase();
    if (!byBasename.has(basename)) byBasename.set(basename, []);
    byBasename.get(basename)!.push(path);
  }

  const resolve = (target: string): AttachmentResolution => {
    const cleaned = toPosixPath(target).replace(/^\//, '');
    if (pathSet.has(cleaned)) return { kind: 'path', path: cleaned };
    const candidates = byBasename.get((cleaned.split('/').pop() ?? '').toLowerCase()) ?? [];
    if (candidates.length === 1) return { kind: 'path', path: candidates[0] };
    if (candidates.length > 1) return { kind: 'ambiguous', candidates };
    return { kind: 'missing' };
  };

  return { resolve, paths };
}

/**
 * Attachment embed targets of a body: wikilink embeds whose target
 * classifies as an attachment, with the `|` display-size/alias suffix
 * already stripped by the wikilink parser.
 */
export function collectAttachmentEmbedTargets(body: string): string[] {
  const targets: string[] = [];
  for (const match of body.matchAll(/!\[\[([^\]]+)\]\]/g)) {
    const { target } = parseWikilink(match[1]);
    if (classifyEmbedTarget(target) === 'attachment') targets.push(target);
  }
  return targets;
}

/** Non-md, non-attachment embed targets — surfaced as checklist notes (§4.1). */
export function collectUnsupportedEmbedTargets(body: string): string[] {
  const targets: string[] = [];
  for (const match of body.matchAll(/!\[\[([^\]]+)\]\]/g)) {
    const { target } = parseWikilink(match[1]);
    if (classifyEmbedTarget(target) === 'unsupported') targets.push(target);
  }
  return targets;
}
