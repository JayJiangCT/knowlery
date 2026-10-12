import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import { runQuery, type QueryCandidate } from '../../src/core/query/engine';
import { scanVault, type VaultSnapshot } from '../../src/core/query/scan';

/**
 * Jev cook-triage experiment, v2 (exploration, not product code).
 *
 * v1 showed Jev is usable as a *ranker* over uncooked notes (its confident-yes band was
 * clean) but not as a filter, and that supersession is a cross-note property it cannot
 * see from one preview. v2 measures exactly those two roles:
 *
 *   1. Ranking — order uncooked notes by Jev's worth_compiling score and compare the
 *      yes-share in the top-k against the mtime order /cook uses today.
 *   2. Update target — a shortlist of up to CANDIDATES compiled pages from a richer
 *      retrieval query, then one Noul per candidate ("same subject?"); the argmax wins,
 *      `new` when nothing clears NEW_THRESHOLD.
 *
 * Deterministic dedupe of `bridge/trusted-read-<doc>-<date>/` snapshots happens in code
 * before any call; only the latest snapshot per document reaches Jev. page_type was
 * dropped: for ticket-shaped notes the question is ill-posed and Jev answered `query`
 * for every note.
 *
 * Runs against a real vault, so it runs on the machine that has the vault:
 *
 *   export TYPESAFE_API_KEY=...
 *   npx tsx evals/jev-triage/run.ts --kb-root "/path/to/vault" --labels evals/jev-triage/labels.yaml
 *
 * labels.yaml is gitignored: it names real notes, and the repository is public. Its
 * format is shown in labels.example.yaml.
 *
 * Options: --model (default jev-1.13.0, pinned), --cache <file>, --out <report.json>.
 * Every API response is cached by request hash, so re-running after editing the metric
 * code costs nothing. Only metadata and the preview leave the machine; never full bodies.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ENDPOINT = process.env.JEV_ENDPOINT ?? 'https://api.typesafe.ai/v1/systemone';
const PRICE_PER_MTOK = 0.042;
const PREVIEW_LINES = 15;
const PREVIEW_MAX_CHARS = 3000;
const CANDIDATES = 8;
/** Highest per-candidate "same subject" probability below this means `new`. */
const NEW_THRESHOLD = 0.5;
const RANK_KS = [5, 10, 20];
/** Jev's own guidance: act at the ends, escalate the middle. Two bands reported. */
const BANDS = [
  { name: 'strict', yes: 0.9, no: 0.1 },
  { name: 'loose', yes: 0.8, no: 0.2 },
];
const BRIDGE_SNAPSHOT = /^bridge\/trusted-read-(.+?)-(\d{8})(?:-[^/]+)?\/document-text\.md$/;

type YesNo = 'yes' | 'no';

interface LabeledNote {
  path: string;
  worth_compiling: YesNo;
  /** Kept in labels.yaml for the record; not scored in v2. */
  type_if_yes?: string;
  /** Vault-relative path of the compiled page this note should update, or "new". */
  matches_existing_page?: string;
}

interface NoulAnswer { type: 'noul'; noul: number }
interface JevResponse {
  model: string;
  answers: Record<string, NoulAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

interface NoteResult {
  path: string;
  label: LabeledNote;
  mtimeMs: number;
  /** Set by the code-side dedupe; such notes never reach Jev. */
  supersededBy?: string;
  candidates: string[];
  targetInCandidates: boolean | null;
  worth: number;
  /** Per-candidate "same subject" probabilities, aligned with `candidates`. */
  sameSubject: number[];
  /** Undefined only for superseded notes, which never reach Jev. */
  target?: { choice: string; score: number };
  inputTokens: number;
  cached: boolean;
}

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function preview(raw: string): { frontmatter: string; body: string; firstLine: string; data: Record<string, unknown> } {
  const parsed = matter(raw);
  // gray-matter caches by input string and the cached object drops `.matter`
  // (scanVault parsed this same content first), so take the raw block ourselves.
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1]?.trim() ?? '';
  const lines = parsed.content.split('\n').filter((line) => line.trim().length > 0);
  let body = lines.slice(0, PREVIEW_LINES).join('\n');
  if (body.length > PREVIEW_MAX_CHARS) body = `${body.slice(0, PREVIEW_MAX_CHARS)}\n…`;
  return { frontmatter, body, firstLine: lines[0] ?? '', data: parsed.data as Record<string, unknown> };
}

