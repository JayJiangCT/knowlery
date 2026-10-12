import { describe, expect, it } from 'vitest';
import {
  cohenKappa, dcg, htRatio, htTotal, inBottom20, ndcgAtK, nonInferiorityHigher, nonInferiorityLower, percentileInterval,
  precisionAtK, rankPercentile, stratifiedResample, superiority, wilson,
} from '../../evals/compile-value/lib/metrics';
import { mulberry32 } from '../../evals/compile-value/lib/rng';
import { focusState, localDate } from '../../evals/compile-value/lib/focus';

describe('compile-value metric maths (hand-computed)', () => {
  it('precision@k counts yes among the first k', () => {
    expect(precisionAtK([true, false, true, true, false], 4)).toBe(0.75);
    expect(precisionAtK([true, false], 10)).toBe(0.5);
  });

  it('dcg / nDCG use log2(rank + 1) discounts', () => {
    // 3/1 + 2/log2(3) + 0 + 1/log2(5)
    expect(dcg([3, 2, 0, 1], 4)).toBeCloseTo(3 + 2 / Math.log2(3) + 1 / Math.log2(5), 10);
    expect(ndcgAtK([3, 2, 1], [1, 2, 3], 3)).toBe(1);
    expect(ndcgAtK([0, 0, 1], [1, 0, 0], 3)).toBeCloseTo(0.5, 10);
    expect(ndcgAtK([0, 0], [0, 0], 2)).toBe(0);
  });

  it('Wilson lower bound: 18/20 misses 0.70, 19/20 clears it (store §2.4 / protocol rule 3)', () => {
    expect(wilson(18, 20)[0]).toBeCloseTo(0.699, 3);
    expect(wilson(18, 20)[0]).toBeLessThan(0.7);
    expect(wilson(19, 20)[0]).toBeCloseTo(0.7639, 3);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });

  it("Cohen's κ matches the textbook example", () => {
    // 20 yes/yes, 5 yes/no, 10 no/yes, 15 no/no: po = 0.7, pe = 0.5·0.6 + 0.5·0.4 = 0.5 → κ = 0.4
    const pairs: Array<[string, string]> = [
      ...Array.from({ length: 20 }, (): [string, string] => ['yes', 'yes']),
      ...Array.from({ length: 5 }, (): [string, string] => ['yes', 'no']),
      ...Array.from({ length: 10 }, (): [string, string] => ['no', 'yes']),
      ...Array.from({ length: 15 }, (): [string, string] => ['no', 'no']),
    ];
    expect(cohenKappa(pairs)).toBeCloseTo(0.4, 10);
    expect(cohenKappa([['a', 'a']])).toBeNull();
    expect(cohenKappa([['a', 'a'], ['a', 'a']])).toBe(1);
  });

  it('Horvitz–Thompson total and ratio weight by 1/π', () => {
    const units = [
      { pi: 0.5, ac: true, bottom: true },
      { pi: 0.25, ac: true, bottom: false },
      { pi: 0.25, ac: false, bottom: true },
    ];
    expect(htTotal(units, (u) => 1 / u.pi, (u) => u.ac)).toBe(6);
    // bottom among ac: weight 2 of 6
    expect(htRatio(units, (u) => 1 / u.pi, (u) => u.bottom, (u) => u.ac)).toBeCloseTo(2 / 6, 10);
    expect(htRatio(units, (u) => 1 / u.pi, () => true, () => false)).toBeNull();
  });

  it('stratified resampling keeps each stratum size', () => {
    const units = ['a1', 'a2', 'a3', 'b1'];
    const sample = stratifiedResample(units, (unit) => unit[0], mulberry32(7));
    expect(sample.filter((unit) => unit.startsWith('a'))).toHaveLength(3);
    expect(sample.filter((unit) => unit.startsWith('b'))).toEqual(['b1']);
  });

  it('percentile interval interpolates', () => {
    const values = Array.from({ length: 101 }, (_, i) => i);
    const [low, high] = percentileInterval(values, 0.9);
    expect(low).toBeCloseTo(5, 10);
    expect(high).toBeCloseTo(95, 10);
  });

  it('rank percentile and bottom-20% use the documented conventions', () => {
    expect(rankPercentile(0, 10)).toBe(5);
    expect(rankPercentile(9, 10)).toBe(95);
    expect(inBottom20(33, 43)).toBe(false);
    expect(inBottom20(34, 43)).toBe(true);
  });
});

