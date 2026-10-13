import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOCUS_PATH, type Freeze } from './freeze';
import { focusState } from './focus';
import type { PrivateEntry, PrivateFile, StratumRecord } from './private';
import {
  DEFAULT_FLOOR, DEFAULT_SAMPLE_SIZE, MAX_SEEDED, MAX_SNAPSHOTS_PER_DOCUMENT, PROTOCOL, PROTOCOL_REVISION, SESSION_SIZE,
} from './protocol';
import type { FrozenQueue, QueueNote } from './queue';
import { assignIds, deriveSeed, mulberry32, shuffle } from './rng';
import { blankNote, type Sheet } from './sheet';

/**
 * Protocol §4: stratified diagnostic sample over the frozen queue with recorded
 * inclusion probabilities. Strata are age bucket × (1.6.0 Jev band, when the freeze
 * has scores); directory family is used as implicit stratification (systematic
 * sampling over a directory-sorted list), which spreads the sample across directories
 * without creating cells too small to sample.
 */

export interface SampleOptions {
  size?: number;
  floor?: number;
  seed: number;
  /** Paths privately nominated as critical knowledge not yet compiled (§4 seeded set). */
  seeded?: string[];
  /** Defaults to "use Jev strata when the freeze has 1.6.0 scores". Scores stay in the private file. */
  useJevStrata?: boolean;
  now?: Date;
}

export interface SampleResult {
  sheet: Sheet;
  privateFile: PrivateFile;
  warnings: string[];
}

const OLDEST = 'gt180d';
const LOW_BAND = 'le0.2';

/** Older snapshots of one versioned document beyond the cap are not eligible (§4). */
export function eligibility(notes: readonly QueueNote[]): { eligible: QueueNote[]; ineligible: string[] } {
  const groups = new Map<string, QueueNote[]>();
  for (const note of notes) groups.set(note.versionKey, [...(groups.get(note.versionKey) ?? []), note]);
  const ineligible = new Set<string>();
  for (const group of groups.values()) {
    if (group.length <= MAX_SNAPSHOTS_PER_DOCUMENT) continue;
    const newestFirst = [...group].sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
    for (const note of newestFirst.slice(MAX_SNAPSHOTS_PER_DOCUMENT)) ineligible.add(note.path);
  }
  return { eligible: notes.filter((note) => !ineligible.has(note.path)), ineligible: [...ineligible].sort() };
}

export function stratumKey(note: QueueNote, useJev: boolean): string {
  return useJev ? `${note.ageBucket}|${note.jevBand ?? 'unscored'}` : note.ageBucket;
}

export class SampleError extends Error {}

/**
 * Proportional allocation (largest remainder, capped by stratum size), then at least
 * one note per non-empty stratum, then floors: at least `floor` notes from the oldest
 * age bucket and, with Jev strata, from the ≤ 0.2 band — moved from the largest cells
 * outside the floored group. Every non-empty stratum keeps π > 0: a stratum that got
 * no draw would make its notes invisible to every population estimate.
 */
