import matter from 'gray-matter';
import { runQuery } from '../query/engine';
import type { VaultSnapshot } from '../query/scan';
import type { UncookedNote } from '../query/staleness';
import { askJev, JEV_MODEL, type JevNoulAnswer, type JevRequest, type JevResponse, type JevTransport } from './client';
import { CONFIDENT_NO, CONFIDENT_YES, buildTriagePrompt } from './triage-store';

export { CONFIDENT_NO, CONFIDENT_YES, buildTriagePrompt };

/**
 * Jev cook triage: rank uncooked notes by how likely each holds durable knowledge and
 * suggest which compiled page should absorb it. Measured in evals/jev-triage: Jev's
 * confident-yes band was clean on real notes, so it is used as a *ranker* in front of
 * /cook — never as a filter that hides notes. The mechanical staleness report is
 * unchanged; this layer only reorders it when the user has opted in with a key.
 *
 * Privacy boundary: Jev receives the note path, title, frontmatter and the first
 * PREVIEW_LINES non-empty body lines, plus the titles/descriptions of the shortlisted
 * compiled pages. Never full bodies.
 */

/** Notes triaged per run, bounding both latency and spend (≈ TRIAGE_CAP × ~2k tokens). */
export const TRIAGE_CAP = 40;
export const TRIAGE_CONCURRENCY = 4;
export const PREVIEW_LINES = 15;
export const PREVIEW_MAX_CHARS = 3000;
export const TARGET_CANDIDATES = 5;
/** Below this best "same subject" probability the note is treated as needing a new page. */
export const NEW_THRESHOLD = 0.5;

export interface TriageCandidatePage {
  path: string;
  title: string;
  description?: string;
}

export interface TriageNoteView {
  path: string;
  title: string;
  frontmatter: string;
  preview: string;
}

export interface TriageScore {
  path: string;
  title: string;
  mtimeMs: number;
  /** Probability that the note holds durable, compile-worthy knowledge. */
  worth: number;
  /** Suggested compiled page to update, or null when a new page is the better fit. */
  target: { path: string; title: string; score: number } | null;
  inputTokens: number;
}

export interface TriageFailure {
  path: string;
  message: string;
}

export interface TriageOutcome {
  scores: TriageScore[];
  failures: TriageFailure[];
  /** Notes beyond TRIAGE_CAP that were not sent. */
  skipped: number;
}

export interface TriageDeps {
  snapshot: VaultSnapshot;
  readNote: (path: string) => Promise<string>;
  transport: JevTransport;
  apiKey: string;
  /** Shell-owned cache keyed by cacheKey(); lets re-opening the screen cost nothing. */
  cache?: Map<string, TriageScore>;
  onProgress?: (done: number, total: number) => void;
}

export function cacheKey(note: Pick<UncookedNote, 'path' | 'mtimeMs'>): string {
  return `${note.path}@${note.mtimeMs}`;
}

export function notePreview(path: string, raw: string): TriageNoteView & { tags: string[]; firstLine: string } {
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  // gray-matter caches parsed objects by input and the cached copy drops `.matter`, so
  // the raw block is extracted directly.
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1]?.trim() ?? '';
  const lines = parsed.content.split('\n').filter((line) => line.trim().length > 0);
  let preview = lines.slice(0, PREVIEW_LINES).join('\n');
  if (preview.length > PREVIEW_MAX_CHARS) preview = `${preview.slice(0, PREVIEW_MAX_CHARS)}\n…`;
  const basename = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
  const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : basename;
  const tags = Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  return { path, title, frontmatter, preview, tags, firstLine: lines[0] ?? '' };
}

/** Compiled pages that might already cover the note's subject, from the deterministic engine. */
export function shortlistCandidates(view: { title: string; tags: string[]; firstLine: string }, snapshot: VaultSnapshot): TriageCandidatePage[] {
  const question = `${view.title} ${view.tags.join(' ')} ${view.firstLine}`.trim();
  if (!question) return [];
  // Debug mode returns candidates even when the abstain gate would hide them.
  const result = runQuery(question, snapshot, TARGET_CANDIDATES * 4, { debug: true });
  const list = result.debugCandidates ?? result.candidates;
  return list
    .filter((candidate) => candidate.tier === 'agent')
    .slice(0, TARGET_CANDIDATES)
    .map((candidate) => ({ path: candidate.path, title: candidate.title, description: candidate.description }));
}

