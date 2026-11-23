import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { basename, join, posix } from 'node:path';
import { KF_SCHEMA, type RelationType, type RuleCode } from '../schema/kf-2.0';
import type { Config } from './config';
import { invalidInvocation, KnowleryError } from './errors';
import { getExtraction, type ExtractionOptions } from './extract';
import type { Extraction } from './extract/types';
import { parseLocator, renderPieces, resolveLocator } from './locator';
import { isPageFile, listPages } from './page/files';
import { citedSourceKeys } from './page/freshness';
import type { ParsedPage } from './page/model';
import { parsePage } from './page/parse';
import { isMissing } from './paths';

export type FindingCode = RuleCode | 'not_checked';
export type FindingSeverity = 'error' | 'warning' | 'info';

export interface ValidateFinding {
  path: string;
  line: number | null;
  code: FindingCode;
  severity: FindingSeverity;
  message: string;
}

export interface ValidateCounts {
  pages: number;
  findings: number;
  errors: number;
  warnings: number;
  not_checked: number;
  by_code: Record<string, number>;
}

export interface ValidateOptions extends Pick<ExtractionOptions, 'registry' | 'ceiling'> {
  scope?: string;
  limit?: number;
  offset?: number;
  snapshot?: string;
}

export interface ValidateResult {
  counts: ValidateCounts;
  items: ValidateFinding[];
  offset: number;
  returned: number;
  more: boolean;
  next: { offset: number; snapshot: string } | null;
  snapshot: string;
  warnings: string[];
}

const RELATION_KEYS = Object.keys(KF_SCHEMA.relations) as RelationType[];

function severityFor(code: FindingCode): FindingSeverity {
  if (code === 'attachment_orphan') return 'warning';
  if (code === 'not_checked') return 'info';
  return 'error';
}