export function allocate(populations: ReadonlyMap<string, number>, size: number, floor: number): Map<string, number> {
  const keys = [...populations.keys()].filter((key) => (populations.get(key) ?? 0) > 0).sort();
  const total = keys.reduce((sum, key) => sum + (populations.get(key) ?? 0), 0);
  const n = Math.min(size, total);
  const allocation = new Map<string, number>();
  if (n === 0) return allocation;
  if (keys.length > n) throw new SampleError(`${keys.length} non-empty strata cannot each get a draw from a sample of ${n}`);
  const quotas = keys.map((key) => ({ key, exact: (n * (populations.get(key) ?? 0)) / total }));
  for (const quota of quotas) allocation.set(quota.key, Math.floor(quota.exact));
  let remaining = n - [...allocation.values()].reduce((a, b) => a + b, 0);
  const byRemainder = [...quotas].sort((a, b) => (b.exact % 1) - (a.exact % 1) || a.key.localeCompare(b.key));
  for (const quota of byRemainder) {
    if (remaining === 0) break;
    if ((allocation.get(quota.key) ?? 0) < (populations.get(quota.key) ?? 0)) {
      allocation.set(quota.key, (allocation.get(quota.key) ?? 0) + 1);
      remaining -= 1;
    }
  }

  for (const key of keys) {
    if ((allocation.get(key) ?? 0) > 0) continue;
    const donor = keys
      .filter((other) => (allocation.get(other) ?? 0) > 1)
      .sort((a, b) => (allocation.get(b) ?? 0) - (allocation.get(a) ?? 0) || a.localeCompare(b))[0];
    if (!donor) throw new SampleError(`No stratum can give up a draw for ${key}`);
    allocation.set(donor, (allocation.get(donor) ?? 0) - 1);
    allocation.set(key, 1);
  }

  const floorGroups = [
    (key: string) => key.split('|')[0] === OLDEST,
    (key: string) => key.split('|')[1] === LOW_BAND,
  ];
  const inAnyFloor = (key: string) => floorGroups.some((inGroup) => inGroup(key));
  for (const inGroup of floorGroups) {
    const members = keys.filter(inGroup);
    if (members.length === 0) continue;
    const available = members.reduce((sum, key) => sum + (populations.get(key) ?? 0), 0);
    const target = Math.min(floor, available);
    let current = members.reduce((sum, key) => sum + (allocation.get(key) ?? 0), 0);
    while (current < target) {
      const receiver = members
        .filter((key) => (allocation.get(key) ?? 0) < (populations.get(key) ?? 0))
        .sort((a, b) => ((populations.get(b) ?? 0) - (allocation.get(b) ?? 0)) - ((populations.get(a) ?? 0) - (allocation.get(a) ?? 0)) || a.localeCompare(b))[0];
      const donor = keys
        .filter((key) => !inGroup(key) && (allocation.get(key) ?? 0) > 1)
        .sort((a, b) => Number(inAnyFloor(a)) - Number(inAnyFloor(b)) || (allocation.get(b) ?? 0) - (allocation.get(a) ?? 0) || a.localeCompare(b))[0];
      if (!receiver || !donor) break;
      allocation.set(receiver, (allocation.get(receiver) ?? 0) + 1);
      allocation.set(donor, (allocation.get(donor) ?? 0) - 1);
      current += 1;
    }
  }
  return allocation;
}

function cellsOf(notes: readonly QueueNote[], useJev: boolean): Map<string, QueueNote[]> {
  const cells = new Map<string, QueueNote[]>();
  for (const note of notes) {
    const key = stratumKey(note, useJev);
    cells.set(key, [...(cells.get(key) ?? []), note]);
  }
  return cells;
}

/** Systematic sample of n from a directory-sorted list: inclusion probability n / N for every member. */
export function systematic<T>(sorted: readonly T[], n: number, random: () => number): T[] {
  if (n <= 0) return [];
  if (n >= sorted.length) return [...sorted];
  const step = sorted.length / n;
  const start = random() * step;
  return Array.from({ length: n }, (_, i) => sorted[Math.floor(start + i * step)]);
}

export function focusSources(freeze: Freeze): { sources: string[]; warnings: string[] } {
  const sources: string[] = [];
  const warnings: string[] = [];
  const focusFile = join(freeze.vaultDir, FOCUS_PATH);
  if (existsSync(focusFile)) {
    const state = focusState(readFileSync(focusFile, 'utf8'), new Date(freeze.manifest.frozenAt), freeze.manifest.timeZone);
    if (state.warning) warnings.push(state.warning);
    if (state.inForce) sources.push(FOCUS_PATH);
    else warnings.push(`focus.md expired (until ${state.until}) at frozenAt in ${freeze.manifest.timeZone}; relevance is judged against KNOWLEDGE.md only`);
  }
  if (existsSync(join(freeze.vaultDir, 'KNOWLEDGE.md'))) sources.push('KNOWLEDGE.md');
  return { sources, warnings };
}

