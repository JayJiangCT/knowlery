/**
 * Runner for groups B (native single Obsidian search) and C (Obsidian multi-path plan).
 * Read-only against the snapshot vault. Run from the knowlery repo root:
 *   npx tsx evals/experiments/obsidian-headless/scripts/run-obsidian.ts --vault <name> --questions <json> --out <dir>
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { planTerms, rankSupplement, K, MAX_TERMS, LINK_SEEDS, type BackendHits, type GroupRun } from './plan';

const OBSIDIAN = '/usr/local/bin/obsidian';
// Usage: npx tsx run-obsidian.ts --vault <obsidian vault name> --questions <questions.json> --out <dir>
const cli = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) cli.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const VAULT = cli.get('vault') ?? 'knowlery-bench-snapshot-2026-11-02';
const QUESTIONS = cli.get('questions') ?? '';
const OUT = cli.get('out') ?? '';
if (!QUESTIONS || !OUT) { console.error('missing --questions/--out'); process.exit(2); }
const EXPECTED_MD = 3934;

const errors: string[] = [];
let totalCalls = 0;
let failedCalls = 0;
let retries = 0;
const retryLog: string[] = [];

interface CallResult { ok: boolean; out: string; error?: string; cmd: string }

/** Every call is forced through the snapshot vault; args are an argv array (no shell). */
function obsidian(args: string[], label?: string): CallResult {
  const argv = [`vault=${VAULT}`, ...args];
  const cmd = ['obsidian', ...(label ? [`vault=${VAULT}`, label] : argv)].join(' ');
  totalCalls += 1;
  // The CLI occasionally never receives Obsidian's reply and ignores SIGTERM: hard-kill after 30 s, retry once.
  let r = spawnSync(OBSIDIAN, argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 30_000, killSignal: 'SIGKILL' });
  if (r.error && /ETIMEDOUT/.test(String(r.error))) {
    retries += 1; retryLog.push(cmd);
    r = spawnSync(OBSIDIAN, argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 30_000, killSignal: 'SIGKILL' });
  }
  const out = (r.stdout ?? '').trim();
  let error: string | undefined;
  if (r.error) error = `spawn: ${r.error.message}`;
  else if (r.status !== 0) error = `exit ${r.status}: ${(r.stderr ?? '').trim() || out}`.slice(0, 500);
  else if (/^Error:/m.test(out)) error = out.slice(0, 500);
  if (error) { failedCalls += 1; errors.push(`${cmd}: ${error}`); }
  return { ok: !error, out, error, cmd };
}

