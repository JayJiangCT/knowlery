import type { StalenessReport, UncookedNote } from '../query/staleness';
import type { VaultFs } from '../vault-fs';

/**
 * Persisted Jev triage scores (`.knowlery/triage.json`): the bridge that lets every
 * transport of the staleness report — MCP `stale`, `knowlery stale`,
 * `obsidian knowlery:stale`, `.knowlery/bin/query.mjs --stale` — carry Jev's ranking
 * without any of them talking to Jev. Producers (the plugin's background scorer, or
 * the CLI/MCP when `TYPESAFE_API_KEY` is in the environment) write it; readers only
 * parse it. It is a cache keyed by note path + mtime: a note that changes is unscored
 * again, and entries for notes that are no longer uncooked are pruned on write.
 *
 * Holds scores, suggested target paths/titles, and the model name. Never the API key,
 * never note content. Pure module: no `obsidian`, no network, no node:fs.
 */

export const TRIAGE_PATH = '.knowlery/triage.json';

/** Jev's guidance: act at the ends, escalate the middle. Loose band validated in evals/jev-triage. */
export const CONFIDENT_YES = 0.8;
export const CONFIDENT_NO = 0.2;

export interface TriageTarget {
  path: string;
  title: string;
  score: number;
}

export interface TriageEntry {
  /** The note's mtime when scored; a different mtime means the entry is stale. */
  mtimeMs: number;
  worth: number;
  target: TriageTarget | null;
  /** ISO timestamp, informational. */
  scoredAt: string;
}

export interface TriageStore {
  schemaVersion: 1;
  /** Jev model the entries were produced with; entries from another model are ignored. */
  model: string;
  entries: Record<string, TriageEntry>;
}

/** What rides on an uncooked note once annotated; the shape agents see in the report. */
export interface JevAnnotation {
  worth: number;
  target: { path: string; title: string } | null;
}

export function emptyTriageStore(model: string): TriageStore {
  return { schemaVersion: 1, model, entries: {} };
}

/**
 * Tolerant parse: this is a cache, so a malformed file is simply an empty one (unlike
 * `.knowlery/config.json`, where silent emptiness would change what gets indexed).
 */
export function parseTriageStore(raw: string | null | undefined, model: string): TriageStore {
  if (raw === null || raw === undefined || raw.trim() === '') return emptyTriageStore(model);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptyTriageStore(model);
  }
  if (typeof data !== 'object' || data === null) return emptyTriageStore(model);
  const record = data as { model?: unknown; entries?: unknown };
  if (record.model !== model || typeof record.entries !== 'object' || record.entries === null) {
    return emptyTriageStore(model);
  }
  const entries: Record<string, TriageEntry> = {};
  for (const [path, value] of Object.entries(record.entries as Record<string, unknown>)) {
    const entry = parseEntry(value);
    if (entry) entries[path] = entry;
  }
  return { schemaVersion: 1, model, entries };
}

/**
 * The cache key must agree across producers: node's `statSync().mtimeMs` carries a
 * fractional part (1791619688991.5247) while Obsidian's `file.stat.mtime` is the same
 * instant rounded to whole milliseconds (1791619688992). Values are stored rounded the
 * way Obsidian rounds, and compared with a sub-millisecond tolerance so that neither
 * side's rounding convention — nor a file written before this normalisation — can
 * make the two shells disagree about whether a note is already scored.
 */
export function triageMtime(mtimeMs: number): number {
  return Math.round(mtimeMs);
}

export function sameMtime(a: number, b: number): boolean {
  return Math.abs(a - b) < 1;
}

function parseEntry(value: unknown): TriageEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.mtimeMs !== 'number' || typeof record.worth !== 'number') return null;
  const target = parseTarget(record.target);
  if (target === undefined) return null;
  return {
    mtimeMs: triageMtime(record.mtimeMs),
    worth: Math.min(1, Math.max(0, record.worth)),
    target,
    scoredAt: typeof record.scoredAt === 'string' ? record.scoredAt : '',
  };
}

/** null is a valid "new page" target; undefined signals a malformed entry. */
function parseTarget(value: unknown): TriageTarget | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.path !== 'string' || typeof record.title !== 'string') return undefined;
  return { path: record.path, title: record.title, score: typeof record.score === 'number' ? record.score : 0 };
}

export function serializeTriageStore(store: TriageStore): string {
  const sorted: Record<string, TriageEntry> = {};
  for (const path of Object.keys(store.entries).sort()) sorted[path] = store.entries[path];
  return `${JSON.stringify({ schemaVersion: 1, model: store.model, entries: sorted }, null, 2)}\n`;
}

export async function readTriageStore(fs: VaultFs, model: string): Promise<TriageStore> {
  if (!(await fs.exists(TRIAGE_PATH))) return emptyTriageStore(model);
  return parseTriageStore(await fs.read(TRIAGE_PATH), model);
}

export async function writeTriageStore(fs: VaultFs, store: TriageStore): Promise<void> {
  if (!(await fs.exists('.knowlery'))) await fs.mkdir('.knowlery');
  await fs.write(TRIAGE_PATH, serializeTriageStore(store));
}

