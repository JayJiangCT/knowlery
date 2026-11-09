#!/usr/bin/env node
// THROWAWAY PROTOTYPE for experiment WS-001. Not the Knowlery 2.0 CLI. Do not reuse as product code.
// Commands: validate [--protected] [--json] | baseline (--init|--rebuild) --reason "<why>" | append-history <slug> "<line>"
// Vault root: --vault <dir>, else $KNOWLERY_VAULT, else ./vault
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const KNOWLEDGE_DIRS = ['concepts', 'entities', 'comparisons', 'records'];
export const MANIFEST_REL = '.knowlery/manifest.json';
export const MANIFEST_VERSION = 1;
const KNOWLEDGE_TYPES = ['concept', 'entity', 'comparison'];

// --- KF v1.0 §8 digest procedure -------------------------------------------------
export function normalize(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
export const sha256 = (text) => 'sha256:' + createHash('sha256').update(normalize(text), 'utf8').digest('hex');

// --- Minimal page parsing --------------------------------------------------------
export function splitFrontmatter(text) {
  const t = text.replace(/\r\n?/g, '\n');
  if (!t.startsWith('---\n')) return { fm: null, body: t };
  const end = t.indexOf('\n---\n', 4);
  if (end < 0) return { fm: null, body: t };
  return { fm: t.slice(4, end), body: t.slice(end + 5) };
}
export function fmValue(fm, key) {
  const m = fm && fm.match(new RegExp('^' + key + ':\\s*(.*)$', 'm'));
  return m ? m[1].trim() : null;
}
export function protectedIds(fm) {
  const v = fmValue(fm, 'protected');
  if (!v) return [];
  if (v === 'true') return ['*'];
  return [...v.matchAll(/\^[A-Za-z0-9-]+/g)].map((m) => m[0]);
}
export function section(body, name) {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => l.trim() === '## ' + name);
  if (start < 0) return null;
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end).join('\n');
}
// Claim fingerprint per KF §8: list-item text minus (src: …), #disputed and ^id; whitespace collapsed.
export function claimFingerprint(line) {
  const t = line.replace(/^\s*-\s*/, '').replace(/\s*\^[A-Za-z0-9-]+\s*$/, '')
    .replace(/\(src:[^)]*\)/g, '').replace(/#disputed/g, '').replace(/\s+/g, ' ').trim();
  return sha256(t);
}
function claimLine(current, id) {
  return (current || '').split('\n').find((l) => /^\s*-\s/.test(l) && l.trimEnd().endsWith(' ' + id)) ?? null;
}
// Evidence scope: Record = frontmatter end -> first ## Sources/History/Related (KF §7.2/§8).
// Knowledge page: KF §8 defines no page-level scope; this prototype uses the Source rule (body after frontmatter).
export function evidenceScope(text) {
  const { fm, body } = splitFrontmatter(text);
  if (fmValue(fm, 'type') !== 'record') return { scope: 'page-body', text: body };
  const lines = body.split('\n');
  let end = lines.findIndex((l) => /^## (Sources|History|Related)\s*$/.test(l));
  if (end < 0) end = lines.length;
  return { scope: 'record-evidence', text: lines.slice(0, end).join('\n') };
}
export function structureProblems(text) {
  const { fm, body } = splitFrontmatter(text);
  if (fm === null) return ['missing frontmatter'];
  const type = fmValue(fm, 'type');
  const p = [];
  if (type === 'record') { if (section(body, 'Summary') === null) p.push('record without ## Summary'); }
  else if (KNOWLEDGE_TYPES.includes(type)) { if (section(body, 'Current') === null) p.push('knowledge page without ## Current'); }
  else p.push(`unknown type: ${type}`);
  if (/^\s+-/m.test(fm) && /^\s+\w+:/m.test(fm)) p.push('nested frontmatter');
  return p;
}
export function fileEntry(text) {
  const { fm, body } = splitFrontmatter(text);
  const { scope, text: scoped } = evidenceScope(text);
  const prot = {};
  const current = section(body, 'Current');
  for (const id of protectedIds(fm)) {
    if (id === '*') { prot['*'] = sha256(current ?? ''); continue; }
    const line = claimLine(current, id);
    prot[id] = line ? claimFingerprint(line) : null;
  }
  return { scope, digest: sha256(scoped), protected: prot };
}

// --- Vault IO (read-only helpers) ------------------------------------------------
export function listKnowledgeFiles(vault) {
  const out = [];
  for (const d of KNOWLEDGE_DIRS) {
    const dir = join(vault, d);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).sort()) if (f.endsWith('.md')) out.push(`${d}/${f}`);
  }
  return out;
}
export function loadManifest(vault) {
  const p = join(vault, MANIFEST_REL);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

// --- validate: READ-ONLY by construction (no write calls in this function) ----------
export function validate(vault) {
  const manifest = loadManifest(vault);
  const paths = [...new Set([...listKnowledgeFiles(vault), ...Object.keys(manifest?.files ?? {})])].sort();
  const results = paths.map((path) => classify(vault, path, manifest));
  const baseline = manifest
    ? { manifest_version: manifest.manifest_version, created_at: manifest.created_at, rebuilt_at: manifest.rebuilt_at ?? null,
        rebuild_reason: manifest.rebuild_reason ?? null, trusted_by_rebuild: Boolean(manifest.rebuilt_at) }
    : null;
  return { baseline, results };
}
function classify(vault, path, manifest) {
  if (!manifest) return { path, state: 'baseline_unavailable', detail: 'no manifest at ' + MANIFEST_REL };
  const base = manifest.files[path];
  if (!base) return { path, state: 'baseline_unavailable', detail: 'file not in manifest' };
  const abs = join(vault, path);
  if (!existsSync(abs)) {
    const hasProt = Object.keys(base.protected ?? {}).length > 0;
    return { path, state: hasProt ? 'protected_change' : 'external_change', detail: 'file missing' };
  }
  const text = readFileSync(abs, 'utf8');
  const now = fileEntry(text);
  const current = section(splitFrontmatter(text).body, 'Current');
  for (const [id, fp] of Object.entries(base.protected ?? {})) {
    if (id === '*') { if (sha256(current ?? '') !== fp) return { path, state: 'protected_change', detail: 'protected page ## Current changed' }; continue; }
    const line = claimLine(current, id);
    if (!line) return { path, state: 'protected_change', detail: `${id} no longer in ## Current` };
    if (claimFingerprint(line) !== fp) return { path, state: 'protected_change', detail: `${id} text changed` };
  }
  const problems = structureProblems(text);
  if (problems.length) return { path, state: 'invalid_structure', detail: problems.join('; ') };
  if (now.digest !== base.digest) return { path, state: 'external_change', detail: `${now.scope} digest differs from manifest` };
  const detail = manifest.rebuilt_at ? `trusted by rebuild at ${manifest.rebuilt_at} (${manifest.rebuild_reason})` : '';
  return { path, state: 'clean', detail };
}

// --- writes (baseline, append-history) ---------------------------------------------
function atomicWrite(abs, content) {
  const tmp = `${abs}.tmp-${process.pid}`;
  writeFileSync(tmp, content);
  renameSync(tmp, abs);
}
const newWriteId = () => `w-${new Date().toISOString().replace(/[-:.]/g, '')}-${randomBytes(3).toString('hex')}`;

export function baseline(vault, { mode, reason }) {
  if (!['init', 'rebuild'].includes(mode)) throw new Error('baseline requires --init or --rebuild');
  if (!reason) throw new Error('baseline requires --reason "<why>"');
  const existing = loadManifest(vault);
  if (mode === 'init' && existing) throw new Error('manifest exists; use --rebuild --reason to replace it');
  const files = {};
  for (const path of listKnowledgeFiles(vault)) files[path] = { ...fileEntry(readFileSync(join(vault, path), 'utf8')), last_write_id: null };
  const now = new Date().toISOString();
  const manifest = {
    manifest_version: MANIFEST_VERSION,
    created_at: mode === 'init' ? now : existing?.created_at ?? null,
    created_reason: mode === 'init' ? reason : existing?.created_reason ?? null,
    rebuilt_at: mode === 'rebuild' ? now : null,
    rebuild_reason: mode === 'rebuild' ? reason : null,
    rebuild_note: mode === 'rebuild' ? 'Rebuilt from current files: any prior out-of-band change is now trusted; detection against the previous baseline is lost.' : null,
    last_write_id: null,
    files,
  };
  mkdirSync(join(vault, '.knowlery'), { recursive: true });
  atomicWrite(join(vault, MANIFEST_REL), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

export function appendHistory(vault, slug, line, actor = 'process:knowlery-proto') {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('invalid slug');
  if (!line || /\n/.test(line)) throw new Error('history line must be one non-empty line');
  const path = KNOWLEDGE_DIRS.map((d) => `${d}/${slug}.md`).find((p) => existsSync(join(vault, p)));
  if (!path) throw new Error(`no page for slug ${slug}`);
  const manifest = loadManifest(vault);
  if (!manifest) throw new Error('baseline_unavailable: refusing controlled write without a manifest');
  const pre = classify(vault, path, manifest);
  if (pre.state !== 'clean') throw new Error(`precondition failed: ${path} is ${pre.state} (${pre.detail})`);
  const abs = join(vault, path);
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  const h = lines.findIndex((l) => l.trim() === '## History');
  if (h < 0) throw new Error(`${path} has no ## History section`);
  const entry = line.startsWith('- ') ? line : `- ${line}`;
  lines.splice(h + 1, 0, entry); // newest first
  const next = lines.join('\n');
  const after = fileEntry(next);
  if (JSON.stringify(after.protected) !== JSON.stringify(manifest.files[path].protected)) throw new Error('refused: write would alter a protected claim');
  const id = newWriteId();
  const date = new Date().toISOString().slice(0, 10);
  atomicWrite(abs, next);
  const logPath = join(vault, 'log.md');
  const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '# Operation log\n';
  const logLine = `- ${date} · ${actor} · [[${slug}]] · append-history · ${id}`;
  const ll = log.split('\n');
  const head = ll.findIndex((l) => l.trim() === `## ${date}`);
  if (head >= 0) ll.splice(head + 1, 0, logLine);
  else { const first = ll.findIndex((l) => /^## /.test(l)); ll.splice(first < 0 ? ll.length : first, 0, `## ${date}`, logLine, ''); }
  atomicWrite(logPath, ll.join('\n'));
  manifest.files[path] = { ...after, last_write_id: id };
  manifest.last_write_id = id;
  atomicWrite(join(vault, MANIFEST_REL), JSON.stringify(manifest, null, 2) + '\n');
  return { path, write_id: id, log_line: logLine };
}

// --- CLI ---------------------------------------------------------------------------
function main(argv) {
  const args = [...argv];
  const flag = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
  const opt = (n) => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const vault = opt('--vault') ?? process.env.KNOWLERY_VAULT ?? 'vault';
  const cmd = args.shift();
  if (cmd === 'validate') {
    const onlyProt = flag('--protected');
    const asJson = flag('--json');
    const report = validate(vault);
    if (asJson) console.log(JSON.stringify(report, null, 2));
    else {
      const b = report.baseline;
      console.log(b ? `baseline: manifest v${b.manifest_version} created ${b.created_at}${b.trusted_by_rebuild ? ` | REBUILT ${b.rebuilt_at} reason="${b.rebuild_reason}" (trusted by rebuild)` : ''}` : 'baseline: none');
      for (const r of report.results) console.log(`${r.state.padEnd(20)} ${r.path}${r.detail ? '  — ' + r.detail : ''}`);
    }
    const states = report.results.map((r) => r.state);
    if (onlyProt) return states.includes('protected_change') ? 1 : states.includes('baseline_unavailable') ? 3 : 0;
    return states.every((s) => s === 'clean') ? 0 : 1;
  }
  if (cmd === 'baseline') {
    const mode = flag('--init') ? 'init' : flag('--rebuild') ? 'rebuild' : null;
    const m = baseline(vault, { mode, reason: opt('--reason') });
    console.log(`manifest written: ${Object.keys(m.files).length} files${m.rebuilt_at ? `, REBUILT at ${m.rebuilt_at} reason="${m.rebuild_reason}"` : ''}`);
    return 0;
  }
  if (cmd === 'append-history') {
    const actor = opt('--actor') ?? undefined;
    const [slug, line] = args;
    console.log(JSON.stringify(appendHistory(vault, slug, line, actor)));
    return 0;
  }
  console.error('usage: validate [--protected] [--json] | baseline (--init|--rebuild) --reason R | append-history <slug> "<line>"');
  return 2;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error('error: ' + e.message); process.exitCode = 2; }
}
