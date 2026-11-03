/**
 * Headless runner for retrieval groups A and E of the Obsidian-vs-headless benchmark.
 *
 * Group A: the shipped `.knowlery/bin/query.mjs`, spawned once per question (argv array, no shell).
 * Group E: A fused (RRF) with the frozen shared supplement ranker fed by a plain-file backend.
 * The frozen plan (plan.ts) is imported unchanged; this file only collects raw backend hits.
 *
 * Usage (from the knowlery repo root, PATH without /usr/local/bin):
 *   npx tsx evals/experiments/obsidian-headless/scripts/run-headless.ts \
 *     --vault <root> --questions <questions.json|questions.yaml> --out <dir> \
 *     --query-bin <path to query.mjs> [--layout snapshot|fixture]
 *
 * layout=snapshot writes A/E/Esupp .pass1/.pass2 jsonl + env.json.
 * layout=fixture writes A.jsonl, E.jsonl, Esupp.jsonl (pass 1) + env.json; pass 2 is still run
 * in-process for the determinism check.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import yaml from 'js-yaml';
import { parse as parseYamlDoc } from 'yaml';
import { K, LINK_SEEDS, MAX_TERMS, planTerms, rankSupplement, rrf, type BackendHits, type GroupRun } from './plan';

// ---------- args ----------
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const VAULT = resolve(args.get('vault') ?? '');
const QUESTIONS = resolve(args.get('questions') ?? '');
const OUT = resolve(args.get('out') ?? '');
const QUERY_BIN = resolve(args.get('query-bin') ?? join(VAULT, '.knowlery/bin/query.mjs'));
const LAYOUT = (args.get('layout') ?? 'snapshot') as 'snapshot' | 'fixture';
const CHILD_PATH = process.env.PATH ?? '';
if (!args.get('vault') || !args.get('questions') || !args.get('out')) {
  console.error('missing --vault/--questions/--out');
  process.exit(2);
}
if (CHILD_PATH.split(':').includes('/usr/local/bin')) {
  console.error('refusing to run: PATH contains /usr/local/bin');
  process.exit(2);
}

// ---------- questions ----------
interface Q { id: string; question: string }
function loadQuestions(file: string): Q[] {
  const text = readFileSync(file, 'utf8');
  const raw = file.endsWith('.json') ? JSON.parse(text) : parseYamlDoc(text);
  return (raw as Array<Record<string, unknown>>).map((r) => ({ id: String(r.id), question: String(r.question) }));
}

// ---------- corpus manifest (read-only evidence) ----------
function manifest(root: string): string {
  const lines: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) {
        const s = statSync(p);
        lines.push(`${relative(root, p)}\t${s.size}\t${s.mtimeMs}`);
      }
    }
  };
  walk(root);
  return createHash('sha256').update(lines.join('\n')).digest('hex') + `:${lines.length}`;
}

// ---------- index ----------
interface Doc {
  path: string;
  lower: string;
  meta: string[]; // lowercased basename, title, aliases, tags
  outlinks: string[];
}
interface Index {
  docs: Doc[];
  byPath: Set<string>;
  neighbours: Record<string, string[]>;
  fallbackParse: number;
  unresolvedLinks: number;
  resolvedLinks: number;
  nonMdLinks: number;
}

function walkMd(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '__pycache__') continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p); // symlinks are not followed (Dirent.isDirectory is false for links)
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push(relative(root, p).split('\\').join('/'));
    }
  };
  walk(root);
  return out.sort();
}

function asList(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap(asList);
  return [String(v)];
}

function splitFrontmatter(text: string): { fm: string | null; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(text);
  if (!m) return { fm: null, body: text };
  return { fm: m[1], body: text.slice(m[0].length) };
}

function regexFrontmatter(fm: string): { title: string[]; aliases: string[]; tags: string[] } {
  const res = { title: [] as string[], aliases: [] as string[], tags: [] as string[] };
  const lines = fm.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^(title|aliases|alias|tags|tag):\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const key = m[1].startsWith('title') ? 'title' : m[1].startsWith('alias') ? 'aliases' : 'tags';
    const vals: string[] = [];
    const inline = m[2].trim();
    if (inline.startsWith('[')) vals.push(...inline.replace(/^\[|\]$/g, '').split(','));
    else if (inline) vals.push(inline);
    else {
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) vals.push(lines[++i].replace(/^\s*-\s+/, ''));
    }
    res[key].push(...vals.map((v) => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean));
  }
  return res;
}

function buildIndex(root: string): Index {
  const paths = walkMd(root);
  const byPath = new Set(paths);
  const lowerToPath = new Map(paths.map((p) => [p.toLowerCase(), p]));
  let fallbackParse = 0;
  const rawLinks: string[][] = [];
  const docs: Doc[] = paths.map((path) => {
    const text = readFileSync(join(root, path), 'utf8');
    const { fm, body } = splitFrontmatter(text);
    let title: string[] = [];
    let aliases: string[] = [];
    let tags: string[] = [];
    if (fm != null) {
      try {
        const data = (yaml.load(fm) ?? {}) as Record<string, unknown>;
        if (typeof data !== 'object' || Array.isArray(data)) throw new Error('frontmatter not a mapping');
        title = asList(data.title);
        aliases = [...asList(data.aliases), ...asList(data.alias)];
        tags = [...asList(data.tags), ...asList(data.tag)];
      } catch {
        fallbackParse += 1;
        ({ title, aliases, tags } = regexFrontmatter(fm));
      }
    }
    tags = tags.flatMap((t) => t.split(/[,\s]+/)).map((t) => t.replace(/^#/, '')).filter(Boolean);
    for (const m of body.matchAll(/(^|\s)#([^\s#.,;:!?()[\]{}"'`]+)/g)) if (/[^0-9]/.test(m[2])) tags.push(m[2]);
    const links = [...text.matchAll(/\[\[([^\]\n]+?)\]\]/g)].map((m) => m[1]);
    rawLinks.push(links);
    const meta = [basename(path, '.md'), ...title, ...aliases, ...tags].map((s) => s.toLowerCase());
    return { path, lower: text.toLowerCase(), meta, outlinks: [] };
  });

  // Link resolution: exact path, path+.md, then unique suffix match on "/"+link+".md"
  // (basename match when the link has no slash; Obsidian shortest-path behaviour when it does).
  // Comparisons are case-insensitive, as in Obsidian.
  const suffixCache = new Map<string, string | null>();
  let unresolvedLinks = 0;
  let resolvedLinks = 0;
  let nonMdLinks = 0;
  const resolveLink = (target: string): string | null => {
    const t = target.toLowerCase();
    if (lowerToPath.has(t)) return lowerToPath.get(t)!;
    if (lowerToPath.has(`${t}.md`)) return lowerToPath.get(`${t}.md`)!;
    if (suffixCache.has(t)) return suffixCache.get(t)!;
    const suffix = `/${t}.md`;
    const hits = paths.filter((p) => p.toLowerCase().endsWith(suffix));
    const r = hits.length === 1 ? hits[0] : null;
    suffixCache.set(t, r);
    return r;
  };
  const back = new Map<string, Set<string>>();
  docs.forEach((d, i) => {
    const outs = new Set<string>();
    for (const raw of rawLinks[i]) {
      const target = raw.split('|')[0].split('#')[0].split('^')[0].trim().replace(/\\$/, '');
      if (!target) continue;
      if (/\.[a-z0-9]{1,5}$/i.test(target) && !/\.md$/i.test(target)) { nonMdLinks += 1; continue; }
      const r = resolveLink(target);
      if (!r) { unresolvedLinks += 1; continue; }
      resolvedLinks += 1;
      if (r !== d.path) outs.add(r);
    }
    d.outlinks = [...outs];
    for (const o of outs) {
      if (!back.has(o)) back.set(o, new Set());
      back.get(o)!.add(d.path);
    }
  });
  const neighbours: Record<string, string[]> = {};
  for (const d of docs) {
    const s = new Set([...d.outlinks, ...(back.get(d.path) ?? [])]);
    s.delete(d.path);
    if (s.size) neighbours[d.path] = [...s].sort();
  }
  return { docs, byPath, neighbours, fallbackParse, unresolvedLinks, resolvedLinks, nonMdLinks };
}

function backendHits(idx: Index, terms: string[]): BackendHits {
  const perTerm: Record<string, string[]> = {};
  for (const t of terms) perTerm[t] = idx.docs.filter((d) => d.lower.includes(t)).map((d) => d.path);
  const allTerms = terms.length ? idx.docs.filter((d) => terms.every((t) => d.lower.includes(t))).map((d) => d.path) : [];
  const metaHits: Record<string, number> = {};
  for (const d of idx.docs) {
    const n = terms.filter((t) => d.meta.some((m) => m.includes(t))).length;
    if (n > 0) metaHits[d.path] = n;
  }
  return { terms, corpusSize: idx.docs.length, perTerm, allTerms, metaHits, neighbours: idx.neighbours };
}

// ---------- group A ----------
interface AOut { results: string[]; all: string[]; evidence: string[][]; abstained: boolean; ms: number; error?: string; pathMisses: number; evidenceMisses: number; command: string }
const CAND = /^(\d+)\. (.*?)(?: \[([^\]]*)\])? \(score ([-\d.eE+]+)\)(?: \u2014 (.*))?$/;

function splitEvidence(s: string, known: Set<string>): { paths: string[]; misses: number } {
  const pieces = s.split(', ');
  const paths: string[] = [];
  let misses = 0;
  let i = 0;
  while (i < pieces.length) {
    let found = -1;
    for (let j = i; j < pieces.length; j++) {
      if (known.has(pieces.slice(i, j + 1).join(', '))) { found = j; break; }
    }
    if (found >= 0) { paths.push(pieces.slice(i, found + 1).join(', ')); i = found + 1; }
    else { paths.push(pieces[i]); misses += 1; i += 1; }
  }
  return { paths, misses };
}

function runA(question: string, idx: Index): AOut {
  const command = `cd ${JSON.stringify(VAULT)} && node ${JSON.stringify(QUERY_BIN)} ${JSON.stringify(question)}`;
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [QUERY_BIN, question], {
    cwd: VAULT, env: { PATH: CHILD_PATH }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const ms = performance.now() - t0;
  const out = r.stdout ?? '';
  let error: string | undefined;
  if (r.error) error = String(r.error);
  else if (r.status !== 0) error = `exit ${r.status}: ${(r.stderr ?? '').slice(0, 500)}`;
  else if (r.stderr && r.stderr.trim()) error = `stderr: ${r.stderr.slice(0, 500)}`;
  const all: string[] = [];
  const evidence: string[][] = [];
  let pathMisses = 0;
  let evidenceMisses = 0;
  for (const line of out.split('\n')) {
    const m = CAND.exec(line);
    if (m) {
      all.push(m[2]);
      evidence.push([]);
      if (!idx.byPath.has(m[2])) pathMisses += 1;
      continue;
    }
    const ev = /^ {3}evidence via source: (.*)$/.exec(line);
    if (ev && evidence.length) {
      const s = splitEvidence(ev[1], idx.byPath);
      evidence[evidence.length - 1] = s.paths;
      evidenceMisses += s.misses;
    }
  }
  const abstained = out.includes('No confident matches') || all.length === 0;
  return { results: error ? [] : all.slice(0, K), all, evidence, abstained: error ? true : abstained, ms, error, pathMisses, evidenceMisses, command };
}

// ---------- stats ----------
function pct(xs: number[], p: number): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}
const r1 = (x: number) => Math.round(x * 10) / 10;

// ---------- main ----------
function runPass(qs: Q[], idx: Index, cold: boolean) {
  const A: GroupRun[] = [];
  const E: GroupRun[] = [];
  const S: GroupRun[] = [];
  const stats = { pathMisses: 0, evidenceMisses: 0 };
  for (const q of qs) {
    const terms = planTerms(q.question);
    const a = runA(q.question, idx);
    stats.pathMisses += a.pathMisses;
    stats.evidenceMisses += a.evidenceMisses;
    A.push({
      group: 'A', qid: q.id, terms, results: a.results, abstained: a.abstained, ranked: true,
      totalHits: a.all.length, cliCalls: 1, queries: 1, latencyMs: r1(a.ms), cold, commands: [a.command],
      ...(a.error ? { error: a.error } : {}), extra: { evidence: a.evidence.slice(0, K) },
    });
    const t0 = performance.now();
    const hits = backendHits(idx, terms);
    const supp = rankSupplement(hits);
    const suppPaths = supp.map((r) => r.path);
    const fused = rrf([a.results, suppPaths]);
    const suppMs = performance.now() - t0;
    const q2 = 1 + 1 + terms.length + 2;
    const internal = [
      `all-terms content scan: ${JSON.stringify(terms)}`,
      ...terms.map((t) => `per-term content scan: ${JSON.stringify(t)}`),
      'metadata scan (basename/title/aliases/tags)',
      'link neighbours (outlinks+backlinks)',
    ];
    const scored = new Set<string>();
    for (const t of terms) for (const f of hits.perTerm[t]) scored.add(f);
    for (const f of Object.keys(hits.metaHits)) scored.add(f);
    E.push({
      group: 'E', qid: q.id, terms, results: fused, abstained: a.abstained && suppPaths.length === 0, ranked: true,
      cliCalls: 1, queries: q2, latencyMs: r1(a.ms + suppMs), cold, commands: [a.command, ...internal],
      ...(a.error ? { error: a.error } : {}),
      extra: { aMs: r1(a.ms), suppMs: r1(suppMs), suppCount: suppPaths.length, linkFilled: supp.filter((r) => r.via === 'link').length },
    });
    S.push({
      group: 'E', qid: q.id, terms, results: suppPaths, abstained: suppPaths.length === 0, ranked: true,
      totalHits: scored.size, cliCalls: 0, queries: q2 - 1, latencyMs: r1(suppMs), cold, commands: internal,
      extra: { variant: 'supp-only', ranked: supp.map((r) => ({ path: r.path, score: r1(r.score * 1000) / 1000, via: r.via })) },
    });
  }
  return { A, E, S, stats };
}

function latencySummary(runs: GroupRun[]) {
  const xs = runs.map((r) => r.latencyMs);
  return { n: xs.length, medianMs: r1(pct(xs, 50)), p95Ms: r1(pct(xs, 95)), meanMs: r1(xs.reduce((s, x) => s + x, 0) / xs.length) };
}
const jsonl = (rs: GroupRun[]) => rs.map((r) => JSON.stringify(r)).join('\n') + '\n';
const same = (x: GroupRun[], y: GroupRun[]) => {
  const diffs: string[] = [];
  x.forEach((r, i) => {
    const o = y[i];
    if (!o || o.qid !== r.qid || JSON.stringify(r.results) !== JSON.stringify(o.results) || r.abstained !== o.abstained) diffs.push(r.qid);
  });
  return diffs;
};

const processStart = performance.now();
const manifestBefore = manifest(VAULT);
const qs = loadQuestions(QUESTIONS);
const tIdx = performance.now();
const idx = buildIndex(VAULT);
const indexBuildMs = performance.now() - tIdx;
const p1 = runPass(qs, idx, true);
const p2 = runPass(qs, idx, false);
const manifestAfter = manifest(VAULT);

mkdirSync(OUT, { recursive: true });
if (LAYOUT === 'snapshot') {
  writeFileSync(join(OUT, 'A.pass1.jsonl'), jsonl(p1.A));
  writeFileSync(join(OUT, 'A.pass2.jsonl'), jsonl(p2.A));
  writeFileSync(join(OUT, 'E.pass1.jsonl'), jsonl(p1.E));
  writeFileSync(join(OUT, 'E.pass2.jsonl'), jsonl(p2.E));
  writeFileSync(join(OUT, 'Esupp.pass1.jsonl'), jsonl(p1.S));
} else {
  writeFileSync(join(OUT, 'A.jsonl'), jsonl(p1.A));
  writeFileSync(join(OUT, 'E.jsonl'), jsonl(p1.E));
  writeFileSync(join(OUT, 'Esupp.jsonl'), jsonl(p1.S));
}

const errors = [...p1.A, ...p2.A].filter((r) => r.error).map((r) => ({ qid: r.qid, cold: r.cold, error: r.error }));
const det = { A: same(p1.A, p2.A), E: same(p1.E, p2.E), Esupp: same(p1.S, p2.S) };
const env = {
  layout: LAYOUT,
  startedAt: new Date().toISOString(),
  node: process.version,
  childPATH: CHILD_PATH,
  runnerCommand: `env PATH="${CHILD_PATH}" npx tsx ${process.argv.slice(1).map((s) => JSON.stringify(s)).join(' ')}`,
  cwd: process.cwd(),
  vault: LAYOUT === 'fixture' ? relative(process.cwd(), VAULT) : VAULT,
  queryBin: LAYOUT === 'fixture' ? '<scratch copy of snapshot query.mjs>' : QUERY_BIN,
  queryBinSha256: createHash('sha256').update(readFileSync(QUERY_BIN)).digest('hex'),
  questions: qs.length,
  plan: { K, MAX_TERMS, LINK_SEEDS },
  corpusCount: idx.docs.length,
  fallbackParseCount: idx.fallbackParse,
  links: { resolved: idx.resolvedLinks, unresolved: idx.unresolvedLinks, nonMdSkipped: idx.nonMdLinks, filesWithNeighbours: Object.keys(idx.neighbours).length },
  indexBuildMs: r1(indexBuildMs),
  passes: {
    pass1: { cold: true, note: 'fresh process; index built once before this pass (indexBuildMs, not in per-question latency); query.mjs is a fresh child process per question in both passes', A: latencySummary(p1.A), E: latencySummary(p1.E), Esupp: latencySummary(p1.S) },
    pass2: { cold: false, note: 'same process, index reused', A: latencySummary(p2.A), E: latencySummary(p2.E), Esupp: latencySummary(p2.S) },
  },
  totals: {
    A: { abstained: p1.A.filter((r) => r.abstained).length, answered: p1.A.filter((r) => !r.abstained).length },
    E: { abstained: p1.E.filter((r) => r.abstained).length, answered: p1.E.filter((r) => !r.abstained).length },
    Esupp: { abstained: p1.S.filter((r) => r.abstained).length, answered: p1.S.filter((r) => !r.abstained).length },
    zeroTermQuestions: p1.A.filter((r) => r.terms.length === 0).map((r) => r.qid),
  },
  parse: { candidatePathsNotInIndex: p1.stats.pathMisses + p2.stats.pathMisses, evidencePiecesNotInIndex: p1.stats.evidenceMisses + p2.stats.evidenceMisses },
  determinism: { identical: !det.A.length && !det.E.length && !det.Esupp.length, differingQids: det },
  corpusUnchanged: manifestBefore === manifestAfter,
  corpusManifest: { before: manifestBefore, after: manifestAfter },
  errors,
  totalWallMs: r1(performance.now() - processStart),
};
writeFileSync(join(OUT, 'env.json'), JSON.stringify(env, null, 2) + '\n');
console.log(JSON.stringify({ ...env, corpusManifest: undefined }, null, 2));
