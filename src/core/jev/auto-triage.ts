import type { VaultFs } from '../vault-fs';
import type { VaultSnapshot } from '../query/scan';
import { computeStaleness, type StalenessReport } from '../query/staleness';
import type { JevTransport } from './client';
import { JEV_MODEL } from './model';
import { triageUncookedNotes, type TriageOutcome } from './triage';
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

/** The environment variable CLI and MCP shells read the key from. Never persisted by Knowlery. */
export const JEV_API_KEY_ENV = 'TYPESAFE_API_KEY';

export function jevApiKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env[JEV_API_KEY_ENV]?.trim();
  return key ? key : undefined;
}