function compiledCandidates(question: string, snapshot: VaultSnapshot): QueryCandidate[] {
  // debug mode returns candidates even when the gate abstains — we want the shortlist regardless.
  const result = runQuery(question, snapshot, 30, { debug: true });
  const list = result.debugCandidates ?? result.candidates;
  return list.filter((candidate) => candidate.tier === 'agent').slice(0, CANDIDATES);
}

/**
 * Among `bridge/trusted-read-<doc>-<date>[-suffix]/document-text.md` notes, keep the
 * latest snapshot per document (date in the path, mtime as tiebreak). Returns a map
 * from superseded path to the path that supersedes it.
 */
function dedupeBridgeSnapshots(notes: { path: string; mtimeMs: number }[]): Map<string, string> {
  const latest = new Map<string, { path: string; date: string; mtimeMs: number }>();
  for (const note of notes) {
    const match = BRIDGE_SNAPSHOT.exec(note.path);
    if (!match) continue;
    const [, doc, date] = match;
    const current = latest.get(doc);
    if (!current || date > current.date || (date === current.date && note.mtimeMs > current.mtimeMs)) {
      latest.set(doc, { path: note.path, date, mtimeMs: note.mtimeMs });
    }
  }
  const superseded = new Map<string, string>();
  for (const note of notes) {
    const match = BRIDGE_SNAPSHOT.exec(note.path);
    if (!match) continue;
    const winner = latest.get(match[1])!;
    if (winner.path !== note.path) superseded.set(note.path, winner.path);
  }
  return superseded;
}

async function askJev(
  body: object,
  apiKey: string,
  cache: Record<string, JevResponse>,
): Promise<{ response: JevResponse; cached: boolean }> {
  const serialized = JSON.stringify(body);
  const key = sha(serialized);
  if (cache[key]) return { response: cache[key], cached: true };

  let delay = 1000;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: serialized,
    });
    if (res.status === 429 || res.status === 529) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay));
      delay *= 2;
      continue;
    }
    if (!res.ok) throw new Error(`Jev ${res.status}: ${await res.text()}`);
    const response = (await res.json()) as JevResponse;
    cache[key] = response;
    return { response, cached: false };
  }
  throw new Error('Jev: rate-limited after 6 attempts');
}

async function evaluateNote(
  label: LabeledNote,
  mtimeMs: number,
  kbRoot: string,
  snapshot: VaultSnapshot,
  model: string,
  apiKey: string,
  cache: Record<string, JevResponse>,
): Promise<NoteResult> {
  const raw = readFileSync(join(kbRoot, label.path), 'utf8');
  const view = preview(raw);
  const title = typeof view.data.title === 'string' ? view.data.title : basename(label.path, '.md');
  const tags = Array.isArray(view.data.tags) ? view.data.tags.join(' ') : '';
  const candidates = compiledCandidates(`${title} ${tags} ${view.firstLine}`.trim(), snapshot);

  const state = {
    note: { path: label.path, title, frontmatter: view.frontmatter, preview: view.body },
    existing_pages: candidates.map((candidate, index) => ({
      id: `p${index + 1}`,
      path: candidate.path,
      title: candidate.title,
      description: candidate.description ?? '',
    })),
  };

  const questions: Record<string, object> = {
    worth_compiling: {
      type: 'noul',
      instructions: 'Does `note` contain durable knowledge worth compiling into a knowledge-base page: facts, decisions, requirements, rationale, definitions, or specifications about a named system, project, person, or concept?',
      criteria: {
        true: 'The note records decisions, requirements, rationale, definitions, or specifications that would still be useful to someone asking about this subject later.',
        false: 'The note is transient or raw (an agenda with no outcomes, a log, a scratch draft, generated output, boilerplate, a template).',
      },
    },
  };
  for (const page of state.existing_pages) {
    questions[`same_subject_${page.id}`] = {
      type: 'noul',
      instructions: `Is the page \`existing_pages\` entry with id ${page.id} about the same subject as \`note\`, so that the information in \`note\` belongs on that page rather than on a new one?`,
      criteria: {
        true: 'The page and the note describe the same system, project, decision thread, or concept; a reader looking for the note\'s information would open this page.',
        false: 'The page merely shares a domain, team, or a few keywords with the note; its subject is different and the note\'s information would be out of place there.',
      },
    };
  }

  const { response, cached } = await askJev({ state, model, questions }, apiKey, cache);
  const worth = response.answers.worth_compiling.noul;
  const candidatePaths = candidates.map((candidate) => candidate.path);
  const sameSubject = state.existing_pages.map((page) => response.answers[`same_subject_${page.id}`].noul);

  // No shortlist at all means retrieval found nothing on the subject: that is `new` by definition.
  let target: NoteResult['target'] = { choice: 'new', score: 1 };
  if (candidatePaths.length > 0) {
    const best = sameSubject.reduce((bestIndex, score, index) => (score > sameSubject[bestIndex] ? index : bestIndex), 0);
    target = sameSubject[best] >= NEW_THRESHOLD
      ? { choice: candidatePaths[best], score: sameSubject[best] }
      : { choice: 'new', score: 1 - sameSubject[best] };
  }

  const labelTarget = label.matches_existing_page;
  return {
    path: label.path,
    label,
    mtimeMs,
    candidates: candidatePaths,
    targetInCandidates: labelTarget && labelTarget !== 'new' ? candidatePaths.includes(labelTarget) : null,
    worth,
    sameSubject,
    target,
    inputTokens: response.usage.input_tokens,
    cached,
  };
}

