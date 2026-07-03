import type { RankedPage } from './types';

export function recallAtK(must: string[], ranked: RankedPage[], k: number): number {
  if (must.length === 0) return 1;
  const top = new Set(ranked.slice(0, k).map((page) => page.path));
  const found = must.filter((path) => top.has(path)).length;
  return found / must.length;
}

/** Reciprocal rank of the first `must` page in the result list; 0 when none appear. */
export function reciprocalRank(must: string[], ranked: RankedPage[]): number {
  const wanted = new Set(must);
  for (let i = 0; i < ranked.length; i++) {
    if (wanted.has(ranked[i].path)) return 1 / (i + 1);
  }
  return 0;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
