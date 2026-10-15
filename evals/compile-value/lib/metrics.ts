/**
 * Pure metric maths for protocol §9–§10. No I/O, no randomness except through the
 * `random` arguments, so every number in a report is reproducible from its seed.
 */

export type Interval = [number, number];
export type Outcome = 'pass' | 'fail' | 'insufficient evidence';

export function precisionAtK(flags: readonly boolean[], k: number): number {
  const top = flags.slice(0, k);
  if (top.length === 0) return 0;
  return top.filter(Boolean).length / Math.min(k, top.length);
}

export function dcg(gains: readonly number[], k: number): number {
  return gains.slice(0, k).reduce((sum, gain, i) => sum + gain / Math.log2(i + 2), 0);
}

/** nDCG@k of `gains` (in ranked order) against the ideal ordering of `allGains`. */
export function ndcgAtK(gains: readonly number[], allGains: readonly number[], k: number): number {
  const ideal = dcg([...allGains].sort((a, b) => b - a), k);
  return ideal === 0 ? 0 : dcg(gains, k) / ideal;
}

/** Wilson score interval for a binomial proportion. */
export function wilson(successes: number, n: number, z = 1.959963984540054): Interval {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Cohen's κ for two raters over the same items; null when undefined (fewer than 2 items). */
export function cohenKappa(pairs: ReadonlyArray<readonly [string, string]>): number | null {
  if (pairs.length < 2) return null;
  const categories = [...new Set(pairs.flatMap(([a, b]) => [a, b]))];
  const n = pairs.length;
  const observed = pairs.filter(([a, b]) => a === b).length / n;
  let expected = 0;
  for (const category of categories) {
    const first = pairs.filter(([a]) => a === category).length / n;
    const second = pairs.filter(([, b]) => b === category).length / n;
    expected += first * second;
  }
  if (expected === 1) return observed === 1 ? 1 : null;
  return (observed - expected) / (1 - expected);
}

/** Percentile interval of bootstrap replicates. */
export function percentileInterval(replicates: readonly number[], level = 0.95): Interval {
  const sorted = [...replicates].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return [Number.NaN, Number.NaN];
  const at = (q: number) => {
    const position = q * (sorted.length - 1);
    const low = Math.floor(position);
    const high = Math.ceil(position);
    return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
  };
  const alpha = (1 - level) / 2;
  return [at(alpha), at(1 - alpha)];
}

/** Resample indices with replacement. */
export function resampleIndices(n: number, random: () => number): number[] {
  return Array.from({ length: n }, () => Math.floor(random() * n));
}

/** Stratified resample: within each stratum, draw as many units as it has, with replacement. */
export function stratifiedResample<T>(units: readonly T[], stratumOf: (unit: T) => string, random: () => number): T[] {
  const strata = new Map<string, T[]>();
  for (const unit of units) strata.set(stratumOf(unit), [...(strata.get(stratumOf(unit)) ?? []), unit]);
  const out: T[] = [];
  for (const key of [...strata.keys()].sort()) {
    const members = strata.get(key) as T[];
    for (const index of resampleIndices(members.length, random)) out.push(members[index]);
  }
  return out;
}

/** Horvitz–Thompson ratio estimator Σ w·num / Σ w·den over weighted units (w = 1/π). */
export function htRatio<T>(units: readonly T[], weight: (unit: T) => number, numerator: (unit: T) => boolean, denominator: (unit: T) => boolean): number | null {
  let num = 0;
  let den = 0;
  for (const unit of units) {
    if (!denominator(unit)) continue;
    den += weight(unit);
    if (numerator(unit)) num += weight(unit);
  }
  return den === 0 ? null : num / den;
}

export function htTotal<T>(units: readonly T[], weight: (unit: T) => number, include: (unit: T) => boolean): number {
  return units.reduce((sum, unit) => sum + (include(unit) ? weight(unit) : 0), 0);
}

/**
 * Precision@10 moves in steps of 0.1, so a difference of exactly −δ arrives as
 * −0.10000000000000003. Boundaries are compared with this tolerance so floating-point
 * noise never flips an outcome; it is far below any meaningful difference.
 */
const BOUNDARY_EPSILON = 1e-9;

/** §10 superiority, higher is better: pass if L > 0, fail if U ≤ 0. */
export function superiority([low, high]: Interval): Outcome {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return 'insufficient evidence';
  if (low > BOUNDARY_EPSILON) return 'pass';
  if (high <= BOUNDARY_EPSILON) return 'fail';
  return 'insufficient evidence';
}

/** §10 non-inferiority, higher is better: pass if L ≥ −δ, fail if U < −δ. */
export function nonInferiorityHigher([low, high]: Interval, margin: number): Outcome {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return 'insufficient evidence';
  if (low >= -margin - BOUNDARY_EPSILON) return 'pass';
  if (high < -margin - BOUNDARY_EPSILON) return 'fail';
  return 'insufficient evidence';
}

/** §10 non-inferiority, lower is better (e.g. a miss share): pass if U ≤ δ, fail if L > δ. */
export function nonInferiorityLower([low, high]: Interval, margin: number): Outcome {
  if (!Number.isFinite(low) || !Number.isFinite(high)) return 'insufficient evidence';
  if (high <= margin + BOUNDARY_EPSILON) return 'pass';
  if (low > margin + BOUNDARY_EPSILON) return 'fail';
  return 'insufficient evidence';
}

/** 0–100, midpoint convention: the first of N is 100·0.5/N, the last 100·(N−0.5)/N. */
export function rankPercentile(rankIndex: number, queueSize: number): number {
  return (100 * (rankIndex + 0.5)) / queueSize;
}

export function inBottom20(rankIndex: number, queueSize: number): boolean {
  return rankIndex >= Math.floor(0.8 * queueSize);
}

export function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}
