import type { Freeze } from './freeze';
import {
  type Interval, type Outcome, cohenKappa, htRatio, htTotal, inBottom20, mean, ndcgAtK, nonInferiorityHigher,
  nonInferiorityLower, percentileInterval, precisionAtK, rankPercentile, resampleIndices, stratifiedResample, superiority,
  wilson,
} from './metrics';
import { type AvailablePolicy, type Policy, B1_DESCRIPTION, availablePolicies, rankIndex } from './policies';
import type { PrivateEntry, PrivateFile } from './private';
import {
  BOOTSTRAP_RESAMPLES, CI_LEVEL, DECISION_LABELS, KAPPA_MIN, MARGIN_BOTTOM20_SHARE, MARGIN_PRECISION_AT_10, POOL_DEPTH,
  PROTOCOL, PROTOCOL_REVISION, RELABEL_SHARE, SESSION_SIZE, VETO_MIN_GROUP, VETO_PERCENTILE_POINTS,
} from './protocol';
import type { FrozenQueue, QueueNote } from './queue';
import { deriveSeed, mulberry32 } from './rng';
import { type Label, type Sheet, type ValidatedSheet, validateSheet } from './sheet';

/**
 * Protocol §8–§10 over one freeze. Every interval is labelled exploratory: the pool of
 * one vault is not a sample of vaults, so generalisation rests on a second freeze
 * (§10 rule 4), not on these widths.
 */

export const INTERVAL_SCOPE = 'exploratory, single vault';

export interface Estimate {
  value: number | null;
  ci: Interval | null;
}

export interface OperationalRow {
  policy: string;
  complete: boolean;
  unlabelledInTopK: string[];
  precisionAt10: Estimate;
  precisionAt20: Estimate;
  ndcgAt10: Estimate;
  diffVsB0: { precisionAt10: Estimate } | null;
  diffVsB2: { precisionAt10: Estimate } | null;
}

export interface MissRow {
  policy: string;
  bottom20Share: Estimate;
  recall: Array<{ k: number; estimate: Estimate; labelledInTopK: number | null }>;
  worstObservedPercentile: number | null;
  diffVsB0: Estimate | null;
  diffVsB2: Estimate | null;
}

export interface GroupRow {
  policy: string;
  dimension: 'age' | 'jevBand' | 'type';
  group: string;
  n: number;
  meanPercentile: number | null;
}

export interface DecisionCheck {
  rule: string;
  outcome: Outcome;
  detail: string;
}

export interface Decision {
  policy: string;
  outcome: Outcome;
  checks: DecisionCheck[];
}

export interface EvaluationReport {
  protocol: string;
  protocolRevision: number;
  freezeId: string;
  frozenAt: string;
  intervalScope: string;
  seed: number;
  resamples: number;
  queueSize: number;
  counts: {
    sheet: number;
    labelled: number;
    unlabelled: number;
    diagnostic: number;
    diagnosticLabelled: number;
    pool: number;
    poolLabelled: number;
    seeded: number;
    ineligible: number;
    selectedNext: number;
  };
  availability: Array<{ policy: string; kind: string; description: string; available: boolean; missing?: string[]; note?: string; pooled: boolean }>;
  b1: { description: string; prevalence: Estimate };
  operational: { rows: OperationalRow[]; oracle: { precisionAt10: number | null; precisionAt20: number | null }; gradedGains: boolean; notes: string[] };
  misses: { estimatedActionableCritical: Estimate; rows: MissRow[]; notes: string[] };
  diagnostic: {
    withinSample: Array<{ policy: string; precisionAt10: number | null; precisionAt20: number | null }>;
    groups: GroupRow[];
    calibration: null | { bands: Array<{ band: string; yes: number; no: number; unsure: number; precisionYes: number | null; wilson: Interval | null }> };
    signalsNotAvailable: string[];
  };
  seeded: Array<{ id: string; path: string; actionableCritical: boolean | null; percentiles: Record<string, number> }>;
  kappa: null | Array<{ label: string; n: number; kappa: number | null; usable: boolean }>;
  decisions: Decision[];
  decisionNote: string;
  cost: string;
  warnings: string[];
}