export function buildTriageRequest(view: TriageNoteView, candidates: TriageCandidatePage[]): JevRequest {
  const pages = candidates.map((candidate, index) => ({
    id: `p${index + 1}`,
    path: candidate.path,
    title: candidate.title,
    description: candidate.description ?? '',
  }));
  const questions: JevRequest['questions'] = {
    worth_compiling: {
      type: 'noul',
      instructions: 'Does `note` contain durable knowledge worth compiling into a knowledge-base page: facts, decisions, requirements, rationale, definitions, or specifications about a named system, project, person, or concept?',
      criteria: {
        true: 'The note records decisions, requirements, rationale, definitions, or specifications that would still be useful to someone asking about this subject later.',
        false: 'The note is transient or raw (an agenda with no outcomes, a log, a scratch draft, generated output, boilerplate, a template).',
      },
    },
  };
  for (const page of pages) {
    questions[`same_subject_${page.id}`] = {
      type: 'noul',
      instructions: `Is the \`existing_pages\` entry with id ${page.id} about the same subject as \`note\`, so that the information in \`note\` belongs on that page rather than on a new one?`,
      criteria: {
        true: "The page and the note describe the same system, project, decision thread, or concept; a reader looking for the note's information would open this page.",
        false: "The page merely shares a domain, team, or a few keywords with the note; its subject is different and the note's information would be out of place there.",
      },
    };
  }
  return {
    state: {
      note: { path: view.path, title: view.title, frontmatter: view.frontmatter, preview: view.preview },
      existing_pages: pages,
    },
    model: JEV_MODEL,
    questions,
  };
}

export function readTriageAnswer(
  response: JevResponse,
  candidates: TriageCandidatePage[],
): { worth: number; target: TriageScore['target'] } {
  const worth = noul(response, 'worth_compiling');
  let target: TriageScore['target'] = null;
  let best = -1;
  candidates.forEach((candidate, index) => {
    const score = noul(response, `same_subject_p${index + 1}`);
    if (score > best) {
      best = score;
      target = score >= NEW_THRESHOLD ? { path: candidate.path, title: candidate.title, score } : null;
    }
  });
  return { worth, target };
}

function noul(response: JevResponse, name: string): number {
  const answer = response.answers[name] as JevNoulAnswer | undefined;
  const value = answer?.noul;
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export async function triageUncookedNotes(notes: UncookedNote[], deps: TriageDeps): Promise<TriageOutcome> {
  const batch = notes.slice(0, TRIAGE_CAP);
  const scores: TriageScore[] = [];
  const failures: TriageFailure[] = [];
  let done = 0;
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < batch.length) {
      const note = batch[next++];
      try {
        scores.push(await triageOne(note, deps));
      } catch (error) {
        failures.push({ path: note.path, message: error instanceof Error ? error.message : String(error) });
      } finally {
        done += 1;
        deps.onProgress?.(done, batch.length);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(TRIAGE_CONCURRENCY, batch.length) }, worker));

  return { scores: sortScores(scores), failures, skipped: notes.length - batch.length };
}

async function triageOne(note: UncookedNote, deps: TriageDeps): Promise<TriageScore> {
  const key = cacheKey(note);
  const cached = deps.cache?.get(key);
  if (cached) return cached;

  const view = notePreview(note.path, await deps.readNote(note.path));
  const candidates = shortlistCandidates(view, deps.snapshot);
  const response = await askJev(deps.transport, deps.apiKey, buildTriageRequest(view, candidates));
  const { worth, target } = readTriageAnswer(response, candidates);
  const score: TriageScore = {
    path: note.path,
    title: note.title,
    mtimeMs: note.mtimeMs,
    worth,
    target,
    inputTokens: response.usage?.input_tokens ?? 0,
  };
  deps.cache?.set(key, score);
  return score;
}

export function sortScores(scores: TriageScore[]): TriageScore[] {
  return [...scores].sort((a, b) => b.worth - a.worth || b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
}