/** The entry for a note, if it was scored at the note's current mtime. */
export function currentEntry(store: TriageStore, note: Pick<UncookedNote, 'path' | 'mtimeMs'>): TriageEntry | null {
  const entry = store.entries[note.path];
  return entry && sameMtime(entry.mtimeMs, note.mtimeMs) ? entry : null;
}

/** Uncooked notes with no current score — what a producer should send to Jev. */
export function unscoredNotes(notes: readonly UncookedNote[], store: TriageStore): UncookedNote[] {
  return notes.filter((note) => currentEntry(store, note) === null);
}

export interface ScoredNote {
  path: string;
  mtimeMs: number;
  worth: number;
  target: TriageTarget | null;
}

/**
 * Records fresh scores and prunes entries that no longer describe an uncooked note at
 * its current mtime, so the file tracks the live report rather than growing forever.
 */
export function recordScores(
  store: TriageStore,
  scores: readonly ScoredNote[],
  uncooked: readonly UncookedNote[],
  now: Date = new Date(),
): TriageStore {
  const entries: Record<string, TriageEntry> = {};
  const live = new Map(uncooked.map((note) => [note.path, note.mtimeMs]));
  for (const [path, entry] of Object.entries(store.entries)) {
    const liveMtime = live.get(path);
    if (liveMtime !== undefined && sameMtime(liveMtime, entry.mtimeMs)) entries[path] = entry;
  }
  const scoredAt = now.toISOString();
  for (const score of scores) {
    entries[score.path] = { mtimeMs: triageMtime(score.mtimeMs), worth: score.worth, target: score.target, scoredAt };
  }
  return { schemaVersion: 1, model: store.model, entries };
}

/**
 * Attaches `jev` to every uncooked note with a current score and reorders the list:
 * notes Jev rates above the confident-no band first, by worth; then unscored notes in
 * the mechanical most-recent-first order; then the confident-no band last. Jev never
 * removes a note — the agent still sees the whole list, just in a better order.
 */
export function annotateWithTriage(report: StalenessReport, store: TriageStore): StalenessReport {
  if (Object.keys(store.entries).length === 0) return report;
  const likely: UncookedNote[] = [];
  const unscored: UncookedNote[] = [];
  const unlikely: UncookedNote[] = [];
  for (const note of report.uncookedNotes) {
    const entry = currentEntry(store, note);
    if (!entry) {
      unscored.push(note);
      continue;
    }
    const annotated: UncookedNote = {
      ...note,
      jev: { worth: entry.worth, target: entry.target ? { path: entry.target.path, title: entry.target.title } : null },
    };
    (entry.worth > CONFIDENT_NO ? likely : unlikely).push(annotated);
  }
  if (likely.length === 0 && unlikely.length === 0) return report;
  const byWorth = (a: UncookedNote, b: UncookedNote) =>
    (b.jev?.worth ?? 0) - (a.jev?.worth ?? 0) || b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path);
  return {
    ...report,
    uncookedNotes: [...likely.sort(byWorth), ...unscored, ...unlikely.sort(byWorth)],
  };
}

/** Agent prompt over a Jev-ranked list; shared by the dashboard action and the cook skill's expectations. */
export function buildTriagePrompt(scores: readonly ScoredNote[]): string {
  const ranked = [...scores].sort((a, b) => b.worth - a.worth || b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
  const likely = ranked.filter((score) => score.worth > CONFIDENT_NO);
  const unlikely = ranked.filter((score) => score.worth <= CONFIDENT_NO);
  const lines = [
    'Run /cook over the uncooked notes below, in this order. A decision model ranked them',
    'by how likely each holds durable knowledge; the score is a probability from a short',
    'preview, not a verdict — read each note and skip it if it turns out to be transient.',
    'Where a target page is suggested, fold the note into that page instead of creating a',
    'new one, following the /cook contradiction and SCHEMA rules.',
    '',
  ];
  for (const score of likely) {
    const target = score.target ? `update ${score.target.path}` : 'new page';
    lines.push(`- ${score.worth.toFixed(2)}  ${score.path}  → ${target}`);
  }
  if (unlikely.length > 0) {
    lines.push('', `Ranked unlikely (≤ ${CONFIDENT_NO}); glance at these last and only if time allows:`);
    for (const score of unlikely) lines.push(`- ${score.worth.toFixed(2)}  ${score.path}`);
  }
  return lines.join('\n');
}

/** The annotated notes of a report as prompt input — what "Copy cook prompt" uses after a store-backed ranking. */
export function scoredNotesOf(report: StalenessReport): ScoredNote[] {
  const scored: ScoredNote[] = [];
  for (const note of report.uncookedNotes) {
    if (!note.jev) continue;
    scored.push({
      path: note.path,
      mtimeMs: note.mtimeMs,
      worth: note.jev.worth,
      target: note.jev.target ? { ...note.jev.target, score: 0 } : null,
    });
  }
  return scored;
}
