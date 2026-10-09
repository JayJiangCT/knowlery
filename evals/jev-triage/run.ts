import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parse as parseYaml } from 'yaml';
import { runQuery, type QueryCandidate } from '../../src/core/query/engine';
import { scanVault, type VaultSnapshot } from '../../src/core/query/scan';

/**
 * Jev cook-triage experiment (exploration, not product code).
 *
 * For every labeled uncooked note, sends Jev the note's *preview* (title, frontmatter,
 * first PREVIEW_LINES body lines) plus the top retrieved compiled pages, and asks three
 * typed questions: is it worth compiling (Noul), which existing page it should update
 * (Choice), and which page type it would be (Choice). Reports precision inside Jev's
 * confident bands against the human labels — the number that decides whether a
 * confidence-gated triage step in front of /cook is viable.
 *
 * Runs against a real vault, so it runs on the machine that has the vault:
 *
 *   export TYPESAFE_API_KEY=...
 *   npx tsx evals/jev-triage/run.ts --kb-root "/path/to/vault" --labels evals/jev-triage/labels.yaml
 *
 * Options: --model (default jev-1.13.0, pinned), --cache <file>, --out <report.json>.
 * Every API response is cached by request hash, so re-running after editing the metric
 * code costs nothing. Only metadata and the preview leave the machine; never full bodies.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const PRICE_PER_MTOK = 0.042;
const PREVIEW_LINES = 15;
const PREVIEW_MAX_CHARS = 3000;
const CANDIDATES = 5;
/** Jev's own guidance: act at the ends, escalate the middle. Two bands reported. */
const BANDS = [
  { name: 'strict', yes: 0.9, no: 0.1 },
  { name: 'loose', yes: 0.8, no: 0.2 },
];

const PAGE_TYPES: Record<string, string> = {
  entity: 'A named thing: a system, service, team, person, product, or tool. The page describes what it is, who owns it, and how it relates to others.',
  concept: 'An abstract idea, principle, pattern, policy, or rule that is explained and applies across more than one situation.',
  comparison: 'Two or more options weighed against each other, with the trade-offs and the choice made.',
  query: 'An answer to a specific question, decision record, or alignment outcome tied to a particular date, meeting, ticket, or project milestone.',
};

type YesNo = 'yes' | 'no';

interface LabeledNote {
  path: string;
  worth_compiling: YesNo;
  type_if_yes?: keyof typeof PAGE_TYPES;
  /** Vault-relative path of the compiled page this note should update, or "new". */
  matches_existing_page?: string;
}

interface ChoiceAnswer { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
interface NoulAnswer { type: 'noul'; noul: number }
interface JevResponse {
  model: string;
  answers: Record<string, ChoiceAnswer | NoulAnswer>;
  usage: { input_tokens: number; output_tokens: number };
}

interface NoteResult {
  path: string;
  label: LabeledNote;
  candidates: string[];
  targetInCandidates: boolean | null;
  worth: number;
  target?: { choice: string; confidence: number };
  pageType?: { choice: string; confidence: number };
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

function preview(raw: string): { frontmatter: string; body: string; data: Record<string, unknown> } {
  const parsed = matter(raw);
  // gray-matter caches by input string and the cached object drops `.matter`
  // (scanVault parsed this same content first), so take the raw block ourselves.
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1]?.trim() ?? '';
  const lines = parsed.content.split('\n');
  let body = lines.slice(0, PREVIEW_LINES).join('\n');
  if (body.length > PREVIEW_MAX_CHARS) body = `${body.slice(0, PREVIEW_MAX_CHARS)}\n…`;
  return { frontmatter, body, data: parsed.data as Record<string, unknown> };
}

function compiledCandidates(question: string, snapshot: VaultSnapshot): QueryCandidate[] {
  // debug mode returns candidates even when the gate abstains — we want the shortlist regardless.
  const result = runQuery(question, snapshot, 20, { debug: true });
  const list = result.debugCandidates ?? result.candidates;
  return list.filter((candidate) => candidate.tier === 'agent').slice(0, CANDIDATES);
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
  const candidates = compiledCandidates(`${title} ${tags}`.trim(), snapshot);

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
        false: 'The note is transient or raw (an agenda with no outcomes, a log, a scratch draft, generated output, boilerplate, a template) or is a superseded duplicate of another note.',
      },
    },
    page_type: {
      type: 'choice',
      instructions: 'If `note` were compiled into a knowledge page, which page type fits best?',
      criteria: PAGE_TYPES,
    },
  };
  if (candidates.length > 0) {
    const criteria: Record<string, string> = {};
    for (const page of state.existing_pages) criteria[page.id] = `${page.title} — ${page.description}`;
    criteria.new = 'None of the existing pages covers the subject of `note`; a new page would be needed.';
    questions.update_target = {
      type: 'choice',
      instructions: 'Which entry in `existing_pages` should be updated with the information in `note`? Answer `new` if none of them is about the same subject.',
      criteria,
    };
  }

  const { response, cached } = await askJev({ state, model, questions }, apiKey, cache);
  const worth = response.answers.worth_compiling as NoulAnswer;
  const pageType = response.answers.page_type as ChoiceAnswer;
  const target = response.answers.update_target as ChoiceAnswer | undefined;

  const labelTarget = label.matches_existing_page;
  const candidatePaths = candidates.map((candidate) => candidate.path);
  return {
    path: label.path,
    label,
    candidates: candidatePaths,
    targetInCandidates: labelTarget && labelTarget !== 'new' ? candidatePaths.includes(labelTarget) : null,
    worth: worth.noul,
    pageType: { choice: pageType.choice, confidence: pageType.confidence },
    target: target
      ? { choice: target.choice === 'new' ? 'new' : candidatePaths[Number(target.choice.slice(1)) - 1], confidence: target.confidence }
      : undefined,
    inputTokens: response.usage.input_tokens,
    cached,
  };
}