describe('pre-registered decision tests (protocol §10)', () => {
  it('a CI containing 0 is never a pass for superiority', () => {
    expect(superiority([-0.05, 0.2])).toBe('insufficient evidence');
    expect(superiority([0.01, 0.2])).toBe('pass');
    expect(superiority([-0.3, 0])).toBe('fail');
  });

  it('non-inferiority (higher is better) is judged by L against −δ, not by containing 0', () => {
    expect(nonInferiorityHigher([-0.1, 0.2], 0.1)).toBe('pass');
    // 0.3 − 0.4 is −0.10000000000000003 in floating point: still exactly one note in ten.
    expect(nonInferiorityHigher([0.3 - 0.4, 0.2], 0.1)).toBe('pass');
    expect(nonInferiorityHigher([-0.1000001, 0.2], 0.1)).toBe('insufficient evidence');
    expect(nonInferiorityHigher([-0.3, 0.05], 0.1)).toBe('insufficient evidence');
    expect(nonInferiorityHigher([-0.4, -0.11], 0.1)).toBe('fail');
  });

  it('non-inferiority (lower is better) is judged by U against δ', () => {
    expect(nonInferiorityLower([-0.1, 0.05], 0.05)).toBe('pass');
    expect(nonInferiorityLower([-0.02, 0.06], 0.05)).toBe('insufficient evidence');
    expect(nonInferiorityLower([0.051, 0.2], 0.05)).toBe('fail');
  });

  it('a missing interval is insufficient evidence, never a pass', () => {
    expect(superiority([Number.NaN, Number.NaN])).toBe('insufficient evidence');
    expect(nonInferiorityHigher([Number.NaN, 1], 0.1)).toBe('insufficient evidence');
    expect(nonInferiorityLower([0, Number.NaN], 0.05)).toBe('insufficient evidence');
  });
});

describe('focus.md until: (protocol §11)', () => {
  const focus = '---\nuntil: 2026-12-31\n---\n- topic\n';

  it('is inclusive through local 23:59:59 and expires at local midnight', () => {
    expect(focusState(focus, new Date('2026-12-31T15:59:59Z'), 'Asia/Shanghai').inForce).toBe(true);
    expect(focusState(focus, new Date('2026-12-31T16:00:00Z'), 'Asia/Shanghai').inForce).toBe(false);
    // The same instant is still the 31st in New York.
    expect(focusState(focus, new Date('2026-12-31T16:00:00Z'), 'America/New_York').inForce).toBe(true);
  });

  it('reads the date in the given zone, not the machine clock', () => {
    expect(localDate(new Date('2026-12-31T16:00:00Z'), 'Asia/Shanghai')).toBe('2027-01-01');
    expect(localDate(new Date('2026-12-31T16:00:00Z'), 'UTC')).toBe('2026-12-31');
  });

  it('no until means in force; quoted dates work; unparseable is ignored with a warning', () => {
    expect(focusState('- topic\n', new Date('2030-01-01T00:00:00Z'), 'UTC')).toEqual({ inForce: true, until: null, warning: null });
    expect(focusState('---\nuntil: "2026-01-01"\n---\n', new Date('2026-01-02T00:00:00Z'), 'UTC').inForce).toBe(false);
    const bad = focusState('---\nuntil: next friday\n---\n', new Date('2026-01-02T00:00:00Z'), 'UTC');
    expect(bad.inForce).toBe(true);
    expect(bad.warning).toMatch(/not a YYYY-MM-DD date/);
  });
});
