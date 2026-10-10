import type { ScannedPage, VaultSnapshot } from './scan';
import { isUnderReferenceDir } from '../reference-config';
import { annotateWithTriage, type JevAnnotation } from '../jev/triage-store';

/**
 * Mechanical staleness tier (spec f3, §4.2). Pure computation over a VaultSnapshot —
 * no `obsidian` imports, no I/O, no persisted state: mtimes and `sources` frontmatter
 * are read fresh from the snapshot on every call, so there is nothing to invalidate.
 *
 * Semantic staleness (superseded claims) stays with LLM-driven review workflows; this
 * module only answers the question a machine can answer exactly: did a cited source
 * change after the page that cites it was last written?
 */

export interface ChangedSource {
  path: string;
  sourceMtimeMs: number;
  pageMtimeMs: number;
}

export interface StaleFinding {
  path: string;
  title: string;
  changedSources: ChangedSource[];
}

export interface UncookedNote {
  path: string;
  title: string;
  mtimeMs: number;
  /**
   * Optional Jev score from `.knowlery/triage.json` (added 1.6.0). Present only when
   * the note was scored at its current mtime; a ranking hint, never a filter.
   */
  jev?: JevAnnotation;
}

export interface DanglingSource {
  page: string;
  source: string;
}

export interface StalenessReport {
  stalePages: StaleFinding[];
  uncookedNotes: UncookedNote[];
  danglingSources: DanglingSource[];
}

export function computeStaleness(snapshot: VaultSnapshot): StalenessReport {
  const pageByPath = new Map(snapshot.pages.map((page) => [page.path, page]));
  const citedPaths = new Set<string>();
  const stalePages: StaleFinding[] = [];
  const danglingSources: DanglingSource[] = [];

  for (const page of snapshot.pages) {
    if (page.tier !== 'agent') continue;
    const changedSources: ChangedSource[] = [];
    for (const rawSource of page.sources) {
      const source = normalize(rawSource);
      const sourcePage = pageByPath.get(source);
      if (!sourcePage) {
        danglingSources.push({ page: page.path, source });
        continue;
      }
      citedPaths.add(source);
      // Strictly greater: equal mtimes (e.g. cook writing both in one pass) are not stale.
      if (sourcePage.mtimeMs > page.mtimeMs) {
        changedSources.push({
          path: source,
          sourceMtimeMs: sourcePage.mtimeMs,
          pageMtimeMs: page.mtimeMs,
        });
      }
    }
    if (changedSources.length > 0) {
      changedSources.sort((a, b) => b.sourceMtimeMs - a.sourceMtimeMs || a.path.localeCompare(b.path));
      stalePages.push({ path: page.path, title: page.title, changedSources });
    }
  }

  stalePages.sort(
    (a, b) =>
      b.changedSources[0].sourceMtimeMs - a.changedSources[0].sourceMtimeMs ||
      a.path.localeCompare(b.path),
  );
  danglingSources.sort((a, b) => a.page.localeCompare(b.page) || a.source.localeCompare(b.source));

  const referenceDirs = snapshot.referenceDirs ?? [];
  const uncookedNotes = snapshot.pages
    .filter((page) => isUncookedCandidate(page, referenceDirs) && !citedPaths.has(page.path))
    .map((page) => ({ path: page.path, title: page.title, mtimeMs: page.mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));

  const report = { stalePages, uncookedNotes, danglingSources };
  // Jev scores ride on the snapshot when a producer has written them; every transport
  // gets the same ranking from the same file, offline.
  return snapshot.triage ? annotateWithTriage(report, snapshot.triage) : report;
}

/**
 * Uncooked candidates are the user's own notes: bundle reference material under
 * Library/ is read-only by design and never expected to be compiled, and the same
 * holds for the directories the user marked as reference in `.knowlery/config.json`.
 */
function isUncookedCandidate(page: ScannedPage, referenceDirs: readonly string[]): boolean {
  return page.tier === 'user' && !page.path.startsWith('Library/') && !isUnderReferenceDir(page.path, referenceDirs);
}

function normalize(path: string): string {
  return path.split('\\').join('/');
}

/** Agent prompt for the dashboard's "Copy re-cook prompt" action (spec f3, §4.4). */
export function buildRecookPrompt(report: StalenessReport): string {
  const lines = [
    'Run /cook scoped to the stale knowledge pages below. For each page, re-read only',
    'the changed sources listed for it and fold what changed into the page, following',
    'the /cook contradiction and SCHEMA rules. Do not touch other pages.',
    '',
  ];
  for (const finding of report.stalePages) {
    lines.push(`- ${finding.path}`);
    for (const source of finding.changedSources) {
      lines.push(`  changed source: ${source.path}`);
    }
  }
  return lines.join('\n');
}
