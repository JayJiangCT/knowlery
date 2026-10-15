import { CONFIDENT_NO, CONFIDENT_YES, currentEntry } from '../../../src/core/jev/triage-store';
import { scanVault, type VaultSnapshot } from '../../../src/core/query/scan';
import { computeStaleness } from '../../../src/core/query/staleness';
import type { Freeze } from './freeze';

/**
 * The full frozen uncooked queue with the features sampling and policies need. Built
 * with the product's scanner and staleness code over the freeze copy, so "the queue"
 * means exactly what `knowlery stale` would have listed at T0.
 */

export type AgeBucket = 'le30d' | '30to180d' | 'gt180d';
export type JevBand = 'gt0.8' | '0.2to0.8' | 'le0.2';

export interface QueueNote {
  path: string;
  title: string;
  mtimeMs: number;
  ageDays: number;
  ageBucket: AgeBucket;
  /** Top-level directory, or two levels inside a directory holding most of the queue (§4). */
  dirFamily: string;
  /** Path with ISO dates removed: notes sharing it are snapshots of one versioned document (§4). */
  versionKey: string;
  /** 1.6.0 Jev worth from the frozen triage.json, when current for this note. Private: never on the sheet. */
  jevWorth: number | null;
  jevBand: JevBand | null;
}

export interface FrozenQueue {
  snapshot: VaultSnapshot;
  notes: QueueNote[];
  byPath: Map<string, QueueNote>;
  /** True when the frozen triage.json scores at least one queued note at its frozen mtime. */
  hasJevScores: boolean;
}

const DAY_MS = 86_400_000;
const DATE_IN_NAME = /(?:19|20)\d{2}[-_.]?(?:0[1-9]|1[0-2])[-_.]?(?:0[1-9]|[12]\d|3[01])/g;

export function ageBucket(ageDays: number): AgeBucket {
  if (ageDays <= 30) return 'le30d';
  if (ageDays <= 180) return '30to180d';
  return 'gt180d';
}

export function jevBand(worth: number): JevBand {
  if (worth > CONFIDENT_YES) return 'gt0.8';
  if (worth > CONFIDENT_NO) return '0.2to0.8';
  return 'le0.2';
}

export function versionKey(path: string): string {
  return path.replace(DATE_IN_NAME, '#').replace(/\s+/g, ' ').toLowerCase();
}

function dirFamilies(paths: readonly string[]): Map<string, string> {
  const top = (path: string) => (path.includes('/') ? path.split('/')[0] : '(root)');
  const counts = new Map<string, number>();
  for (const path of paths) counts.set(top(path), (counts.get(top(path)) ?? 0) + 1);
  const families = new Map<string, string>();
  for (const path of paths) {
    const first = top(path);
    const segments = path.split('/');
    const deep = (counts.get(first) ?? 0) > paths.length / 2 && segments.length > 2;
    families.set(path, deep ? `${segments[0]}/${segments[1]}` : first);
  }
  return families;
}

export function loadQueue(freeze: Freeze): FrozenQueue {
  const snapshot = scanVault(freeze.vaultDir);
  const frozenAt = Date.parse(freeze.manifest.frozenAt);
  const uncooked = computeStaleness({ ...snapshot, triage: undefined }).uncookedNotes;
  const families = dirFamilies(uncooked.map((note) => note.path));
  let hasJevScores = false;
  const notes = uncooked.map((note): QueueNote => {
    const entry = snapshot.triage ? currentEntry(snapshot.triage, note) : null;
    if (entry) hasJevScores = true;
    const ageDays = Math.max(0, (frozenAt - note.mtimeMs) / DAY_MS);
    return {
      path: note.path,
      title: note.title,
      mtimeMs: note.mtimeMs,
      ageDays,
      ageBucket: ageBucket(ageDays),
      dirFamily: families.get(note.path) ?? '(root)',
      versionKey: versionKey(note.path),
      jevWorth: entry ? entry.worth : null,
      jevBand: entry ? jevBand(entry.worth) : null,
    };
  });
  return { snapshot, notes, byPath: new Map(notes.map((note) => [note.path, note])), hasJevScores };
}
