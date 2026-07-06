import { join } from 'node:path';
import type { RiskHint, ReviewStatus } from '../../types';
import type { VaultFs } from '../../core/vault-fs';
import type { BundleSource } from '../../core/okf/collect';
import { collectBundleInputs } from '../../core/okf/collect';
import { buildHeadlessLinkResolver } from '../../core/okf/link-resolver';
import { buildClosure, readExportScope, writeExportScope, type ScopeClosure, type ScopeItem } from '../../core/okf/export-scope';
import { scanRisks } from '../../core/okf/risk-scan';
import { compileBundle } from '../../core/okf/compile';
import { zipBundleDirectory } from '../../core/okf/zip';
import { DEFAULT_MAX_COMPILED_HOPS, sanitizeBundleId } from '../../core/okf/shared';
import { CliError } from './shared';

/**
 * `knowlery bundle export` / `review` (spec 0.8 f1): the producing side of OKF,
 * headless. The review gate is the same ExportScopeFile the Obsidian modal edits —
 * per-item statuses with content hashes that invalidate on edit. The CLI never
 * weakens it: no approve-all flag; unreviewed items block compilation with exit 1.
 */

export interface ExportCommandOptions {
  seed?: string;
  root: string;
  hops?: number;
  zip?: boolean;
  json?: boolean;
  creator?: string;
  bundleVersion?: string;
  log: (line: string) => void;
}

export interface ReviewCommandOptions {
  seed?: string;
  root: string;
  hops?: number;
  json?: boolean;
  creator?: string;
  list?: boolean;
  approve: string[];
  flag: string[];
  log: (line: string) => void;
}

interface ResolvedScope {
  source: BundleSource;
  bundleId: string;
  title: string;
  seeds: string[];
  maxCompiledHops: number;
  closure: ScopeClosure;
  risksByItem: Map<string, RiskHint[]>;
}

const REVIEW_USAGE = 'Usage: knowlery bundle review <seed-concept-id> [--list] [--json] [--approve <id>...] [--flag <id>...]';

export async function runBundleExport(fs: VaultFs, options: ExportCommandOptions): Promise<void> {
  if (!options.seed) {
    throw new CliError('Missing seed concept id.\nUsage: knowlery bundle export <seed-concept-id> [--dir <vault>] [--hops <n>] [--zip] [--json]', 2);
  }
  const scope = await resolveScope(fs, options.seed, { hops: options.hops, creator: options.creator });
  await persistScope(fs, scope);

  const unreviewed = scope.closure.items.filter((item) => item.status === 'unreviewed');
  if (unreviewed.length > 0) {
    printChecklist(scope, { json: options.json, log: options.log, jsonStatus: 'review-required' });
    if (!options.json) {
      options.log('');
      options.log('Review before export:');
      options.log(`  knowlery bundle review ${options.seed} --approve <id>... [--flag <id>...]`);
      options.log('(or review in Obsidian: Share knowledge bundle — same saved scope)');
    }
    throw new CliError(`${unreviewed.length} item(s) unreviewed — nothing was exported.`, 1);
  }

  const version = options.bundleVersion ?? '0.1.0';
  const targetDir = `.knowlery/exports/${scope.bundleId}-${version}`;
  const approved = scope.closure.items.filter((item) => item.status === 'approved');
  const result = await compileBundle(scope.source, {
    targetDir,
    bundleId: scope.bundleId,
    title: scope.title,
    version,
    license: 'personal',
    creator: { name: options.creator ?? '', url: '' },
    includeSchema: true,
    includeFullLog: false,
    includeSources: false,
    approvedConceptIds: approved.filter((item) => item.kind === 'concept').map((item) => item.id),
    approvedRawPaths: approved.filter((item) => item.kind === 'raw').map((item) => item.id),
    overwrite: true,
  });

  const zipPath = options.zip ? await zipBundleDirectory(join(options.root, targetDir)) : null;

  if (options.json) {
    options.log(JSON.stringify({
      status: 'exported',
      bundleId: result.manifest.id,
      title: result.manifest.title,
      version: result.manifest.version,
      conceptCount: result.conceptCount,
      rawSourceCount: result.rawSourceCount,
      conformant: result.conformance.conformant,
      conformanceErrors: result.conformance.errors.length,
      targetDir: result.targetDir,
      zipPath,
    }, null, 2));
    return;
  }

  options.log(`Exported ${result.manifest.id} v${result.manifest.version} — "${result.manifest.title}"`);
  options.log(`  ${result.conceptCount} concept(s), ${result.rawSourceCount} raw source(s), ${result.wikilinksConverted} wikilink(s) converted`);
  options.log(`  Conformance: ${result.conformance.conformant ? 'passed' : `failed (${result.conformance.errors.length} error(s))`}`);
  options.log(`  Output: ${result.targetDir}`);
  if (zipPath) options.log(`  Zip:    ${zipPath}`);
}