function pct(numerator: number, denominator: number): string {
  return denominator === 0 ? '—' : `${((100 * numerator) / denominator).toFixed(1)}% (${numerator}/${denominator})`;
}

function isYes(r: NoteResult): boolean {
  return r.label.worth_compiling === 'yes';
}

/** Average precision of the positive labels under `order` (1.0 = every yes ranked above every no). */
function averagePrecision(order: NoteResult[]): number {
  let hits = 0;
  let sum = 0;
  order.forEach((r, index) => {
    if (!isYes(r)) return;
    hits += 1;
    sum += hits / (index + 1);
  });
  return hits === 0 ? 0 : sum / hits;
}

function report(results: NoteResult[]): string {
  const lines: string[] = [];
  const positives = results.filter(isYes).length;
  lines.push(`## Jev cook-triage experiment v2 — ${results.length} notes (${positives} labeled yes, ${results.length - positives} labeled no)`, '');

  const superseded = results.filter((r) => r.supersededBy);
  lines.push('### Code-side dedupe of bridge snapshots', '');
  lines.push(`- superseded snapshots skipped: ${superseded.length}; labeled no: ${pct(superseded.filter((r) => !isYes(r)).length, superseded.length)}`);
  for (const r of superseded) lines.push(`  - ${r.path} → ${r.supersededBy} (label: ${r.label.worth_compiling})`);

  const evaluated = results.filter((r) => !r.supersededBy);
  lines.push('', '### Ranking — yes-share in the top-k when ordered by…', '');
  const orders: [string, NoteResult[]][] = [
    ['mtime, newest first (today\'s /cook order)', [...results].sort((a, b) => b.mtimeMs - a.mtimeMs)],
    ['Jev worth_compiling (superseded notes pinned to 0)', [...results].sort((a, b) => b.worth - a.worth || b.mtimeMs - a.mtimeMs)],
    ['Jev worth_compiling, Jev-evaluated notes only', [...evaluated].sort((a, b) => b.worth - a.worth || b.mtimeMs - a.mtimeMs)],
  ];
  lines.push(`| order | ${RANK_KS.map((k) => `top-${k}`).join(' | ')} | avg precision |`, `|---|${RANK_KS.map(() => '---').join('|')}|---|`);
  for (const [name, order] of orders) {
    const cells = RANK_KS.map((k) => {
      const head = order.slice(0, k);
      return pct(head.filter(isYes).length, head.length);
    });
    lines.push(`| ${name} | ${cells.join(' | ')} | ${averagePrecision(order).toFixed(3)} |`);
  }
  lines.push(`| (random expectation) | ${RANK_KS.map(() => `${((100 * positives) / results.length).toFixed(1)}%`).join(' | ')} | — |`);

  lines.push('', '### worth_compiling (Noul) — precision inside the confident bands (Jev-evaluated notes)', '');
  lines.push('| band | thresholds | confident-yes precision | confident-no precision | uncertain share |', '|---|---|---|---|---|');
  for (const band of BANDS) {
    const yes = evaluated.filter((r) => r.worth >= band.yes);
    const no = evaluated.filter((r) => r.worth <= band.no);
    const uncertain = evaluated.length - yes.length - no.length;
    lines.push(
      `| ${band.name} | ≥${band.yes} / ≤${band.no} | ${pct(yes.filter(isYes).length, yes.length)} | ${pct(no.filter((r) => !isYes(r)).length, no.length)} | ${pct(uncertain, evaluated.length)} |`,
    );
  }

  const withTarget = evaluated.filter((r) => r.label.matches_existing_page && r.target);
  const reachable = withTarget.filter((r) => r.label.matches_existing_page === 'new' || r.targetInCandidates);
  const targetCorrect = (r: NoteResult) => r.target!.choice === r.label.matches_existing_page;
  const labeledNew = withTarget.filter((r) => r.label.matches_existing_page === 'new');
  lines.push('', `### update_target — argmax of per-candidate "same subject" Noul, \`new\` below ${NEW_THRESHOLD}`, '');
  lines.push(`- labeled target retrievable in top-${CANDIDATES}: ${pct(evaluated.filter((r) => r.targetInCandidates === true).length, evaluated.filter((r) => r.targetInCandidates !== null).length)} (a miss here is a retrieval gap, not a Jev error)`);
  lines.push(`- accuracy where the target was reachable: ${pct(reachable.filter(targetCorrect).length, reachable.length)}`);
  for (const gate of [0.7, 0.9]) {
    const confident = reachable.filter((r) => r.target!.score >= gate);
    lines.push(`- accuracy where reachable and winning score ≥ ${gate}: ${pct(confident.filter(targetCorrect).length, confident.length)}`);
  }
  lines.push(`- \`new\` recall (labeled new → answered new): ${pct(labeledNew.filter(targetCorrect).length, labeledNew.length)}`);
  lines.push(`- \`new\` precision (answered new → labeled new): ${pct(withTarget.filter((r) => r.target!.choice === 'new' && targetCorrect(r)).length, withTarget.filter((r) => r.target!.choice === 'new').length)}`);

  const tokens = results.reduce((sum, r) => sum + r.inputTokens, 0);
  lines.push('', `### Cost: ${tokens.toLocaleString()} input tokens ≈ $${((tokens / 1e6) * PRICE_PER_MTOK).toFixed(4)} (${evaluated.filter((r) => r.cached).length} cached, ${superseded.length} skipped by dedupe)`);

  lines.push('', '### Per note (sorted by worth_compiling)', '');
  lines.push('| worth | label | target (score) | labeled target | path |', '|---|---|---|---|---|');
  for (const r of [...results].sort((a, b) => b.worth - a.worth || b.mtimeMs - a.mtimeMs)) {
    const target = r.supersededBy
      ? `superseded by ${basename(dirname(r.supersededBy))}`
      : r.target ? `${r.target.choice === 'new' ? 'new' : basename(r.target.choice)} (${r.target.score.toFixed(2)})` : '—';
    const labeled = r.label.matches_existing_page ? (r.label.matches_existing_page === 'new' ? 'new' : basename(r.label.matches_existing_page)) : '—';
    lines.push(`| ${r.worth.toFixed(2)} | ${r.label.worth_compiling} | ${target} | ${labeled} | ${r.path} |`);
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  const kbRoot = arg('kb-root');
  const labelsPath = arg('labels', join(HERE, 'labels.yaml'))!;
  if (!apiKey || !kbRoot) {
    console.error('Usage: TYPESAFE_API_KEY=... npx tsx evals/jev-triage/run.ts --kb-root <vault> [--labels <yaml>] [--model <id>] [--cache <file>] [--out <file>]');
    process.exit(2);
  }
  const model = arg('model', 'jev-1.13.0')!;
  const cachePath = resolve(arg('cache', join(HERE, 'cache.json'))!);
  const outPath = resolve(arg('out', join(HERE, 'report.json'))!);

  const labels = (parseYaml(readFileSync(labelsPath, 'utf8')) as { notes: LabeledNote[] }).notes;
  const cache: Record<string, JevResponse> = existsSync(cachePath)
    ? (JSON.parse(readFileSync(cachePath, 'utf8')) as Record<string, JevResponse>)
    : {};
  const snapshot = scanVault(kbRoot);

  const mtimes = new Map(labels.map((label) => [label.path, statSync(join(kbRoot, label.path)).mtimeMs]));
  const superseded = dedupeBridgeSnapshots(labels.map((label) => ({ path: label.path, mtimeMs: mtimes.get(label.path)! })));

  const results: NoteResult[] = [];
  for (const label of labels) {
    const mtimeMs = mtimes.get(label.path)!;
    const supersededBy = superseded.get(label.path);
    if (supersededBy) {
      results.push({ path: label.path, label, mtimeMs, supersededBy, candidates: [], targetInCandidates: null, worth: 0, sameSubject: [], inputTokens: 0, cached: false });
      continue;
    }
    try {
      results.push(await evaluateNote(label, mtimeMs, kbRoot, snapshot, model, apiKey, cache));
    } catch (error) {
      console.error(`skip ${label.path}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      writeFileSync(cachePath, JSON.stringify(cache));
    }
  }

  writeFileSync(outPath, JSON.stringify({ model, generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(report(results));
  console.log(`\nReport written to ${outPath}`);
}

void main();