function pct(numerator: number, denominator: number): string {
  return denominator === 0 ? '—' : `${((100 * numerator) / denominator).toFixed(1)}% (${numerator}/${denominator})`;
}

function report(results: NoteResult[]): string {
  const lines: string[] = [];
  const positives = results.filter((r) => r.label.worth_compiling === 'yes').length;
  lines.push(`## Jev cook-triage experiment — ${results.length} notes (${positives} labeled yes, ${results.length - positives} labeled no)`, '');

  lines.push('### worth_compiling (Noul) — precision inside the confident bands', '');
  lines.push('| band | thresholds | confident-yes precision | confident-no precision | uncertain share |', '|---|---|---|---|---|');
  for (const band of BANDS) {
    const yes = results.filter((r) => r.worth >= band.yes);
    const no = results.filter((r) => r.worth <= band.no);
    const uncertain = results.length - yes.length - no.length;
    lines.push(
      `| ${band.name} | ≥${band.yes} / ≤${band.no} | ${pct(yes.filter((r) => r.label.worth_compiling === 'yes').length, yes.length)} | ${pct(no.filter((r) => r.label.worth_compiling === 'no').length, no.length)} | ${pct(uncertain, results.length)} |`,
    );
  }

  const withTarget = results.filter((r) => r.label.matches_existing_page && r.target);
  const reachable = withTarget.filter((r) => r.label.matches_existing_page === 'new' || r.targetInCandidates);
  const targetCorrect = (r: NoteResult) => r.target!.choice === r.label.matches_existing_page;
  lines.push('', '### update_target (Choice) — which existing page to update', '');
  lines.push(`- labeled target retrievable in top-${CANDIDATES}: ${pct(results.filter((r) => r.targetInCandidates === true).length, results.filter((r) => r.targetInCandidates !== null).length)} (a miss here is a retrieval gap, not a Jev error)`);
  lines.push(`- accuracy where the target was reachable: ${pct(reachable.filter(targetCorrect).length, reachable.length)}`);
  lines.push(`- accuracy where reachable and confidence ≥ 0.5: ${pct(reachable.filter((r) => r.target!.confidence >= 0.5 && targetCorrect(r)).length, reachable.filter((r) => r.target!.confidence >= 0.5).length)}`);

  const typed = results.filter((r) => r.label.type_if_yes && r.pageType);
  lines.push('', '### page_type (Choice)', '');
  lines.push(`- accuracy vs label: ${pct(typed.filter((r) => r.pageType!.choice === r.label.type_if_yes).length, typed.length)} (labels themselves disagreed between annotators on query vs concept — read this as consistency, not truth)`);

  const tokens = results.reduce((sum, r) => sum + r.inputTokens, 0);
  lines.push('', `### Cost: ${tokens.toLocaleString()} input tokens ≈ $${((tokens / 1e6) * PRICE_PER_MTOK).toFixed(4)} (${results.filter((r) => r.cached).length} cached)`);

  lines.push('', '### Per note (sorted by worth_compiling)', '');
  lines.push('| worth | label | type (conf) | target (conf) | path |', '|---|---|---|---|---|');
  for (const r of [...results].sort((a, b) => b.worth - a.worth)) {
    const target = r.target ? `${r.target.choice === 'new' ? 'new' : basename(r.target.choice)} (${r.target.confidence.toFixed(2)})` : '—';
    lines.push(`| ${r.worth.toFixed(2)} | ${r.label.worth_compiling} | ${r.pageType!.choice} (${r.pageType!.confidence.toFixed(2)}) | ${target} | ${r.path} |`);
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

  const results: NoteResult[] = [];
  for (const label of labels) {
    try {
      results.push(await evaluateNote(label, kbRoot, snapshot, model, apiKey, cache));
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