export function sheetHeader(freeze: Freeze, seed: number, focus: string[]): Sheet['header'] {
  return {
    protocol: PROTOCOL,
    protocol_revision: PROTOCOL_REVISION,
    freeze_id: freeze.freezeId,
    frozen_at: freeze.manifest.frozenAt,
    frozen_tz: freeze.manifest.timeZone,
    focus_sources: focus,
    session_size: SESSION_SIZE,
    annotator: '',
    pass: 'first',
    sheet_seed: seed,
  };
}

export function drawSample(freeze: Freeze, queue: FrozenQueue, options: SampleOptions): SampleResult {
  const size = options.size ?? DEFAULT_SAMPLE_SIZE;
  const floor = options.floor ?? DEFAULT_FLOOR;
  const useJev = options.useJevStrata ?? queue.hasJevScores;
  const warnings: string[] = [];
  if (useJev && !queue.hasJevScores) throw new Error('Jev strata requested, but the freeze has no current 1.6.0 scores');

  const seeded = [...new Set(options.seeded ?? [])];
  if (seeded.length > MAX_SEEDED) throw new Error(`At most ${MAX_SEEDED} seeded notes (got ${seeded.length})`);
  const notQueued = seeded.filter((path) => !queue.byPath.has(path));
  if (notQueued.length > 0) throw new Error(`Seeded notes must be uncooked notes in the freeze: ${notQueued.join(', ')}`);

  const { eligible, ineligible } = eligibility(queue.notes);
  let usedJev = useJev;
  let cells = cellsOf(eligible, usedJev);
  if (usedJev && cells.size > Math.min(size, eligible.length)) {
    warnings.push(`${cells.size} age × Jev strata exceed the sample of ${size}; falling back to age-only strata so every stratum keeps π > 0`);
    usedJev = false;
    cells = cellsOf(eligible, usedJev);
  }
  const allocation = allocate(new Map([...cells].map(([key, notes]) => [key, notes.length])), size, floor);
  const strata: StratumRecord[] = [...cells.keys()].sort().map((key) => ({
    key, population: cells.get(key)?.length ?? 0, allocated: allocation.get(key) ?? 0,
  }));

  const entriesByPath = new Map<string, PrivateEntry>();
  for (const stratum of strata) {
    const members = [...(cells.get(stratum.key) ?? [])].sort((a, b) => a.dirFamily.localeCompare(b.dirFamily) || a.path.localeCompare(b.path));
    const picked = systematic(members, stratum.allocated, mulberry32(deriveSeed(options.seed, `stratum:${stratum.key}`)));
    for (const note of picked) {
      entriesByPath.set(note.path, { path: note.path, sources: ['diagnostic'], stratum: stratum.key, pi: stratum.allocated / stratum.population });
    }
  }
  for (const path of seeded) {
    const entry = entriesByPath.get(path);
    if (entry) entry.sources.push('seeded');
    else entriesByPath.set(path, { path, sources: ['seeded'] });
  }
  if (ineligible.length > 0) warnings.push(`${ineligible.length} older snapshot(s) beyond ${MAX_SNAPSHOTS_PER_DOCUMENT} per document are outside the estimation population`);

  const paths = shuffle([...entriesByPath.keys()].sort(), mulberry32(deriveSeed(options.seed, 'sheet-order')));
  const ids = assignIds(paths, options.seed);
  const entries: Record<string, PrivateEntry> = {};
  for (const path of paths) entries[ids.get(path) as string] = entriesByPath.get(path) as PrivateEntry;

  const focus = focusSources(freeze);
  warnings.push(...focus.warnings);
  return {
    sheet: {
      header: sheetHeader(freeze, options.seed, focus.sources),
      notes: paths.map((path) => blankNote(ids.get(path) as string, path)),
      selected_next: [],
    },
    privateFile: {
      kind: 'cv-eval-private',
      protocol: PROTOCOL,
      protocolRevision: PROTOCOL_REVISION,
      freezeId: freeze.freezeId,
      seed: options.seed,
      createdAt: (options.now ?? new Date()).toISOString(),
      sample: { size, floor, usedJevStrata: usedJev, strata, ineligible },
      pool: null,
      entries,
    },
    warnings,
  };
}
