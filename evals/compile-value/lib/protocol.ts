/**
 * Constants of the compile-value evaluation protocol (docs/design/compile-value/
 * evaluation-protocol.md). Changing any decision constant here is a protocol change:
 * bump PROTOCOL_REVISION, and per §10 the next decision needs a fresh freeze.
 */

export const PROTOCOL = 'cv-eval@1';
export const PROTOCOL_REVISION = 3;

/** §6.4 — the next /cook session processes at most this many notes. */
export const SESSION_SIZE = 10;
/** §5 — each available policy contributes its top POOL_DEPTH notes to the operational pool. */
export const POOL_DEPTH = 20;
/** §5 — the optional random probe draws from these 1-based ranks of each policy. */
export const PROBE_RANKS: readonly [number, number] = [21, 50];

/** §4 — first-round diagnostic sample. */
export const DEFAULT_SAMPLE_SIZE = 80;
export const DEFAULT_FLOOR = 15;
export const MAX_SNAPSHOTS_PER_DOCUMENT = 2;
export const MAX_SEEDED = 10;

/** §9 — bootstrap. */
export const BOOTSTRAP_RESAMPLES = 2000;
export const CI_LEVEL = 0.95;

/** §10 — pre-registered non-inferiority margins. */
export const MARGIN_PRECISION_AT_10 = 0.1;
export const MARGIN_BOTTOM20_SHARE = 0.05;
/** §10 rule 1 — diagnostic veto: a group mean rank percentile worse than B0 by more than this. */
export const VETO_PERCENTILE_POINTS = 20;
export const VETO_MIN_GROUP = 5;
/** §7 — a label with intra-rater κ below this is reported but not used for decisions. */
export const KAPPA_MIN = 0.4;
/** §7 — share of labelled notes re-labelled by the same annotator at least a week later. */
export const RELABEL_SHARE = 0.2;
/**
 * Labels the §10 checks read: cook_next (precision, gains), actionable_critical and its
 * inputs importance and delta (bottom-20% share, seeded notes), type (diagnostic veto).
 */
export const DECISION_LABELS = ['cook_next', 'actionable_critical', 'importance', 'delta', 'type'] as const;

export const WORTH = ['yes', 'no', 'unsure'] as const;
export const DELTA = ['new', 'partial', 'redundant', 'unknown', 'n/a'] as const;
export const RELEVANCE = ['high', 'medium', 'low', 'unknown'] as const;
export const YES_NO = ['yes', 'no'] as const;
export const REASON_CODES = ['new-decision', 'updates-page', 'focus-gap', 'unblocks', 'time-sensitive', 'other'] as const;
export const NOTE_TYPES = [
  'decision', 'requirement', 'ticket', 'meeting', 'journal', 'reference', 'draft', 'template', 'generated', 'other',
] as const;
export const IMPORTANCE = ['critical', 'normal'] as const;
export const PASSES = ['first', 'intra-rater', 'second-annotator'] as const;

export type Worth = (typeof WORTH)[number];
export type Delta = (typeof DELTA)[number];
export type Relevance = (typeof RELEVANCE)[number];
export type YesNo = (typeof YES_NO)[number];
export type ReasonCode = (typeof REASON_CODES)[number];
export type NoteType = (typeof NOTE_TYPES)[number];
export type Importance = (typeof IMPORTANCE)[number];
export type Pass = (typeof PASSES)[number];
