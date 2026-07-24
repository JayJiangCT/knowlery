import { describe, expect, it } from 'vitest';
import { mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import matter from 'gray-matter';
import { COMPILED_SHARE, TIER_PAGES, generateVault, QUERY_QUESTIONS } from '../../evals/perf/generate-vault';
import { loadEntryPoints, MissingEntryPointError, measure } from '../../evals/perf/measure';
import {
  CEILINGS_MS, assertCeilings, assertFederationRatio, assertGrowthShape, comparePaired,
  PerfReportSchema, type PerfReport, type PathStats,
} from '../../evals/perf/budgets';
import { checkConformance } from '../../src/core/okf/conformance';
import type { BundleFile } from '../../src/core/okf/shared';

const silent = () => {};

function stats(medianMs: number): PathStats {
  return { medianMs, minMs: medianMs * 0.9, maxMs: medianMs * 1.1, samples: [medianMs] };
}

function syntheticReport(overrides: Partial<PerfReport> = {}): PerfReport {
  const paths = (ms: number) => ({
    scan: stats(ms), 'query-en': stats(ms), 'query-zh': stats(ms), 'query-mixed': stats(ms), index: stats(ms),
  });
  return {
    generatedAt: '2026-07-24T00:00:00.000Z',
    seed: 1,
    srcRoot: '/repo',
    skipped: false,
    tiers: { medium: { pages: 1000, paths: paths(50) }, large: { pages: 5000, paths: paths(250) } },
    federation: { kbs: 3, stats: stats(150), singleQueryMedianMs: 50 },
    info: { scanPagesPerSec: { medium: 20000 }, rssDeltaMb: 100 },
    ...overrides,
  };
}

// Spec 1.3 f4, §5.1 — determinism and conformance of the generated shape.
describe('perf vault generator', () => {
  it('is deterministic: same seed, deep-equal file maps; tier counts exact', () => {
    const a = generateVault(42, 'small');
    const b = generateVault(42, 'small');
    expect(Object.fromEntries(a.files)).toEqual(Object.fromEntries(b.files));
    expect(a.compiledPaths.length + a.userPaths.length).toBe(TIER_PAGES.small);
  });

  it('generated compiled pages pass the conformance checker', () => {
    const { files, compiledPaths } = generateVault(42, 'small');
    const bundleFiles: BundleFile[] = compiledPaths.map((path) => ({
      path, content: files.get(path)!, kind: 'concept',
    }));
    const report = checkConformance(bundleFiles);
    expect(report.conformant).toBe(true);
    expect(report.errors).toEqual([]);
  });

  // §5.2 — the graph the engine actually walks: non-zero sources: edges,
  // every edge resolving to an existing page, compiled share on parameter.
  it('emits resolving sources: edges and the ~20% compiled share', () => {
    const { files, compiledPaths, sourceEdges } = generateVault(42, 'medium');
    expect(sourceEdges.length).toBeGreaterThan(0);
    for (const [compiledPath, userPath] of sourceEdges) {
      expect(files.has(compiledPath)).toBe(true);
      expect(files.has(userPath)).toBe(true);
    }
    const share = compiledPaths.length / TIER_PAGES.medium;
    expect(share).toBeCloseTo(COMPILED_SHARE, 2);
    // The edges are frontmatter, not prose — what applySourceGraphBoost reads.
    const sample = matter(files.get(compiledPaths[0])!);
    expect(Array.isArray(sample.data.sources)).toBe(true);
    expect((sample.data.sources as string[]).length).toBeGreaterThan(0);
  });
});

// §5.3 — runner correctness: measured queries must actually match.
describe('perf runner correctness (small tier)', () => {
  it('each fixed question finds candidates; the report validates', async () => {
    const entryPoints = await loadEntryPoints(process.cwd(), 'head');
    if ('skipped' in entryPoints) throw new Error('own tree must never skip');
    const { scanVault, runQuery } = entryPoints;

    const scratch = mkdtempSync(join(tmpdir(), 'perf-test-'));
    try {
      const { files } = generateVault(7, 'small');
      const { mkdirSync, writeFileSync } = await import('node:fs');
      for (const [path, content] of files) {
        mkdirSync(join(scratch, path, '..'), { recursive: true });
        writeFileSync(join(scratch, path), content);
      }
      const snapshot = scanVault(scratch);
      for (const question of Object.values(QUERY_QUESTIONS)) {
        const result = runQuery(question, snapshot, 12);
        expect(result.candidates.length).toBeGreaterThan(0);
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  it('the report schema round-trips a synthetic report', () => {
    expect(PerfReportSchema.parse(syntheticReport())).toBeTruthy();
  });
});

// §5.4 — budget mechanics.
describe('ceiling assertions', () => {
  it('a median above its ceiling produces a violation naming path and tier', () => {
    const report = syntheticReport();
    report.tiers.medium.paths['query-zh'] = stats(CEILINGS_MS.medium['query-zh'] + 1);
    const violations = assertCeilings(report);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('medium/query-zh');
  });

  it('defaults pass on plausible numbers', () => {
    expect(assertCeilings(syntheticReport())).toEqual([]);
  });
});

// §5.5 — shape and federation-ratio mechanics.
describe('growth shape and federation ratio', () => {
  it('quadratic growth fails the shape check; linear passes', () => {
    const linear = syntheticReport(); // 50ms -> 250ms is exactly 5x
    expect(assertGrowthShape(linear)).toEqual([]);

    const quadratic = syntheticReport();
    quadratic.tiers.large.paths.scan = stats(50 * 25); // n^2 for 5x data
    const violations = assertGrowthShape(quadratic);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('scan');
    expect(violations[0]).toContain('super-linear');
  });

  it('federation above 3.5x a single medium query fails its bound', () => {
    const report = syntheticReport({
      federation: { kbs: 3, stats: stats(200), singleQueryMedianMs: 50 },
    });
    const violations = assertFederationRatio(report);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('4.0x');
    expect(assertFederationRatio(syntheticReport())).toEqual([]);
  });
});

// §5.6 — pairing mechanics.
describe('paired base/head comparison', () => {
  it('self-comparison is the null test: all ratios 1.0, no violations', () => {
    const report = syntheticReport();
    const { violations, ratios } = comparePaired(report, report);
    expect(violations).toEqual([]);
    expect(Object.keys(ratios).length).toBeGreaterThan(0);
    for (const ratio of Object.values(ratios)) expect(ratio).toBe(1);
  });

  it('a 2x delay on one head path fails the paired assertion naming that path', () => {
    const base = syntheticReport();
    const head = syntheticReport();
    head.tiers.medium.paths.index = stats(100); // 2x base's 50ms
    const { violations } = comparePaired(head, base);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('medium/index');
    expect(violations[0]).toContain('2.00x');
  });

  it('end-to-end: head entry points loaded from a scratch copy of src/ measure real paths', async () => {
    // The --src seam exercised for real: copy src/ to a scratch tree (deps
    // resolve via the runner's node_modules symlink), load as 'base', and
    // measure one real path from each tree. Ratios at ms scale are jitter-
    // dominated, so this asserts the mechanism (both sides measure, ratios
    // computable), while the budget math is pinned by the synthetic tests.
    const scratch = mkdtempSync(join(tmpdir(), 'perf-selfsrc-'));
    try {
      cpSync(join(process.cwd(), 'src'), join(scratch, 'src'), { recursive: true });
      const base = await loadEntryPoints(scratch, 'base', false, silent);
      if ('skipped' in base) throw new Error('complete copy must not skip');
      const head = await loadEntryPoints(process.cwd(), 'head', false, silent);
      if ('skipped' in head) throw new Error('own tree must never skip');

      const vaultDir = mkdtempSync(join(tmpdir(), 'perf-selfvault-'));
      try {
        const { files } = generateVault(7, 'small');
        const { mkdirSync, writeFileSync } = await import('node:fs');
        for (const [path, content] of files) {
          mkdirSync(join(vaultDir, path, '..'), { recursive: true });
          writeFileSync(join(vaultDir, path), content);
        }
        const headStats = await measure(() => head.scanVault(vaultDir));
        const baseStats = await measure(() => base.scanVault(vaultDir));
        expect(headStats.medianMs).toBeGreaterThan(0);
        expect(baseStats.medianMs).toBeGreaterThan(0);
      } finally {
        rmSync(vaultDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
});

// §5.7 — missing-entry-point semantics: fail hard, skip only via the flag.
describe('missing entry points', () => {
  it('head tree missing an entry point always throws', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'perf-empty-'));
    try {
      await expect(loadEntryPoints(empty, 'head', false, silent)).rejects.toBeInstanceOf(MissingEntryPointError);
      // The flag is base-scoped: it must not soften a head failure.
      await expect(loadEntryPoints(empty, 'head', true, silent)).rejects.toBeInstanceOf(MissingEntryPointError);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('base tree missing one fails by default; --allow-missing-base downgrades to a logged skip', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'perf-empty-'));
    try {
      await expect(loadEntryPoints(empty, 'base', false, silent)).rejects.toBeInstanceOf(MissingEntryPointError);
      const lines: string[] = [];
      const result = await loadEntryPoints(empty, 'base', true, (line) => lines.push(line));
      expect(result).toHaveProperty('skipped', true);
      expect(lines.join('\n')).toContain('SKIPPED');
      expect(lines.join('\n')).toContain('must not persist');
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