export async function runBundleReview(fs: VaultFs, options: ReviewCommandOptions): Promise<void> {
  if (!options.seed) {
    throw new CliError(`Missing seed concept id.\n${REVIEW_USAGE}`, 2);
  }
  const scope = await resolveScope(fs, options.seed, { hops: options.hops, creator: options.creator });

  if (options.approve.length === 0 && options.flag.length === 0) {
    await persistScope(fs, scope);
    printChecklist(scope, { json: options.json, log: options.log, jsonStatus: 'checklist' });
    if (!options.list && !options.json) {
      options.log('');
      options.log(REVIEW_USAGE);
    }
    return;
  }

  const byId = new Map(scope.closure.items.map((item) => [item.id, item]));
  const unknown = [...options.approve, ...options.flag].filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    throw new CliError(
      `Unknown item id(s): ${unknown.join(', ')}\nValid ids:\n${scope.closure.items.map((item) => `  ${item.id}`).join('\n')}`,
    );
  }
  const both = options.approve.filter((id) => options.flag.includes(id));
  if (both.length > 0) {
    throw new CliError(`Item(s) passed to both --approve and --flag: ${both.join(', ')}`);
  }

  const applied: Array<{ id: string; status: ReviewStatus }> = [];
  const apply = (ids: string[], status: ReviewStatus) => {
    for (const id of ids) {
      byId.get(id)!.status = status;
      applied.push({ id, status });
    }
  };
  apply(options.approve, 'approved');
  apply(options.flag, 'flagged');
  await persistScope(fs, scope);

  const counts = countStatuses(scope.closure.items);
  if (options.json) {
    options.log(JSON.stringify({ status: 'recorded', applied, counts }, null, 2));
    return;
  }
  for (const entry of applied) options.log(`  [${entry.status}] ${entry.id}`);
  options.log(`Recorded ${applied.length} status(es) — ${counts.approved} approved, ${counts.flagged} flagged, ${counts.unreviewed} unreviewed.`);
  if (counts.unreviewed === 0) {
    options.log(`Scope fully reviewed. Export with: knowlery bundle export ${options.seed} [--zip]`);
  }
}

async function resolveScope(
  fs: VaultFs,
  seedInput: string,
  options: { hops?: number; creator?: string },
): Promise<ResolvedScope> {
  const resolver = await buildHeadlessLinkResolver(fs);
  const source: BundleSource = { fs, resolver };
  const seedConceptId = await resolveSeed(source, seedInput);
  const slug = seedConceptId.split('/').pop() ?? seedConceptId;
  // Same derivation as the modal's per-topic default (D17): creator + seed slug.
  const bundleId = sanitizeBundleId(options.creator ?? '', slug);

  const persisted = (await readExportScope(fs)).bundles[bundleId];
  const seeds = [...new Set([...(persisted?.seeds ?? []), seedConceptId])];
  const maxCompiledHops = options.hops ?? persisted?.maxCompiledHops ?? DEFAULT_MAX_COMPILED_HOPS;
  const title = persisted?.title ?? slug;

  const closure = await buildClosure(source, bundleId, seeds, maxCompiledHops);
  const risksByItem = new Map<string, RiskHint[]>();
  for (const risk of scanRisks({ pages: closure.pages, rawDependencies: closure.rawDependencies })) {
    if (!risksByItem.has(risk.itemId)) risksByItem.set(risk.itemId, []);
    risksByItem.get(risk.itemId)!.push(risk);
  }
  return { source, bundleId, title, seeds, maxCompiledHops, closure, risksByItem };
}

/** Accept a full concept id or a bare slug; a bare slug must match exactly one page. */
async function resolveSeed(source: BundleSource, seedInput: string): Promise<string> {
  const { pages } = await collectBundleInputs(source);
  const normalized = seedInput.replace(/\.md$/, '');
  if (pages.some((page) => page.conceptId === normalized)) return normalized;

  const matches = pages.filter((page) => (page.conceptId.split('/').pop() ?? '') === normalized);
  if (matches.length === 1) return matches[0].conceptId;
  if (matches.length > 1) {
    throw new CliError(`Seed "${seedInput}" is ambiguous. Candidates:\n${matches.map((page) => `  ${page.conceptId}`).join('\n')}`);
  }
  throw new CliError(`No knowledge page found for seed "${seedInput}". Seeds are concept ids like concepts/<name> (run \`knowlery query\` to find one).`);
}

/** Mirror of the modal's debounced persist — resumable, shared with the Obsidian shell. */
async function persistScope(fs: VaultFs, scope: ResolvedScope): Promise<void> {
  await writeExportScope(fs, scope.bundleId, {
    title: scope.title,
    seeds: scope.seeds,
    maxCompiledHops: scope.maxCompiledHops,
    items: scope.closure.items.map((item) => ({ id: item.id, status: item.status, contentHash: item.contentHash })),
  });
}

function printChecklist(
  scope: ResolvedScope,
  options: { json?: boolean; log: (line: string) => void; jsonStatus: 'checklist' | 'review-required' },
): void {
  const counts = countStatuses(scope.closure.items);
  if (options.json) {
    options.log(JSON.stringify({
      status: options.jsonStatus,
      bundleId: scope.bundleId,
      title: scope.title,
      seeds: scope.seeds,
      maxCompiledHops: scope.maxCompiledHops,
      counts,
      items: scope.closure.items.map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        path: item.path,
        status: item.status,
        isSeed: item.isSeed,
        reviewNote: item.reviewNote,
        citedBy: item.citedBy,
        risks: (scope.risksByItem.get(item.id) ?? []).map((risk) => ({ kind: risk.kind, evidence: risk.evidence })),
      })),
    }, null, 2));
    return;
  }

  options.log(`Scope for "${scope.title}" (${scope.bundleId}) — ${scope.closure.items.length} item(s), ${counts.unreviewed} unreviewed:`);
  for (const item of scope.closure.items) {
    const marker = item.reviewNote ? `  <- ${item.reviewNote}` : '';
    const seedMark = item.isSeed ? ' (seed)' : '';
    options.log(`  [${item.status.padEnd(10)}] ${item.kind.padEnd(7)} ${item.id} — ${item.title}${seedMark}${marker}`);
    for (const risk of scope.risksByItem.get(item.id) ?? []) {
      options.log(`               !! risk ${risk.kind}: ${risk.evidence}`);
    }
  }
}

function countStatuses(items: ScopeItem[]): { approved: number; unreviewed: number; flagged: number } {
  const counts = { approved: 0, unreviewed: 0, flagged: 0 };
  for (const item of items) counts[item.status] += 1;
  return counts;
}
