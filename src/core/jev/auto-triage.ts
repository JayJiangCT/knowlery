import type { VaultFs } from '../vault-fs';
import type { VaultSnapshot } from '../query/scan';
import { computeStaleness, type StalenessReport } from '../query/staleness';
import type { JevTransport } from './client';
import { JEV_MODEL } from './model';
import { triageUncookedNotes, type TriageFailure, type TriageOutcome, type TriageScore } from './triage';
import { readTriageStore, recordScores, unscoredNotes, writeTriageStore, type TriageStore } from './triage-store';

/**
 * One producer step shared by every shell that holds a key: score the uncooked notes
 * that have no current entry in `.knowlery/triage.json`, write the store, and return
 * the report re-annotated from it. The plugin runs this in the background when the
 * user opts in; `knowlery stale` and the MCP `stale` tool run it when
 * `TYPESAFE_API_KEY` is in the environment. Readers that never score (query.mjs,
 * `obsidian knowlery:stale`) still see the result through the file.
 *
 * The key is used for the HTTP calls and nothing else — it is never written to the
 * vault, the store, or the registry.
 */

export interface AutoTriageDeps {
  fs: VaultFs;
  snapshot: VaultSnapshot;
  readNote: (path: string) => Promise<string>;
  transport: JevTransport;
  apiKey: string;
  onProgress?: (done: number, total: number) => void;
  now?: () => Date;
}

export interface AutoTriageResult {
  report: StalenessReport;
  store: TriageStore;
  /** Null when every uncooked note already had a current score — nothing was sent. */
  outcome: TriageOutcome | null;
}

export async function autoTriage(deps: AutoTriageDeps): Promise<AutoTriageResult> {
  const store = deps.snapshot.triage ?? (await readTriageStore(deps.fs, JEV_MODEL));
  const snapshot: VaultSnapshot = { ...deps.snapshot, triage: store };
  const report = computeStaleness(snapshot);
  const pending = unscoredNotes(report.uncookedNotes, store);
  if (pending.length === 0) return { report, store, outcome: null };

  // Mechanical order (most recent first) is the order worth spending the cap on.
  pending.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
  const outcome = await triageUncookedNotes(pending, {
    snapshot,
    readNote: deps.readNote,
    transport: deps.transport,
    apiKey: deps.apiKey,
    onProgress: deps.onProgress,
  });
  if (outcome.scores.length === 0) return { report, store, outcome };

  const updated = recordScores(store, outcome.scores, report.uncookedNotes, deps.now?.() ?? new Date());
  await writeTriageStore(deps.fs, updated);
  return { report: computeStaleness({ ...snapshot, triage: updated }), store: updated, outcome };
}

export interface AutoTriageAllResult {
  report: StalenessReport;
  store: TriageStore;
  scores: TriageScore[];
  failures: TriageFailure[];
  passes: number;
  /** Notes still unscored when the loop stopped — nonzero only when a whole pass failed. */
  remaining: number;
}

/**
 * Score the whole backlog, TRIAGE_CAP notes per pass, until nothing is left unscored.
 * The one-shot `stale` producers stay capped because they sit on an agent's critical
 * path; this is the deliberate, user-invoked pass (`knowlery triage`, the dashboard's
 * Rank button) that makes a years-old backlog rankable in one go — a 4,000-note vault
 * is on the order of $0.35. A pass in which every note fails stops the loop rather
 * than retrying forever.
 */
export async function autoTriageAll(deps: AutoTriageDeps): Promise<AutoTriageAllResult> {
  let store = deps.snapshot.triage ?? (await readTriageStore(deps.fs, JEV_MODEL));
  let report = computeStaleness({ ...deps.snapshot, triage: store });
  const total = unscoredNotes(report.uncookedNotes, store).length;
  const scores: TriageScore[] = [];
  const failures: TriageFailure[] = [];
  let passes = 0;
  let remaining = total;

  while (remaining > 0) {
    const scoredBefore = scores.length;
    const result = await autoTriage({
      ...deps,
      snapshot: { ...deps.snapshot, triage: store },
      onProgress: (done) => deps.onProgress?.(Math.min(total, scoredBefore + done), total),
    });
    passes += 1;
    store = result.store;
    report = result.report;
    if (!result.outcome) {
      remaining = 0;
      break;
    }
    scores.push(...result.outcome.scores);
    failures.push(...result.outcome.failures);
    remaining = result.outcome.failures.length + result.outcome.skipped;
    if (result.outcome.scores.length === 0) break;
  }

  return { report, store, scores, failures, passes, remaining };
}

export { JEV_API_KEY_ENV, jevApiKeyFromEnv } from './api-key';