export interface EvaluateInput {
  freeze: Freeze;
  queue: FrozenQueue;
  policies: Policy[];
  privateFile: PrivateFile;
  sheet: Sheet;
  intraSheet?: Sheet;
  seed: number;
  resamples?: number;
}

export class EvaluationError extends Error {}

interface Unit {
  id: string;
  path: string;
  entry: PrivateEntry;
  label: Label;
}

function est(value: number | null, ci: Interval | null = null): Estimate {
  return { value, ci };
}

/** Graded gain (§9.2): selected and actionable critical 3; selected 2; other cook_next yes 1; else 0. */
export function gainOf(label: Label | undefined, selected: ReadonlySet<string>): number {
  if (!label) return 0;
  if (selected.has(label.path)) return label.actionableCritical ? 3 : 2;
  return label.cookNext ? 1 : 0;
}

export function evaluate(input: EvaluateInput): EvaluationReport {
  const { freeze, queue, policies, privateFile, sheet } = input;
  const resamples = input.resamples ?? BOOTSTRAP_RESAMPLES;
  const warnings: string[] = [];
  if (privateFile.freezeId !== freeze.freezeId) throw new EvaluationError('The private file belongs to a different freeze');
  if (sheet.header.freeze_id !== freeze.freezeId) throw new EvaluationError('The sheet belongs to a different freeze');
  if (input.intraSheet && input.intraSheet.header.freeze_id !== freeze.freezeId) throw new EvaluationError('The intra-rater sheet belongs to a different freeze');

  const validated: ValidatedSheet = validateSheet(sheet);
  if (validated.errors.length > 0) throw new EvaluationError(`The sheet has ${validated.errors.length} label error(s):\n  ${validated.errors.join('\n  ')}`);
  for (const note of sheet.notes) {
    const entry = privateFile.entries[note.id];
    if (!entry) throw new EvaluationError(`Sheet id ${note.id} is not in the private file`);
    if (entry.path !== note.path) throw new EvaluationError(`Sheet id ${note.id} names ${note.path}, the private file ${entry.path}`);
  }

  const Q = queue.notes.length;
  const available = availablePolicies(policies);
  const ranks = new Map(available.map((policy) => [policy.id, rankIndex(policy.order)]));
  const labelsByPath = new Map<string, Label>();
  for (const label of validated.labels.values()) labelsByPath.set(label.path, label);
  const selectedPaths = validated.selectedNext.map((id) => validated.labels.get(id)?.path).filter((path): path is string => Boolean(path));
  const selected = new Set(selectedPaths);
  const units: Unit[] = [...validated.labels.values()].map((label) => ({ id: label.id, path: label.path, entry: privateFile.entries[label.id], label }));
  // Dropping unlabelled diagnostic notes while keeping the others' 1/π weights would
  // silently change the design, so every population estimate waits for the whole sample.
  const diagnosticTotal = Object.values(privateFile.entries).filter((entry) => entry.sources.includes('diagnostic')).length;
  const diagnosticLabelled = units.filter((unit) => unit.entry.sources.includes('diagnostic') && typeof unit.entry.pi === 'number' && unit.entry.pi > 0);
  const diagnosticComplete = diagnosticTotal > 0 && diagnosticLabelled.length === diagnosticTotal;
  const diagnosticUnits = diagnosticComplete ? diagnosticLabelled : [];
  const poolUnits = units.filter((unit) => unit.entry.sources.includes('pool'));
  const rankOf = (policyId: string, path: string) => ranks.get(policyId)?.get(path) ?? Number.POSITIVE_INFINITY;
  const queuedNote = (path: string): QueueNote | undefined => queue.byPath.get(path);
  const weight = (unit: Unit) => 1 / (unit.entry.pi as number);
  const random = mulberry32(deriveSeed(input.seed, 'bootstrap'));
  const ciOf = (replicates: number[]) => (replicates.length > 0 ? percentileInterval(replicates, CI_LEVEL) : null);

  // ---- Operational tier (§9.2): exact top-k over the full queue, paired bootstrap over the labelled pool.
  const pooled = privateFile.pool?.policies ?? [];
  const operationalNotes: string[] = [];
  if (!privateFile.pool) operationalNotes.push('No pool was built (pool.ts not run): operational metrics are not available.');
  const gradedGains = selected.size > 0;
  if (!gradedGains) operationalNotes.push('selected_next is empty: graded gains reduce to cook_next yes = 1, otherwise 0.');
  const allGains = units.map((unit) => gainOf(unit.label, selected));

  const exactTop = (policy: AvailablePolicy, k: number) => {
    const top = policy.order.slice(0, k);
    const missing = top.filter((path) => !labelsByPath.has(path));
    return { flags: top.map((path) => labelsByPath.get(path)?.cookNext ?? false), gains: top.map((path) => gainOf(labelsByPath.get(path), selected)), missing };
  };

  const operationalPolicies = available.filter((policy) => pooled.includes(policy.id));
  const poolReplicates = new Map<string, { p10: number[]; p20: number[]; ndcg: number[] }>();
  for (const policy of operationalPolicies) poolReplicates.set(policy.id, { p10: [], p20: [], ndcg: [] });
  if (poolUnits.length > 0) {
    for (let r = 0; r < resamples; r++) {
      const sample = resampleIndices(poolUnits.length, random).map((index) => poolUnits[index]);
      const sampleGains = sample.map((unit) => gainOf(unit.label, selected));
      for (const policy of operationalPolicies) {
        const ordered = sample
          .map((unit, index) => ({ unit, gain: sampleGains[index] }))
          .sort((a, b) => rankOf(policy.id, a.unit.path) - rankOf(policy.id, b.unit.path));
        const flags = ordered.map(({ unit }) => unit.label.cookNext);
        const record = poolReplicates.get(policy.id) as { p10: number[]; p20: number[]; ndcg: number[] };
        record.p10.push(precisionAtK(flags, 10));
        record.p20.push(precisionAtK(flags, 20));
        record.ndcg.push(ndcgAtK(ordered.map(({ gain }) => gain), sampleGains, SESSION_SIZE));
      }
    }
  }
  const diffInterval = (a: string, b: string) => {
    const left = poolReplicates.get(a)?.p10;
    const right = poolReplicates.get(b)?.p10;
    if (!left || !right || left.length === 0) return null;
    return ciOf(left.map((value, i) => value - right[i]));
  };

  const rows: OperationalRow[] = operationalPolicies.map((policy) => {
    const top10 = exactTop(policy, 10);
    const top20 = exactTop(policy, POOL_DEPTH);
    const complete = top20.missing.length === 0;
    const replicates = poolReplicates.get(policy.id);
    const pointDiff = (other: string) => {
      const otherPolicy = operationalPolicies.find((candidate) => candidate.id === other);
      if (!otherPolicy || other === policy.id) return null;
      const otherTop = exactTop(otherPolicy, 10);
      if (!complete || otherTop.missing.length > 0) return { precisionAt10: est(null) };
      return { precisionAt10: est(precisionAtK(top10.flags, 10) - precisionAtK(otherTop.flags, 10), diffInterval(policy.id, other)) };
    };
    return {
      policy: policy.id,
      complete,
      unlabelledInTopK: top20.missing,
      precisionAt10: est(complete ? precisionAtK(top10.flags, 10) : null, complete && replicates ? ciOf(replicates.p10) : null),
      precisionAt20: est(complete ? precisionAtK(top20.flags, 20) : null, complete && replicates ? ciOf(replicates.p20) : null),
      ndcgAt10: est(complete ? ndcgAtK(top10.gains, allGains, SESSION_SIZE) : null, complete && replicates ? ciOf(replicates.ndcg) : null),
      diffVsB0: pointDiff('B0'),
      diffVsB2: pointDiff('B2'),
    };
  });
  const yesCount = units.filter((unit) => unit.label.cookNext).length;
  const oracle = units.length > 0
    ? { precisionAt10: Math.min(10, yesCount) / 10, precisionAt20: Math.min(20, yesCount) / 20 }
    : { precisionAt10: null, precisionAt20: null };
  if (units.length > 0 && !allGains.some((gain) => gain > 0)) operationalNotes.push('No positive gains: nDCG is 0 for every policy.');

  // ---- Actionable-critical misses on the full queue (§9.3): Horvitz–Thompson over the diagnostic sample.
  const missNotes: string[] = [];
  const incompleteDiagnostic = `Diagnostic sample incomplete: ${diagnosticLabelled.length} of ${diagnosticTotal} labelled. B1 prevalence, the actionable-critical estimates and the diagnostic tier are withheld until every sampled note is labelled.`;
  if (diagnosticTotal === 0) missNotes.push('No diagnostic sample: population estimates are not available.');
  else if (!diagnosticComplete) missNotes.push(incompleteDiagnostic);
  if (privateFile.sample.ineligible.length > 0) {
    missNotes.push(`Estimates cover the eligible population: ${privateFile.sample.ineligible.length} older snapshot(s) beyond the per-document cap are outside it.`);
  }
  const strataOf = (unit: Unit) => unit.entry.stratum ?? '(none)';
  const isAc = (unit: Unit) => unit.label.actionableCritical;
  const recallKs = [10, 20, Math.max(1, Math.ceil(Q * 0.1))].filter((k, i, all) => all.indexOf(k) === i).sort((a, b) => a - b);
  // §9.3 "combined with the pooled labels": the pool is fixed by the policies before any
  // draw, so its notes are counted exactly and only diagnostic notes outside it are
  // weighted by 1/π. This stays unbiased and agrees with the labelled top-k counts.
  const poolPaths = new Set(Object.values(privateFile.entries).filter((entry) => entry.sources.includes('pool')).map((entry) => entry.path));
  const poolUnlabelled = [...poolPaths].filter((path) => !labelsByPath.has(path)).length;
  const estimable = diagnosticUnits.length > 0 && poolUnlabelled === 0;
  if (diagnosticUnits.length > 0 && poolUnlabelled > 0) {
    missNotes.push(`Pool incomplete: ${poolUnlabelled} pooled note(s) unlabelled. The actionable-critical estimates count the pool exactly, so they are withheld until it is labelled.`);
  }
  missNotes.push('Recall and bottom-20% estimates count labelled pool notes exactly and weight diagnostic notes outside the pool by 1/π; seeded-only notes are excluded (§4). For a pooled policy and k ≤ 20 the recall numerator is the labelled count.');
  const hybridTotal = (sample: readonly Unit[], include: (unit: Unit) => boolean) =>
    poolUnits.filter(include).length + htTotal(sample.filter((unit) => !poolPaths.has(unit.path)), weight, include);
  const hybridRatio = (sample: readonly Unit[], numerator: (unit: Unit) => boolean, denominator: (unit: Unit) => boolean) => {
    const den = hybridTotal(sample, denominator);
    return den === 0 ? null : hybridTotal(sample, (unit) => denominator(unit) && numerator(unit)) / den;
  };
  const missReplicates = new Map<string, { bottom: number[]; recall: Map<number, number[]> }>();
  for (const policy of available) missReplicates.set(policy.id, { bottom: [], recall: new Map(recallKs.map((k) => [k, []])) });
  const prevalenceReplicates: number[] = [];
  const acTotalReplicates: number[] = [];
  if (diagnosticUnits.length > 0) {
    for (let r = 0; r < resamples; r++) {
      const sample = stratifiedResample(diagnosticUnits, strataOf, random);
      const prevalence = htRatio(sample, weight, (unit) => unit.label.cookNext, () => true);
      if (prevalence !== null) prevalenceReplicates.push(prevalence);
      if (!estimable) continue;
      acTotalReplicates.push(hybridTotal(sample, isAc));
      for (const policy of available) {
        const record = missReplicates.get(policy.id) as { bottom: number[]; recall: Map<number, number[]> };
        const bottom = hybridRatio(sample, (unit) => inBottom20(rankOf(policy.id, unit.path), Q), isAc);
        record.bottom.push(bottom ?? Number.NaN);
        for (const k of recallKs) record.recall.get(k)?.push(hybridRatio(sample, (unit) => rankOf(policy.id, unit.path) < k, isAc) ?? Number.NaN);
      }
    }
  }
  const bottomShare = (policyId: string) => (estimable ? hybridRatio(diagnosticUnits, (unit) => inBottom20(rankOf(policyId, unit.path), Q), isAc) : null);
  const finiteCi = (values: number[]) => {
    const finite = values.filter((value) => Number.isFinite(value));
    return finite.length > 0 ? percentileInterval(finite, CI_LEVEL) : null;
  };
  const pairedBottomDiff = (a: string, b: string): Estimate | null => {
    if (a === b || !ranks.has(b)) return null;
    const left = missReplicates.get(a)?.bottom ?? [];
    const right = missReplicates.get(b)?.bottom ?? [];
    const pointA = bottomShare(a);
    const pointB = bottomShare(b);
    return est(pointA !== null && pointB !== null ? pointA - pointB : null, finiteCi(left.map((value, i) => value - right[i])));
  };
  const acLabelled = units.filter(isAc);
  const missRows: MissRow[] = available.map((policy) => ({
    policy: policy.id,
    bottom20Share: est(bottomShare(policy.id), finiteCi(missReplicates.get(policy.id)?.bottom ?? [])),
    recall: recallKs.map((k) => ({
      k,
      estimate: est(
        estimable ? hybridRatio(diagnosticUnits, (unit) => rankOf(policy.id, unit.path) < k, isAc) : null,
        finiteCi(missReplicates.get(policy.id)?.recall.get(k) ?? []),
      ),
      labelledInTopK: k <= POOL_DEPTH && pooled.includes(policy.id) ? policy.order.slice(0, k).filter((path) => labelsByPath.get(path)?.actionableCritical).length : null,
    })),
    worstObservedPercentile: acLabelled.length > 0 ? Math.max(...acLabelled.map((unit) => rankPercentile(rankOf(policy.id, unit.path), Q))) : null,
    diffVsB0: pairedBottomDiff(policy.id, 'B0'),
    diffVsB2: pairedBottomDiff(policy.id, 'B2'),
  }));
  const acTotal = estimable ? hybridTotal(diagnosticUnits, isAc) : null;

  // ---- Diagnostic tier (§9.1): sample-only.
  const withinSample = available.map((policy) => {
    const ordered = [...diagnosticUnits].sort((a, b) => rankOf(policy.id, a.path) - rankOf(policy.id, b.path));
    const flags = ordered.map((unit) => unit.label.cookNext);
    return {
      policy: policy.id,
      precisionAt10: flags.length > 0 ? precisionAtK(flags, 10) : null,
      precisionAt20: flags.length > 0 ? precisionAtK(flags, 20) : null,
    };
  });
  const groups: GroupRow[] = [];
  const dimensions: Array<{ dimension: GroupRow['dimension']; of: (unit: Unit) => string }> = [
    { dimension: 'age', of: (unit) => queuedNote(unit.path)?.ageBucket ?? '(not queued)' },
    { dimension: 'jevBand', of: (unit) => queuedNote(unit.path)?.jevBand ?? 'unscored' },
    { dimension: 'type', of: (unit) => unit.label.type },
  ];
  for (const policy of available) {
    for (const { dimension, of } of dimensions) {
      const byGroup = new Map<string, Unit[]>();
      for (const unit of diagnosticUnits) byGroup.set(of(unit), [...(byGroup.get(of(unit)) ?? []), unit]);
      for (const [group, members] of [...byGroup].sort(([a], [b]) => a.localeCompare(b))) {
        groups.push({ policy: policy.id, dimension, group, n: members.length, meanPercentile: mean(members.map((unit) => rankPercentile(rankOf(policy.id, unit.path), Q))) });
      }
    }
  }
  let calibration: EvaluationReport['diagnostic']['calibration'] = null;
  if (diagnosticComplete && available.some((policy) => policy.id === 'B2')) {
    const bands = ['gt0.8', '0.2to0.8', 'le0.2'].map((band) => {
      const members = diagnosticUnits.filter((unit) => queuedNote(unit.path)?.jevBand === band);
      const yes = members.filter((unit) => unit.label.worth === 'yes').length;
      const no = members.filter((unit) => unit.label.worth === 'no').length;
      const unsure = members.filter((unit) => unit.label.worth === 'unsure').length;
      return { band, yes, no, unsure, precisionYes: members.length > 0 ? yes / members.length : null, wilson: members.length > 0 ? wilson(yes, members.length) : null };
    });
    calibration = { bands };
  }

  // ---- Seeded set (§4, §9.2): individually, never averaged.
  const seededEntries = Object.entries(privateFile.entries).filter(([, entry]) => entry.sources.includes('seeded'));
  const seeded = seededEntries.map(([id, entry]) => {
    const label = validated.labels.get(id);
    const percentiles: Record<string, number> = {};
    for (const policy of available) percentiles[policy.id] = rankPercentile(rankOf(policy.id, entry.path), Q);
    return { id, path: entry.path, actionableCritical: label ? label.actionableCritical : null, percentiles };
  });

  // ---- Intra-rater agreement (§7).
  let kappa: EvaluationReport['kappa'] = null;
  if (input.intraSheet) {
    const second = validateSheet(input.intraSheet);
    if (second.errors.length > 0) throw new EvaluationError(`The intra-rater sheet has label errors:\n  ${second.errors.join('\n  ')}`);
    const fields: Array<[string, (label: Label) => string]> = [
      ['worth', (label) => label.worth], ['delta', (label) => label.delta], ['relevance', (label) => label.relevance],
      ['cook_next', (label) => (label.cookNext ? 'yes' : 'no')], ['type', (label) => label.type], ['importance', (label) => label.importance],
      ['actionable_critical', (label) => (label.actionableCritical ? 'yes' : 'no')],
    ];
    kappa = fields.map(([name, of]) => {
      const pairs: Array<[string, string]> = [];
      for (const [id, label] of second.labels) {
        const first = validated.labels.get(id);
        if (first) pairs.push([of(first), of(label)]);
      }
      const value = cohenKappa(pairs);
      return { label: name, n: pairs.length, kappa: value, usable: value !== null && value >= KAPPA_MIN };
    });
  }

  // ---- §7 gate: a label below κ = 0.4, or without a re-label to measure it, is reported but never decides.
  const relabelled = kappa?.[0]?.n ?? 0;
  const relabelNeeded = Math.ceil(RELABEL_SHARE * validated.labels.size);
  const weakLabels = DECISION_LABELS.filter((name) => !kappa?.find((row) => row.label === name)?.usable);
  const agreementCheck: DecisionCheck = {
    rule: `§7. Intra-rater κ ≥ ${KAPPA_MIN} for ${DECISION_LABELS.join(', ')} on a re-label of ≥ ${RELABEL_SHARE * 100}% of labelled notes`,
    outcome: kappa && relabelled >= relabelNeeded && weakLabels.length === 0 ? 'pass' : 'insufficient evidence',
    detail: !kappa
      ? 'no intra-rater re-label sheet (--intra)'
      : relabelled < relabelNeeded
        ? `${relabelled} re-labelled, ${relabelNeeded} needed`
        : weakLabels.length > 0
          ? `κ below ${KAPPA_MIN} or undefined: ${weakLabels.map((name) => `${name} (${kappa.find((row) => row.label === name)?.kappa?.toFixed(2) ?? 'n/a'})`).join(', ')}`
          : `${relabelled} re-labelled; every decision label has κ ≥ ${KAPPA_MIN}`,
  };

  // ---- Pre-registered decisions (§10), for candidate policies only.
  const candidates = available.filter((policy) => policy.kind === 'candidate');
  const rowOf = (id: string) => rows.find((row) => row.policy === id);
  const missOf = (id: string) => missRows.find((row) => row.policy === id);
  const decisions: Decision[] = candidates.map((policy) => {
    const checks: DecisionCheck[] = [];
    const row = rowOf(policy.id);
    const miss = missOf(policy.id);
    const p10VsB0 = row?.diffVsB0?.precisionAt10.ci ?? null;
    checks.push({ rule: '1. Precision@10 superior to B0', outcome: p10VsB0 ? superiority(p10VsB0) : 'insufficient evidence', detail: p10VsB0 ? `Δ CI [${p10VsB0[0].toFixed(3)}, ${p10VsB0[1].toFixed(3)}]` : 'no paired interval' });
    const p10VsB2 = row?.diffVsB2?.precisionAt10.ci ?? null;
    checks.push({
      rule: `1. Precision@10 non-inferior to B2 (δ = ${MARGIN_PRECISION_AT_10})`,
      outcome: p10VsB2 ? nonInferiorityHigher(p10VsB2, MARGIN_PRECISION_AT_10) : 'insufficient evidence',
      detail: p10VsB2 ? `Δ CI [${p10VsB2[0].toFixed(3)}, ${p10VsB2[1].toFixed(3)}]` : 'B2 not available or no paired interval',
    });
    for (const baseline of ['B0', 'B2'] as const) {
      const diffCi = (baseline === 'B0' ? miss?.diffVsB0 : miss?.diffVsB2)?.ci ?? null;
      checks.push({
        rule: `1. Bottom-20% actionable-critical share non-inferior to ${baseline} (δ = ${MARGIN_BOTTOM20_SHARE})`,
        outcome: diffCi ? nonInferiorityLower(diffCi, MARGIN_BOTTOM20_SHARE) : 'insufficient evidence',
        detail: diffCi ? `Δ CI [${diffCi[0].toFixed(3)}, ${diffCi[1].toFixed(3)}]` : `${baseline} not available or no estimate`,
      });
    }
    const confirmed = seeded.filter((entry) => entry.actionableCritical === true);
    const topFifth = Math.ceil(0.2 * Q);
    const buried = confirmed.filter((entry) => rankOf(policy.id, entry.path) >= topFifth);
    checks.push({
      rule: '1. Every confirmed seeded actionable-critical note in the top 20%',
      outcome: buried.length === 0 ? 'pass' : 'fail',
      detail: confirmed.length === 0 ? 'no seeded note was confirmed actionable critical' : `${confirmed.length - buried.length} of ${confirmed.length} in the top 20%`,
    });
    const vetoes = groups.filter((group) => {
      if (group.policy !== policy.id || group.n < VETO_MIN_GROUP || group.dimension === 'jevBand' || group.meanPercentile === null) return false;
      const base = groups.find((other) => other.policy === 'B0' && other.dimension === group.dimension && other.group === group.group);
      return base?.meanPercentile !== null && base !== undefined && group.meanPercentile - (base.meanPercentile as number) > VETO_PERCENTILE_POINTS;
    });
    checks.push({
      rule: `1. Diagnostic veto: no type or age group (n ≥ ${VETO_MIN_GROUP}) sunk > ${VETO_PERCENTILE_POINTS} points below B0`,
      outcome: !diagnosticComplete ? 'insufficient evidence' : vetoes.length === 0 ? 'pass' : 'fail',
      detail: !diagnosticComplete
        ? `diagnostic sample incomplete (${diagnosticLabelled.length} of ${diagnosticTotal} labelled)`
        : vetoes.length === 0 ? 'no group vetoed' : vetoes.map((group) => `${group.dimension}=${group.group}`).join(', '),
    });
    checks.push(agreementCheck);
    const outcome: Outcome = checks.some((check) => check.outcome === 'fail')
      ? 'fail'
      : checks.every((check) => check.outcome === 'pass') ? 'pass' : 'insufficient evidence';
    return { policy: policy.id, outcome, checks };
  });
  const decisionNote = candidates.length === 0
    ? 'No candidate policy is available (their producers ship in 1.7.0), so no ship decision is possible in this round. Baselines are measured for later comparison.'
    : 'Passing on one freeze is a direction only: the default changes after the rules also pass on a second freeze (§10 rule 4).';

  if (privateFile.pool?.appendedAfterLabelling) warnings.push('Pool entries were added after labelling began; blindness of that block is weaker (see the private file).');
  if (validated.unlabelled.length > 0) warnings.push(`${validated.unlabelled.length} sheet entries are unlabelled.`);
  if (diagnosticTotal > 0 && !diagnosticComplete) warnings.push(incompleteDiagnostic);
  for (const row of rows) if (!row.complete) warnings.push(`${row.policy}: ${row.unlabelledInTopK.length} of its top ${POOL_DEPTH} are unlabelled; its operational metrics are withheld.`);

  const sources = (source: string) => Object.values(privateFile.entries).filter((entry) => entry.sources.includes(source as PrivateEntry['sources'][number])).length;
  return {
    protocol: PROTOCOL,
    protocolRevision: PROTOCOL_REVISION,
    freezeId: freeze.freezeId,
    frozenAt: freeze.manifest.frozenAt,
    intervalScope: INTERVAL_SCOPE,
    seed: input.seed,
    resamples,
    queueSize: Q,
    counts: {
      sheet: sheet.notes.length,
      labelled: validated.labels.size,
      unlabelled: validated.unlabelled.length,
      diagnostic: sources('diagnostic'),
      diagnosticLabelled: diagnosticLabelled.length,
      pool: sources('pool'),
      poolLabelled: poolUnits.length,
      seeded: sources('seeded'),
      ineligible: privateFile.sample.ineligible.length,
      selectedNext: selected.size,
    },
    availability: policies.map((policy) => ({
      policy: policy.id,
      kind: policy.kind,
      description: policy.description,
      available: policy.available,
      ...(policy.available ? (policy.note ? { note: policy.note } : {}) : { missing: policy.missing }),
      pooled: pooled.includes(policy.id),
    })),
    b1: {
      description: B1_DESCRIPTION,
      prevalence: est(diagnosticUnits.length > 0 ? htRatio(diagnosticUnits, weight, (unit) => unit.label.cookNext, () => true) : null, finiteCi(prevalenceReplicates)),
    },
    operational: { rows, oracle, gradedGains, notes: operationalNotes },
    misses: { estimatedActionableCritical: est(acTotal, finiteCi(acTotalReplicates)), rows: missRows, notes: missNotes },
    diagnostic: {
      withinSample,
      groups,
      calibration,
      signalsNotAvailable: ['local-worth', 'local-delta', 'relevance', 'jev-worth@2', 'jev-delta'],
    },
    seeded,
    kappa,
    decisions,
    decisionNote,
    cost: 'No paid calls: B0 uses mtimes and B2 reuses the frozen 1.6.0 scores.',
    warnings,
  };
}