/** Quoting rule: bare when the term is only letters/digits (incl. CJK); otherwise "..." with \" escaped. */
function q(term: string): string {
  return /^[\p{L}\p{N}]+$/u.test(term) ? term : `"${term.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function search(query: string, limit?: number): { paths: string[]; call: CallResult } {
  const args = ['search', `query=${query}`];
  if (limit !== undefined) args.push(`limit=${limit}`);
  args.push('format=json');
  const call = obsidian(args);
  if (!call.ok) return { paths: [], call };
  if (call.out === 'No matches found.' || call.out === '') return { paths: [], call };
  try {
    const parsed = JSON.parse(call.out);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    return { paths: parsed.map(String), call };
  } catch (e) {
    failedCalls += 1;
    const msg = `parse: ${(e as Error).message}: ${call.out.slice(0, 200)}`;
    errors.push(`${call.cmd}: ${msg}`);
    return { paths: [], call: { ...call, ok: false, error: msg } };
  }
}

function evalJson<T>(name: string, code: string): { value?: T; call: CallResult } {
  const call = obsidian(['eval', `code=${code}`], `eval:${name}`);
  if (!call.ok) return { call };
  const body = call.out.replace(/^=>\s?/, '');
  try {
    return { value: JSON.parse(body) as T, call };
  } catch (e) {
    failedCalls += 1;
    const msg = `parse: ${(e as Error).message}: ${body.slice(0, 200)}`;
    errors.push(`${call.cmd}: ${msg}`);
    return { call: { ...call, ok: false, error: msg } };
  }
}

/** Read-only: metadataCache + vault file list. Substring match, case-insensitive. */
function metaHitsCode(terms: string[]): string {
  return `(() => {
  const terms = ${JSON.stringify(terms.map((t) => t.toLowerCase()))};
  const files = app.vault.getMarkdownFiles();
  const hits = {};
  let malformed = 0;
  const asList = (v) => v == null ? [] : Array.isArray(v) ? v.flatMap(asList) : typeof v === 'string' ? [v] : [String(v)];
  for (const f of files) {
    const cache = app.metadataCache.getFileCache(f) || {};
    const fm = cache.frontmatter || {};
    if (cache.frontmatterPosition && !cache.frontmatter) malformed++;
    const fields = [f.basename];
    fields.push(...asList(fm.title));
    fields.push(...asList(fm.aliases), ...asList(fm.alias));
    const fmTags = [...asList(fm.tags), ...asList(fm.tag)].flatMap((t) => t.split(/[,\\s]+/));
    const inline = (cache.tags || []).map((t) => t.tag);
    fields.push(...fmTags.concat(inline).filter(Boolean).map((t) => t.replace(/^#/, '')));
    const hay = fields.map((s) => String(s).toLowerCase());
    let n = 0;
    for (const t of terms) if (hay.some((h) => h.includes(t))) n++;
    if (n > 0) hits[f.path] = n;
  }
  return JSON.stringify({ corpusSize: files.length, hits, malformed });
})()`;
}

/** Read-only: resolvedLinks outlinks + backlinks of the seeds, markdown files only. */
function neighboursCode(seeds: string[]): string {
  return `(() => {
  const seeds = ${JSON.stringify(seeds)};
  const rl = app.metadataCache.resolvedLinks;
  const md = (p) => p.toLowerCase().endsWith('.md');
  const out = {};
  for (const s of seeds) {
    const set = new Set(Object.keys(rl[s] || {}).filter(md));
    for (const [src, dests] of Object.entries(rl)) if (md(src) && dests && dests[s]) set.add(src);
    set.delete(s);
    out[s] = [...set].sort();
  }
  return JSON.stringify(out);
})()`;
}

function runB(qid: string, question: string, cold: boolean): GroupRun {
  const t0 = performance.now();
  const terms = planTerms(question);
  if (terms.length === 0) {
    return { group: 'B', qid, terms, results: [], abstained: true, ranked: false, cliCalls: 0, queries: 0, latencyMs: performance.now() - t0, cold, commands: [] };
  }
  const { paths, call } = search(terms.map(q).join(' '), K);
  const latencyMs = performance.now() - t0;
  return {
    group: 'B', qid, terms, results: paths, abstained: paths.length === 0, ranked: false,
    cliCalls: 1, queries: 1, latencyMs, cold, commands: [call.cmd], ...(call.error ? { error: call.error } : {}),
  };
}

function runC(qid: string, question: string, cold: boolean): GroupRun {
  const t0 = performance.now();
  const terms = planTerms(question);
  const commands: string[] = [];
  const errs: string[] = [];
  let calls = 0;
  let queries = 0;
  if (terms.length === 0) {
    return { group: 'C', qid, terms, results: [], abstained: true, ranked: true, cliCalls: 0, queries: 0, latencyMs: performance.now() - t0, cold, commands };
  }
  const track = (c: CallResult) => { calls++; commands.push(c.cmd); if (c.error) errs.push(c.error); };

  const all = search(terms.map(q).join(' '));
  track(all.call); queries++;
  const perTerm: Record<string, string[]> = {};
  for (const t of terms) {
    const r = search(q(t));
    track(r.call); queries++;
    perTerm[t] = r.paths;
  }
  const meta = evalJson<{ corpusSize: number; hits: Record<string, number>; malformed: number }>('metaHits', metaHitsCode(terms));
  track(meta.call);
  const hits: BackendHits = {
    terms, corpusSize: meta.value?.corpusSize ?? 0, perTerm, allTerms: all.paths,
    metaHits: meta.value?.hits ?? {}, neighbours: {},
  };
  const prelim = rankSupplement(hits);
  let ranked = prelim;
  if (prelim.length > 0 && prelim.length < K) {
    // Neighbours only matter when the scored list leaves room (rankSupplement appends only below K).
    const seeds = prelim.slice(0, LINK_SEEDS).map((r) => r.path);
    const nb = evalJson<Record<string, string[]>>('neighbours', neighboursCode(seeds));
    track(nb.call);
    hits.neighbours = nb.value ?? {};
    ranked = rankSupplement(hits);
  }
  const latencyMs = performance.now() - t0;
  if (calls > 1 + MAX_TERMS + 2) errs.push(`budget exceeded: ${calls}`);
  const union = new Set(Object.values(perTerm).flat());
  const termSets = terms.map((t) => new Set(perTerm[t]));
  return {
    group: 'C', qid, terms, results: ranked.map((r) => r.path), abstained: ranked.length === 0, ranked: true,
    totalHits: union.size, cliCalls: calls, queries, latencyMs, cold, commands,
    ...(errs.length ? { error: errs.join(' | ') } : {}),
    extra: {
      coveredTermsTop: ranked.map((r) => termSets.filter((s) => s.has(r.path)).length),
      via: ranked.map((r) => r.via),
      scores: ranked.map((r) => Number(r.score.toFixed(6))),
      allTermsHits: all.paths.length,
      metaHitFiles: Object.keys(hits.metaHits).length,
      malformedFrontmatter: meta.value?.malformed,
      nonMdInPerTerm: [...union].filter((p) => !p.endsWith('.md')).length,
    },
  };
}

function preflight() {
  const version = obsidian(['version']).out;
  const files = obsidian(['files']);
  const lines = files.out.split('\n').map((s) => s.trim()).filter(Boolean);
  const mdCount = lines.filter((l) => l.endsWith('.md')).length;
  // The recorded run used a domain-specific two-word probe (redacted for privacy); any common term works.
  const probeQuery = cli.get('probe') ?? 'note';
  const p1 = obsidian(['search', `query=${probeQuery}`, 'format=json']).out;
  const p2 = obsidian(['search', `query=${probeQuery}`, 'format=json']).out;
  const evalName = obsidian(['eval', 'code=app.vault.getName()']).out.replace(/^=>\s?/, '');
  return {
    obsidianVersion: version, filesTotal: lines.length, mdCount, mdCountOk: mdCount === EXPECTED_MD,
    probe: { query: probeQuery, identical: p1 === p2, hits: (() => { try { return JSON.parse(p1).length; } catch { return p1.slice(0, 100); } })() },
    evalVaultName: evalName, evalVaultOk: evalName === VAULT,
  };
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const questions: { id: string; question: string }[] = JSON.parse(readFileSync(QUESTIONS, 'utf8'));
  const pre = preflight();
  console.log('preflight', JSON.stringify(pre));
  if (!pre.mdCountOk || !pre.evalVaultOk) throw new Error('preflight failed');

  const passes: Record<string, GroupRun[]> = {};
  for (const pass of [1, 2]) {
    for (const group of ['B', 'C'] as const) {
      const runs: GroupRun[] = [];
      for (const qq of questions) runs.push(group === 'B' ? runB(qq.id, qq.question, pass === 1) : runC(qq.id, qq.question, pass === 1));
      passes[`${group}.pass${pass}`] = runs;
      writeFileSync(`${OUT}/${group}.pass${pass}.jsonl`, runs.map((r) => JSON.stringify(r)).join('\n') + '\n');
      console.log(`done ${group} pass${pass}`);
    }
  }

  const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]; };
  const stats: Record<string, unknown> = {};
  for (const [k, runs] of Object.entries(passes)) {
    const lat = runs.map((r) => r.latencyMs);
    stats[k] = {
      medianMs: Number(pct(lat, 0.5).toFixed(1)), p95Ms: Number(pct(lat, 0.95).toFixed(1)),
      calls: runs.reduce((a, r) => a + r.cliCalls, 0), errors: runs.filter((r) => r.error).length,
      abstained: runs.filter((r) => r.abstained).length,
    };
  }
  const diffs: string[] = [];
  for (const g of ['B', 'C']) {
    const a = passes[`${g}.pass1`]; const b = passes[`${g}.pass2`];
    a.forEach((r, i) => {
      if (JSON.stringify(r.results) !== JSON.stringify(b[i].results) || r.totalHits !== b[i].totalHits
        || JSON.stringify(r.extra) !== JSON.stringify(b[i].extra)) diffs.push(`${g}:${r.qid}`);
    });
  }
  const env = {
    date: new Date().toISOString(), node: process.version, vault: VAULT, preflight: pre,
    plan: { K, MAX_TERMS, LINK_SEEDS },
    quotingRule: 'Terms are passed bare when they contain only Unicode letters/digits (all 56 questions: latin [a-z0-9]+ or CJK runs), otherwise wrapped in double quotes with \\" escaped. Multi-term queries are space-joined (Obsidian implicit AND). Verified: bare digits (e.g. "20") act as substring match; hyphen-prefixed word would be negation, but no plan term contains "-".',
    neighboursNote: 'neighbours eval is only called when the preliminary rankSupplement list is non-empty and shorter than K (rankSupplement only appends links below K); otherwise it cannot change results.',
    totals: { cliCalls: totalCalls, failedCalls, timeoutRetries: retries, retryLog },
    stats, determinism: { identical: diffs.length === 0, diffs },
    errors,
  };
  writeFileSync(`${OUT}/env.json`, JSON.stringify(env, null, 2) + '\n');
  console.log(JSON.stringify({ stats, diffs, totalCalls, failedCalls, errors: errors.slice(0, 20) }, null, 2));
}

main();
