/**
 * The committed performance contract (spec 1.3 f4, §4.3). Three layers,
 * each catching what the others cannot:
 *   ceilings   → catastrophe        (blind to drift within headroom)
 *   shape      → super-linear blowup (blind to uniform slowdown)
 *   paired     → uniform slowdown    (needs the same runner)
 * Changing any constant here is the review tripwire the spec names.
 */

import { z } from 'zod';

export const PathStatsSchema = z.object({
  medianMs: z.number(),
  minMs: z.number(),
  maxMs: z.number(),
  samples: z.array(z.number()),
});
export type PathStats = z.infer<typeof PathStatsSchema>;

export const TierResultSchema = z.object({
  pages: z.number().int(),
  paths: z.record(PathStatsSchema),
});

export const PerfReportSchema = z.object({
  generatedAt: z.string(),
  seed: z.number(),
  srcRoot: z.string(),
  skipped: z.literal(false),
  tiers: z.record(TierResultSchema),
  federation: z
    .object({ kbs: z.number().int(), stats: PathStatsSchema, singleQueryMedianMs: z.number() })
    .nullable(),
  info: z.object({ scanPagesPerSec: z.record(z.number()), rssDeltaMb: z.number() }),
});
export type PerfReport = z.infer<typeof PerfReportSchema>;

export const SkippedReportSchema = z.object({ skipped: z.literal(true), reason: z.string() });
export type RunnerReport = PerfReport | z.infer<typeof SkippedReportSchema>;

/**
 * Absolute ceilings, per path × tier (ms), ~4× observed CI medians (spec
 * §4.3 — the numbers are recorded in the spec's findings). Re-derived
 * after the acceptance-round page-size calibration (real vaults average
 * ~7.7 KiB/page; the first generator was 11.5× lighter and its envelope
 * unrepresentative). These catch catastrophe, not drift.
 */
export const CEILINGS_MS: Record<string, Record<string, number>> = {
  medium: { scan: 1000, 'query-en': 1000, 'query-zh': 1000, 'query-mixed': 1000, index: 1000 },
  large: { scan: 5000, 'query-en': 5000, 'query-zh': 5000, 'query-mixed': 5000, index: 5000 },
};

/** Federation over 3 medium KBs (§4.3): its own absolute ceiling. */
export const FEDERATION_CEILING_MS = 3000;

/**
 * Growth shape (§4.3): data grows 5× (1k → 5k pages); time may grow at
 * most 10×. What a two-point ratio proves is bounded — "no obvious
 * super-linear blowup in the 1k–5k range", never linearity.
 */
export const SHAPE_RATIO_MAX = 10;
export const SHAPE_PATHS = ['scan', 'query-en', 'query-zh', 'query-mixed', 'index'];

/**
 * Federation's machine-independent bound (§4.3): its scaling axis is KB
 * count, not page count — linear-in-KB-count with headroom for
 * registry/attribution overhead. Retuned 3.5 → 4.0 at acceptance (spec
 * findings §7): with size-calibrated pages the observed ratio sits at
 * 3.13–3.25 (theoretical floor 3.0 for 3 sequential scans), leaving 3.5
 * under 8% headroom — a guaranteed flake. 4.0 still fails loudly on
 * anything super-linear in KB count.
 */
export const FEDERATION_QUERY_RATIO_MAX = 4.0;

/** Paired base/head budget (§4.3): catches the uniform 2× with margin. */
export const PAIRED_RATIO_MAX = 1.5;

export function assertCeilings(report: PerfReport): string[] {
  const violations: string[] = [];
  for (const [tier, ceilings] of Object.entries(CEILINGS_MS)) {
    const tierResult = report.tiers[tier];
    if (!tierResult) continue;
    for (const [path, ceiling] of Object.entries(ceilings)) {
      const stats = tierResult.paths[path];
      if (stats && stats.medianMs > ceiling) {
        violations.push(`ceiling: ${tier}/${path} median ${stats.medianMs.toFixed(1)}ms > ${ceiling}ms`);
      }
    }
  }
  if (report.federation && report.federation.stats.medianMs > FEDERATION_CEILING_MS) {
    violations.push(
      `ceiling: federation median ${report.federation.stats.medianMs.toFixed(1)}ms > ${FEDERATION_CEILING_MS}ms`,
    );
  }
  return violations;
}

export function assertGrowthShape(report: PerfReport): string[] {
  const medium = report.tiers.medium;
  const large = report.tiers.large;
  if (!medium || !large) return [];
  const violations: string[] = [];
  for (const path of SHAPE_PATHS) {
    const m = medium.paths[path];
    const l = large.paths[path];
    if (!m || !l || m.medianMs <= 0) continue;
    const ratio = l.medianMs / m.medianMs;
    if (ratio > SHAPE_RATIO_MAX) {
      violations.push(
        `shape: ${path} large/medium ratio ${ratio.toFixed(1)} > ${SHAPE_RATIO_MAX} (super-linear growth in the 1k-5k range)`,
      );
    }
  }
  return violations;
}

export function assertFederationRatio(report: PerfReport): string[] {
  if (!report.federation) return [];
  const { stats, singleQueryMedianMs } = report.federation;
  if (singleQueryMedianMs <= 0) return [];
  const ratio = stats.medianMs / singleQueryMedianMs;
  if (ratio > FEDERATION_QUERY_RATIO_MAX) {
    return [
      `federation: ${ratio.toFixed(1)}x a single medium query > ${FEDERATION_QUERY_RATIO_MAX}x (not linear in KB count)`,
    ];
  }
  return [];
}

/**
 * The paired layer (§4.3): head vs base on the same runner, per path.
 * Returns violations plus the observed ratios — the observational window
 * records the ratios themselves (the quantity this guard gates), never
 * cross-machine absolute times.
 */
export function comparePaired(
  head: PerfReport,
  base: PerfReport,
  budget: number = PAIRED_RATIO_MAX,
): { violations: string[]; ratios: Record<string, number> } {
  const violations: string[] = [];
  const ratios: Record<string, number> = {};
  for (const [tier, baseTier] of Object.entries(base.tiers)) {
    const headTier = head.tiers[tier];
    if (!headTier) continue;
    for (const [path, baseStats] of Object.entries(baseTier.paths)) {
      const headStats = headTier.paths[path];
      if (!headStats || baseStats.medianMs <= 0) continue;
      const ratio = headStats.medianMs / baseStats.medianMs;
      ratios[`${tier}/${path}`] = ratio;
      if (ratio > budget) {
        violations.push(
          `paired: ${tier}/${path} head ${headStats.medianMs.toFixed(1)}ms is ${ratio.toFixed(2)}x base ${baseStats.medianMs.toFixed(1)}ms (budget ${budget}x)`,
        );
      }
    }
  }
  if (head.federation && base.federation && base.federation.stats.medianMs > 0) {
    const ratio = head.federation.stats.medianMs / base.federation.stats.medianMs;
    ratios['federation'] = ratio;
    if (ratio > budget) {
      violations.push(`paired: federation head is ${ratio.toFixed(2)}x base (budget ${budget}x)`);
    }
  }
  return { violations, ratios };
}
