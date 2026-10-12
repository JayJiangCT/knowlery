import { computeStaleness } from '../../../src/core/query/staleness';
import type { FrozenQueue } from './queue';

/**
 * Protocol §8. Availability is explicit: a policy whose producers do not exist is
 * reported `not available` with the missing producers named, and nothing is ever
 * filled in with a placeholder value.
 */

export type PolicyKind = 'baseline' | 'candidate';

export interface AvailablePolicy {
  id: string;
  kind: PolicyKind;
  description: string;
  available: true;
  /** Full-queue order, best first. */
  order: string[];
  note?: string;
}

export interface UnavailablePolicy {
  id: string;
  kind: PolicyKind;
  description: string;
  available: false;
  missing: string[];
}

export type Policy = AvailablePolicy | UnavailablePolicy;

/**
 * B1 (random) is not a ranking to pool: its expected Precision@k on the full queue is
 * the queue's prevalence, which run.ts estimates from the diagnostic sample.
 */
export const B1_DESCRIPTION = 'Seeded random — expected value; equals the estimated queue prevalence';

const UNAVAILABLE: ReadonlyArray<Omit<UnavailablePolicy, 'available'>> = [
  {
    id: "B2'",
    kind: 'baseline',
    description: "B2's policy on jev-worth@2 scores (note-only request)",
    missing: ['jev-worth@2 producer (1.7.0)'],
  },
  {
    id: 'C1',
    kind: 'candidate',
    description: 'Worth band, then local Delta class',
    missing: ['local-delta producer (1.7.0)'],
  },
  {
    id: 'C2',
    kind: 'candidate',
    description: 'C1 with Relevance as tie-breaker',
    missing: ['local-delta producer (1.7.0)', 'relevance producer (1.7.0)'],
  },
  {
    id: 'C3',
    kind: 'candidate',
    description: 'No-Jev path: local Worth, local Delta, Relevance',
    missing: ['local-worth producer (1.7.0)', 'local-delta producer (1.7.0)', 'relevance producer (1.7.0)'],
  },
  {
    id: 'C4',
    kind: 'candidate',
    description: 'C2 with Jev Delta',
    missing: ['jev-delta producer (opt-in, offline only)', 'local-delta producer (1.7.0)', 'relevance producer (1.7.0)'],
  },
];

export function policiesFor(queue: FrozenQueue): Policy[] {
  const b0: AvailablePolicy = {
    id: 'B0',
    kind: 'baseline',
    description: 'mtime descending — today without a key',
    available: true,
    order: queue.notes.map((note) => note.path),
  };
  const b2: Policy = queue.hasJevScores && queue.snapshot.triage
    ? {
      id: 'B2',
      kind: 'baseline',
      description: '1.6.0 Jev policy from the frozen triage.json',
      available: true,
      order: computeStaleness(queue.snapshot).uncookedNotes.map((note) => note.path),
      note: `${queue.notes.filter((note) => note.jevWorth !== null).length} of ${queue.notes.length} queued notes carry a current 1.6.0 score; the rest keep mtime order between the bands`,
    }
    : {
      id: 'B2',
      kind: 'baseline',
      description: '1.6.0 Jev policy from the frozen triage.json',
      available: false,
      missing: ['a frozen .knowlery/triage.json with at least one current score'],
    };
  return [b0, b2, ...UNAVAILABLE.map((policy): UnavailablePolicy => ({ ...policy, available: false }))];
}

export function availablePolicies(policies: readonly Policy[]): AvailablePolicy[] {
  return policies.filter((policy): policy is AvailablePolicy => policy.available);
}

/** 0-based rank of every path in a policy's order. */
export function rankIndex(order: readonly string[]): Map<string, number> {
  return new Map(order.map((path, index) => [path, index]));
}