function makeFinding(
  path: string,
  line: number | null,
  code: FindingCode,
  message: string,
): ValidateFinding {
  return { path, line, code, severity: severityFor(code), message };
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareFindings(a: ValidateFinding, b: ValidateFinding): number {
  const pathCmp = compareStrings(a.path, b.path);
  if (pathCmp !== 0) return pathCmp;
  if (a.line !== b.line) {
    if (a.line === null) return -1;
    if (b.line === null) return 1;
    return a.line - b.line;
  }
  return compareStrings(a.code, b.code);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function decodeLinkTarget(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function normalizeScope(scope: string | undefined): { kind: 'all' } | { kind: 'page'; path: string; slug: string } {
  if (scope === undefined) return { kind: 'all' };
  const cleaned = scope.replace(/\\/g, '/').replace(/\/+$/, '');
  if (cleaned === 'wiki') return { kind: 'all' };
  if (cleaned.startsWith('wiki/')) {
    const rest = cleaned.slice('wiki/'.length);
    if (!rest.includes('/') && isPageFile(rest)) {
      return { kind: 'page', path: `wiki/${rest}`, slug: rest.slice(0, -3) };
    }
  }
  throw new KnowleryError(
    'invalid_selector',
    `Invalid validate scope "${scope}".`,
    'Use "wiki" or a single page path like "wiki/<slug>.md".',
  );
}

async function listFilesRecursive(dir: string, relPrefix: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = `${relPrefix}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(full, rel));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      files.push(rel);
    }
  }
  return files;
}

function findSupersedesCycleSlugs(pagesBySlug: Map<string, ParsedPage>): Set<string> {
  const inCycle = new Set<string>();
  const state = new Map<string, 0 | 1 | 2>(); // 0=unvisited, 1=visiting, 2=done
  const stack: string[] = [];

  function dfs(slug: string): void {
    state.set(slug, 1);
    stack.push(slug);
    const page = pagesBySlug.get(slug);
    const targets = page?.frontmatter.supersedes ?? [];
    for (const target of targets) {
      if (!pagesBySlug.has(target)) continue;
      const targetState = state.get(target) ?? 0;
      if (targetState === 1) {
        const idx = stack.indexOf(target);
        if (idx !== -1) {
          for (let i = idx; i < stack.length; i++) inCycle.add(stack[i]);
        }
      } else if (targetState === 0) {
        dfs(target);
      }
    }
    stack.pop();
    state.set(slug, 2);
  }

  for (const slug of pagesBySlug.keys()) {
    if ((state.get(slug) ?? 0) === 0) dfs(slug);
  }
  return inCycle;
}

type SourceOutcome =
  | { kind: 'ok'; extraction: Extraction }
  | { kind: 'path_denied'; message: string }
  | { kind: 'not_found' }
  | { kind: 'unavailable'; state: string };

export async function validateWiki(
  root: string,
  config: Config,
  options: ValidateOptions = {},
): Promise<ValidateResult> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(offset) || offset < 0) {
    invalidInvocation('Invalid validate pagination.');
  }

  const scope = normalizeScope(options.scope);
  const pagePaths = await listPages(root);

  const pages: Array<{ path: string; page: ParsedPage }> = [];
  const pagesBySlug = new Map<string, ParsedPage>();
  const pagePathSet = new Set<string>(pagePaths);

  for (const pagePath of pagePaths) {
    const text = await readFile(join(root, pagePath), 'utf8');
    const page = parsePage(text, basename(pagePath));
    pages.push({ path: pagePath, page });
    pagesBySlug.set(page.slug, page);
  }

  if (scope.kind === 'page' && !pagePathSet.has(scope.path)) {
    throw new KnowleryError(
      'not_found',
      `Page not found: ${scope.path}`,
      'Check the page path inside wiki/.',
    );
  }

  // Build reverse index for supersedes checks.
  const supersededBy = new Map<string, string[]>();
  for (const { page } of pages) {
    for (const target of page.frontmatter.supersedes ?? []) {
      const list = supersededBy.get(target);
      if (list) list.push(page.slug);
      else supersededBy.set(target, [page.slug]);
    }
  }
  const cycleSlugs = findSupersedesCycleSlugs(pagesBySlug);

  // Cache per-source extraction across the whole run.
  const sourceCache = new Map<string, SourceOutcome>();
  const warningSet = new Set<string>();

  async function loadSource(sourcePath: string): Promise<SourceOutcome> {
    const cached = sourceCache.get(sourcePath);
    if (cached) return cached;
    let outcome: SourceOutcome;
    try {
      const extraction = await getExtraction(root, sourcePath, {
        config,
        registry: options.registry,
        ceiling: options.ceiling,
      });
      for (const w of extraction.warnings) warningSet.add(w);
      if (extraction.state === 'unreadable' || extraction.state === 'too_large' || extraction.state === 'unavailable') {
        outcome = { kind: 'unavailable', state: extraction.state };
      } else {
        outcome = { kind: 'ok', extraction };
      }
    } catch (error) {
      if (error instanceof KnowleryError) {
        if (error.code === 'path_denied') {
          outcome = { kind: 'path_denied', message: error.message };
        } else if (error.code === 'not_found') {
          outcome = { kind: 'not_found' };
        } else if (error.code === 'extraction_unavailable') {
          outcome = { kind: 'unavailable', state: 'unavailable' };
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
    sourceCache.set(sourcePath, outcome);
    return outcome;
  }

  const allFindings: ValidateFinding[] = [];

  for (const { path: pagePath, page } of pages) {
    const slug = page.slug;
    const ownAssetsPrefix = `wiki/${slug}.assets/`;

    // 1. Parser problems.
    const invalidSourceLines = new Set<number>();
    for (const problem of page.problems) {
      allFindings.push(makeFinding(pagePath, problem.line, problem.code, problem.message));
      if (problem.code === 'source_path_invalid') {
        invalidSourceLines.add(problem.line);
      }
    }

    // 2. Relation targets must exist.
    for (const relKey of RELATION_KEYS) {
      const targets = page.frontmatter[relKey] ?? [];
      for (const target of targets) {
        if (!pagesBySlug.has(target)) {
          allFindings.push(
            makeFinding(
              pagePath,
              1,
              'relation_invalid',
              `Relation "${relKey}" points to missing page "wiki/${target}.md".`,
            ),
          );
        }
      }
    }

    // 3. Supersession consistency.
    for (const target of page.frontmatter.supersedes ?? []) {
      const targetPage = pagesBySlug.get(target);
      if (targetPage && targetPage.frontmatter.status !== 'superseded') {
        allFindings.push(
          makeFinding(
            pagePath,
            1,
            'supersede_inconsistent',
            `Page supersedes "${target}", but its status is "${targetPage.frontmatter.status ?? 'missing'}" instead of "superseded".`,
          ),
        );
      }
    }
    if (page.frontmatter.status === 'superseded' && !(supersededBy.get(slug)?.length)) {
      allFindings.push(
        makeFinding(
          pagePath,
          1,
          'supersede_inconsistent',
          'Page has status "superseded" but no other page lists it under "supersedes".',
        ),
      );
    }
    if (cycleSlugs.has(slug)) {
      allFindings.push(
        makeFinding(
          pagePath,
          1,
          'supersede_inconsistent',
          `Page "${slug}" is part of a "supersedes" cycle.`,
        ),
      );
    }

    // 4. Dispute consistency.
    const disputedClaims = page.claims.filter((claim) => claim.disputed);
    if (page.frontmatter.status === 'disputed' && disputedClaims.length === 0) {
      allFindings.push(
        makeFinding(
          pagePath,
          1,
          'dispute_inconsistent',
          'Page has status "disputed" but no claim carries #disputed.',
        ),
      );
    }
    const openAboutIds = new Set<string>();
    for (const item of page.open) {
      for (const id of item.about) openAboutIds.add(id);
    }
    for (const claim of disputedClaims) {
      if (page.frontmatter.status !== 'disputed') {
        allFindings.push(
          makeFinding(
            pagePath,
            claim.line,
            'dispute_inconsistent',
            `Claim ^${claim.id} carries #disputed, but page status is "${page.frontmatter.status ?? 'missing'}" instead of "disputed".`,
          ),
        );
      }
      if (!openAboutIds.has(claim.id)) {
        allFindings.push(
          makeFinding(
            pagePath,
            claim.line,
            'dispute_inconsistent',
            `Disputed claim ^${claim.id} has no Open item referencing it after "about".`,
          ),
        );
      }
    }

    // 5. Deprecation completeness.
    if (page.frontmatter.status === 'deprecated') {
      const hasDeprecatedWithNote = page.history.some(
        (entry) => entry.kind === 'event' && entry.event === 'deprecated' && entry.note !== null && entry.note.trim() !== '',
      );
      if (!hasDeprecatedWithNote) {
        allFindings.push(
          makeFinding(
            pagePath,
            1,
            'deprecate_incomplete',
            'Page has status "deprecated" but ## History has no "deprecated" event with a note.',
          ),
        );
      }
    }

    // 6. Links and attachments.
    const linkedOwnAssets = new Set<string>();
    for (const link of page.links) {
      if (link.external || link.target.startsWith('#')) continue;
      const hashIdx = link.target.indexOf('#');
      const rawPath = hashIdx === -1 ? link.target : link.target.slice(0, hashIdx);
      if (!rawPath) continue;
      const decoded = decodeLinkTarget(rawPath);

      if (decoded.startsWith('/') || /^[A-Za-z]:[\\/]/.test(decoded)) {
        allFindings.push(
          makeFinding(
            pagePath,
            link.line,
            'link_broken',
            `Link target "${link.target}" must be a relative path inside the knowledge base.`,
          ),
        );
        continue;
      }

      const normalized = posix.normalize(posix.join('wiki', decoded));
      if (normalized === '..' || normalized.startsWith('../')) {
        allFindings.push(
          makeFinding(
            pagePath,
            link.line,
            'link_broken',
            `Link target "${link.target}" escapes the knowledge base root.`,
          ),
        );
        continue;
      }

      const assetsMatch = /^wiki\/([^/]+)\.assets(?:\/|$)/.exec(normalized);
      if (assetsMatch && assetsMatch[1] !== slug) {
        allFindings.push(
          makeFinding(
            pagePath,
            link.line,
            'attachment_outside',
            `Link target "${link.target}" points into another page's assets folder ("wiki/${assetsMatch[1]}.assets/").`,
          ),
        );
        continue;
      }

      if (normalized.startsWith(ownAssetsPrefix)) {
        linkedOwnAssets.add(normalized);
      }

      const fullTarget = join(root, normalized);
      try {
        await lstat(fullTarget);
      } catch (error) {
        if (isMissing(error)) {
          allFindings.push(
            makeFinding(
              pagePath,
              link.line,
              'link_broken',
              `Link target "${link.target}" does not exist (${normalized}).`,
            ),
          );
        } else {
          throw error;
        }
      }
    }

    // 7a. Orphan attachment files under this page's assets folder.
    const ownAssetsDir = join(root, `wiki/${slug}.assets`);
    const assetFiles = await listFilesRecursive(ownAssetsDir, `wiki/${slug}.assets`);
    for (const assetRel of assetFiles) {
      if (!linkedOwnAssets.has(assetRel)) {
        allFindings.push(
          makeFinding(
            assetRel,
            null,
            'attachment_orphan',
            `Attachment "${assetRel}" is not linked from "${pagePath}".`,
          ),
        );
      }
    }

    // Per Sources line.
    const citedKeys = citedSourceKeys(page);
    for (const source of page.sources) {
      if (invalidSourceLines.has(source.line)) continue;
      const isCited = citedKeys.has(source.key);
      const outcome = await loadSource(source.path);
      const what = source.quote !== null ? 'locator and quote' : 'locator';

      if (outcome.kind === 'path_denied') {
        allFindings.push(
          makeFinding(
            pagePath,
            source.line,
            'source_path_invalid',
            `Source ${source.key} path "${source.path}" is denied: ${outcome.message}`,
          ),
        );
        continue;
      }
      if (outcome.kind === 'not_found') {
        if (isCited) {
          allFindings.push(
            makeFinding(
              pagePath,
              source.line,
              'not_checked',
              `Could not check ${what} for ${source.key} ("${source.path}"): source file is missing.`,
            ),
          );
        }
        continue;
      }
      if (outcome.kind === 'unavailable') {
        if (isCited) {
          allFindings.push(
            makeFinding(
              pagePath,
              source.line,
              'not_checked',
              `Could not check ${what} for ${source.key} ("${source.path}"): source cannot be read (${outcome.state}).`,
            ),
          );
        }
        continue;
      }

      const extraction = outcome.extraction;
      const pinnedSha = `sha256:${source.sha256}`;
      if (extraction.sha256 !== pinnedSha) {
        if (isCited) {
          allFindings.push(
            makeFinding(
              pagePath,
              source.line,
              'not_checked',
              `Could not check ${what} for ${source.key} ("${source.path}"): source changed since it was pinned.`,
            ),
          );
        }
        continue;
      }

      let pieces;
      try {
        const parsedLocator = parseLocator(source.locator);
        pieces = resolveLocator(extraction, parsedLocator).pieces;
      } catch (error) {
        if (error instanceof KnowleryError && (error.code === 'invalid_selector' || error.code === 'not_found')) {
          allFindings.push(
            makeFinding(
              pagePath,
              source.line,
              'locator_not_found',
              `Locator "${source.locator}" for ${source.key} ("${source.path}") could not be resolved.`,
            ),
          );
          continue;
        }
        throw error;
      }

      if (source.quote !== null) {
        const rendered = collapseWhitespace(renderPieces(pieces));
        const expected = collapseWhitespace(source.quote);
        if (!rendered.includes(expected)) {
          allFindings.push(
            makeFinding(
              pagePath,
              source.line,
              'quote_not_found',
              `Quote for ${source.key} ("${source.path}") was not found in "${source.locator}".`,
            ),
          );
        }
      }
    }
  }

  // 7b. Orphan wiki/<name>.assets folders with no matching wiki/<name>.md page.
  const wikiDir = join(root, 'wiki');
  try {
    const entries = await readdir(wikiDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith('.assets')) continue;
      const name = entry.name.slice(0, -'.assets'.length);
      if (!name) continue;
      const matchingPage = `wiki/${name}.md`;
      if (!pagePathSet.has(matchingPage)) {
        const folderRel = `wiki/${entry.name}`;
        allFindings.push(
          makeFinding(
            folderRel,
            null,
            'attachment_orphan',
            `Assets folder "${folderRel}" has no matching page "${matchingPage}".`,
          ),
        );
      }
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  // Filter by scope.
  const scopedFindings = scope.kind === 'all'
    ? allFindings
    : allFindings.filter((finding) => {
        if (finding.path === scope.path) return true;
        const assetsFolder = `wiki/${scope.slug}.assets`;
        return finding.path === assetsFolder || finding.path.startsWith(`${assetsFolder}/`);
      });

  scopedFindings.sort(compareFindings);

  // Counts across the whole scope.
  let errors = 0;
  let warnings = 0;
  let notChecked = 0;
  const byCodeRaw = new Map<string, number>();
  for (const finding of scopedFindings) {
    if (finding.severity === 'error') errors++;
    else if (finding.severity === 'warning') warnings++;
    else notChecked++;
    byCodeRaw.set(finding.code, (byCodeRaw.get(finding.code) ?? 0) + 1);
  }
  const by_code = Object.fromEntries(
    [...byCodeRaw.entries()].sort(([a], [b]) => compareStrings(a, b)),
  );
  const counts: ValidateCounts = {
    pages: scope.kind === 'all' ? pages.length : 1,
    findings: errors + warnings,
    errors,
    warnings,
    not_checked: notChecked,
    by_code,
  };

  // Snapshot and paging.
  const snapshot = `sha256:${createHash('sha256').update(JSON.stringify(scopedFindings)).digest('hex')}`;
  if (options.snapshot !== undefined && options.snapshot !== snapshot) {
    throw new KnowleryError(
      'stale_version',
      'Validation results changed since the previous page.',
      'Start again at offset 0.',
    );
  }

  const pageItems: ValidateFinding[] = [];
  let bytes = 0;
  for (let i = offset; i < scopedFindings.length && pageItems.length < limit; i++) {
    const size = Buffer.byteLength(JSON.stringify(scopedFindings[i]), 'utf8') + 1;
    if (pageItems.length && bytes + size > 12288) break;
    pageItems.push(scopedFindings[i]);
    bytes += size;
  }
  const more = offset + pageItems.length < scopedFindings.length;

  return {
    counts,
    items: pageItems,
    offset,
    returned: pageItems.length,
    more,
    next: more ? { offset: offset + pageItems.length, snapshot } : null,
    snapshot,
    warnings: [...warningSet].sort(compareStrings),
  };
}
