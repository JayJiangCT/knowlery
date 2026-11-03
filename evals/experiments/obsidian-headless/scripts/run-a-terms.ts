/**
 * POST-HOC sensitivity variant "A-terms" (added after seeing A's abstention count, before
 * reading per-question label outcomes): the shipped query.mjs called with the shared plan
 * terms (subject terms only), mirroring the documented usage "pass 2–6 subject terms, never
 * request phrasing". planTerms is a crude, deterministic proxy for an agent choosing nouns
 * (it keeps verbs like "decide" and truncates at 6), so this is still a lower bound.
 *
 * Usage: env PATH=<no /usr/local/bin> npx tsx scripts/run-a-terms.ts --vault <root> --questions <json> --out <file.jsonl>
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { K, planTerms, type GroupRun } from './plan';

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const VAULT = resolve(args.get('vault')!);
const OUT = resolve(args.get('out')!);
const QUERY_BIN = join(VAULT, '.knowlery/bin/query.mjs');
if ((process.env.PATH ?? '').split(':').includes('/usr/local/bin')) throw new Error('PATH contains /usr/local/bin');

const CAND = /^(\d+)\. (.*?)(?: \[([^\]]*)\])? \(score ([-\d.eE+]+)\)(?: — (.*))?$/;
const qs: { id: string; question: string }[] = JSON.parse(readFileSync(resolve(args.get('questions')!), 'utf8'));
const runs: GroupRun[] = [];
for (const q of qs) {
  const terms = planTerms(q.question);
  const input = terms.join(' ');
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [QUERY_BIN, input], { cwd: VAULT, env: { PATH: process.env.PATH ?? '' }, encoding: 'utf8', maxBuffer: 64 << 20 });
  const ms = performance.now() - t0;
  const out = r.stdout ?? '';
  const all = out.split('\n').map((l) => CAND.exec(l)).filter((m): m is RegExpExecArray => !!m).map((m) => m[2]);
  const error = r.error ? String(r.error) : r.status !== 0 ? `exit ${r.status}` : undefined;
  runs.push({
    group: 'A', qid: q.id, terms, results: error ? [] : all.slice(0, K),
    abstained: !!error || out.includes('No confident matches') || all.length === 0, ranked: true,
    totalHits: all.length, cliCalls: 1, queries: 1, latencyMs: Math.round(ms * 10) / 10, cold: true,
    commands: [`node .knowlery/bin/query.mjs ${JSON.stringify(input)}`], ...(error ? { error } : {}),
    extra: { variant: 'A-terms (post-hoc)' },
  });
}
writeFileSync(OUT, runs.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`abstained ${runs.filter((r) => r.abstained).length}/${runs.length}`);
