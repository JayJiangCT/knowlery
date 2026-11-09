// Unit tests for the WS-001 throwaway prototype. Run: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate, baseline, appendHistory, MANIFEST_REL } from '../proto/knowlery-proto.mjs';

const PAGE = (claim) => `---
type: concept
title: Fixture
description: Fixture page for tests.
tags: [a, b]
status: current
updated: 2026-01-01
updated_by: human:test
protected: ["^c1"]
---

# Fixture

## Current
- ${claim} (src: s1) ^c1
- An unprotected claim (src: s1) ^c2

## Sources
- s1 · human:test · stated:2026-01-01 · attestation · fixture

## History
- 2026-01-01 · [[#^c1]] added, protected by human:test · src: s1
`;
const RECORD = `---
type: record
title: Fixture record
description: Fixture record.
tags: [a, b]
status: current
updated: 2026-01-01
updated_by: human:test
date: 2026-01-01
kind: finding
---

# Fixture record (2026-01-01)

## Summary
Original summary.

## History
- 2026-01-01 · published
`;

function makeVault({ withBaseline = true } = {}) {
  const v = mkdtempSync(join(tmpdir(), 'ws001-'));
  mkdirSync(join(v, 'concepts')); mkdirSync(join(v, 'records'));
  writeFileSync(join(v, 'concepts/fix.md'), PAGE('The protected claim'));
  writeFileSync(join(v, 'records/rec-2026-01-01.md'), RECORD);
  writeFileSync(join(v, 'log.md'), '# Operation log\n');
  if (withBaseline) baseline(v, { mode: 'init', reason: 'test fixture' });
  return v;
}
const stateOf = (v, path) => validate(v).results.find((r) => r.path === path).state;
function snapshot(dir) {
  const out = {};
  const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else out[p] = [readFileSync(p, 'utf8'), statSync(p).mtimeMs]; } };
  walk(dir);
  return out;
}

test('clean: untouched files after baseline', () => {
  const v = makeVault();
  assert.equal(stateOf(v, 'concepts/fix.md'), 'clean');
  assert.equal(stateOf(v, 'records/rec-2026-01-01.md'), 'clean');
});

test('external_change: unprotected claim edited out of band', () => {
  const v = makeVault();
  const p = join(v, 'concepts/fix.md');
  writeFileSync(p, readFileSync(p, 'utf8').replace('An unprotected claim', 'An edited claim'));
  assert.equal(stateOf(v, 'concepts/fix.md'), 'external_change');
});

test('protected_change: protected claim text edited out of band', () => {
  const v = makeVault();
  writeFileSync(join(v, 'concepts/fix.md'), PAGE('A different protected claim'));
  assert.equal(stateOf(v, 'concepts/fix.md'), 'protected_change');
});

test('protected_change: protected claim moved out of ## Current', () => {
  const v = makeVault();
  const p = join(v, 'concepts/fix.md');
  const t = readFileSync(p, 'utf8').replace('- The protected claim (src: s1) ^c1\n', '').replace('## History\n', '## History\n- The protected claim (src: s1) · superseded ^c1\n');
  writeFileSync(p, t);
  assert.equal(stateOf(v, 'concepts/fix.md'), 'protected_change');
});

test('protected_change survives removal of the protected frontmatter key', () => {
  const v = makeVault();
  const p = join(v, 'concepts/fix.md');
  writeFileSync(p, PAGE('Changed').replace('protected: ["^c1"]\n', ''));
  assert.equal(stateOf(v, 'concepts/fix.md'), 'protected_change');
});

test('baseline_unavailable: no manifest, and validate does not create one', () => {
  const v = makeVault({ withBaseline: false });
  assert.ok(validate(v).results.every((r) => r.state === 'baseline_unavailable'));
  assert.equal(existsSync(join(v, MANIFEST_REL)), false);
});

test('baseline_unavailable: file added after baseline', () => {
  const v = makeVault();
  writeFileSync(join(v, 'concepts/new.md'), PAGE('New'));
  assert.equal(stateOf(v, 'concepts/new.md'), 'baseline_unavailable');
});

test('invalid_structure: record without ## Summary', () => {
  const v = makeVault();
  const p = join(v, 'records/rec-2026-01-01.md');
  writeFileSync(p, RECORD.replace('## Summary', '## Overview'));
  assert.equal(stateOf(v, 'records/rec-2026-01-01.md'), 'invalid_structure');
});

test('record: appending to ## History does not change its evidence digest', () => {
  const v = makeVault();
  const p = join(v, 'records/rec-2026-01-01.md');
  writeFileSync(p, RECORD.replace('## History\n', '## History\n- 2026-02-01 · note\n'));
  assert.equal(stateOf(v, 'records/rec-2026-01-01.md'), 'clean');
});

test('validate is read-only: no file content or mtime changes, in every state', () => {
  const v = makeVault();
  writeFileSync(join(v, 'concepts/fix.md'), PAGE('Tampered'));
  writeFileSync(join(v, 'concepts/new.md'), 'no frontmatter');
  const before = snapshot(v);
  validate(v);
  rmSync(join(v, MANIFEST_REL));
  const before2 = snapshot(v);
  validate(v);
  assert.deepEqual(snapshot(v), before2);
  delete before[join(v, MANIFEST_REL)];
  assert.deepEqual(snapshot(v), before);
});

test('baseline: requires an explicit mode and reason; init refuses to overwrite', () => {
  const v = makeVault({ withBaseline: false });
  assert.throws(() => baseline(v, { mode: null, reason: 'x' }));
  assert.throws(() => baseline(v, { mode: 'init', reason: '' }));
  baseline(v, { mode: 'init', reason: 'first' });
  assert.throws(() => baseline(v, { mode: 'init', reason: 'again' }), /use --rebuild/);
});

test('baseline --rebuild trusts an out-of-band protected edit and flags the rebuild', () => {
  const v = makeVault();
  writeFileSync(join(v, 'concepts/fix.md'), PAGE('Tampered'));
  assert.equal(stateOf(v, 'concepts/fix.md'), 'protected_change');
  baseline(v, { mode: 'rebuild', reason: 'test' });
  const r = validate(v);
  assert.equal(r.baseline.trusted_by_rebuild, true);
  assert.equal(r.results.find((x) => x.path === 'concepts/fix.md').state, 'clean');
});

test('append-history: appends newest-first, logs, updates manifest digest and write id', () => {
  const v = makeVault();
  const out = appendHistory(v, 'fix', '2026-03-01 · [[#^c2]] verified by human:test');
  const t = readFileSync(join(v, 'concepts/fix.md'), 'utf8');
  assert.match(t, /## History\n- 2026-03-01 · \[\[#\^c2\]\] verified by human:test\n/);
  assert.match(readFileSync(join(v, 'log.md'), 'utf8'), new RegExp(out.write_id));
  const m = JSON.parse(readFileSync(join(v, MANIFEST_REL), 'utf8'));
  assert.equal(m.files['concepts/fix.md'].last_write_id, out.write_id);
  assert.equal(stateOf(v, 'concepts/fix.md'), 'clean');
});

test('append-history: refuses when the page is not clean against the baseline', () => {
  const v = makeVault();
  writeFileSync(join(v, 'concepts/fix.md'), PAGE('Tampered'));
  assert.throws(() => appendHistory(v, 'fix', 'x'), /precondition failed/);
});

test('append-history: refuses without a manifest', () => {
  const v = makeVault();
  unlinkSync(join(v, MANIFEST_REL));
  assert.throws(() => appendHistory(v, 'fix', 'x'), /baseline_unavailable/);
});
