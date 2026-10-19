import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { T0, T0_ZONE, notePath, writeSyntheticVault, type SyntheticNote } from '../../evals/compile-value/fixtures/synthetic-vault';
import { EvaluationError, evaluate, type EvaluationReport } from '../../evals/compile-value/lib/evaluate';
import { FreezeError, REPO_ROOT, freezeVault, loadFreeze, type Freeze } from '../../evals/compile-value/lib/freeze';
import { renderMarkdown } from '../../evals/compile-value/lib/markdown';
import { type AvailablePolicy, type Policy, availablePolicies, policiesFor } from '../../evals/compile-value/lib/policies';
import { buildPool } from '../../evals/compile-value/lib/pool';
import type { PrivateFile } from '../../evals/compile-value/lib/private';
import { loadQueue, type FrozenQueue } from '../../evals/compile-value/lib/queue';
import { SampleError, allocate, drawSample, systematic } from '../../evals/compile-value/lib/sample';
import { SHEET_NOTE_KEYS, readSheet, serializeSheet, writeSheet, type Sheet } from '../../evals/compile-value/lib/sheet';
import { mulberry32, sha256 } from '../../evals/compile-value/lib/rng';
import { parse as parseYaml } from 'yaml';

const temps: string[] = [];
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cv-eval-'));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

interface World {
  vault: string;
  notes: SyntheticNote[];
  freeze: Freeze;
  queue: FrozenQueue;
  policies: Policy[];
}

function world(): World {
  const vault = temp();
  const notes = writeSyntheticVault(vault);
  const freeze = freezeVault(vault, join(temp(), 'freeze'), { now: T0, timeZone: T0_ZONE });
  const queue = loadQueue(freeze);
  return { vault, notes, freeze, queue, policies: policiesFor(queue) };
}

function sampledAndPooled(w: World, extra: AvailablePolicy[] = [], seeded = [notePath(39), notePath(3)]): { sheet: Sheet; privateFile: PrivateFile } {
  const sample = drawSample(w.freeze, w.queue, { size: 16, floor: 4, seed: 42, seeded, now: T0 });
  const pool = buildPool(sample.sheet, sample.privateFile, [...availablePolicies(w.policies), ...extra], { seed: 42, now: T0 });
  return { sheet: pool.sheet, privateFile: pool.privateFile };
}

/** Labels every sheet entry from the fixture's ground truth. */
function label(sheet: Sheet, notes: SyntheticNote[], selected: string[] = []): Sheet {
  const truth = new Map(notes.map((note) => [note.path, note.truth]));
  const labelled = sheet.notes.map((note) => {
    const t = truth.get(note.path);
    if (!t) throw new Error(`no truth for ${note.path}`);
    return {
      ...note,
      worth: t.worth,
      delta: t.delta,
      relevance: t.relevance,
      cook_next: t.cookNext ? ('yes' as const) : ('no' as const),
      cook_next_reason: t.cookNext ? { code: 'new-decision' as const, why: 'Synthetic decision with no compiled home.' } : null,
      type: t.type,
      importance: t.importance,
    };
  });
  const idOf = new Map(labelled.map((note) => [note.path, note.id]));
  return { ...sheet, notes: labelled, selected_next: selected.map((path) => idOf.get(path) as string) };
}

describe('freeze (protocol §2)', () => {
  it('copies the queue inputs with original mtimes and ids the freeze by its manifest hash', () => {
    const w = world();
    expect(w.freeze.freezeId).toBe(sha256(readFileSync(join(w.freeze.dir, 'manifest.json'), 'utf8')));
    expect(w.freeze.manifest.timeZone).toBe(T0_ZONE);
    for (const path of ['KNOWLEDGE.md', '.knowlery/focus.md', '.knowlery/triage.json', 'concepts/example-storage.md', notePath(0)]) {
      expect(w.freeze.manifest.files.some((file) => file.path === path)).toBe(true);
    }
    const original = Math.round(statSync(join(w.vault, notePath(7))).mtimeMs);
    expect(Math.round(statSync(join(w.freeze.vaultDir, notePath(7))).mtimeMs)).toBe(original);
    expect(w.queue.notes).toHaveLength(43);
    expect(w.queue.hasJevScores).toBe(true);
    expect(w.queue.byPath.has('Projects/svc/storage kickoff.md')).toBe(false);
  });

  it('retries when the vault changes during the copy, and fails without a freeze id when it keeps changing', () => {
    const vault = temp();
    writeSyntheticVault(vault);
    const once = freezeVault(vault, join(temp(), 'freeze'), {
      afterCopy: (attempt) => {
        if (attempt === 1) writeFileSync(join(vault, notePath(5)), '# edited during freeze\n');
      },
    });
    expect(readFileSync(join(once.vaultDir, notePath(5)), 'utf8')).toBe('# edited during freeze\n');

    const out = join(temp(), 'freeze');
    let attempts = 0;
    const failure = ((): unknown => {
      try {
        freezeVault(vault, out, {
          afterCopy: (attempt) => {
            attempts = attempt;
            writeFileSync(join(vault, 'concepts', `new-page-${attempt}.md`), `---\ntitle: New ${attempt}\n---\nbody\n`);
          },
        });
        return null;
      } catch (error) {
        return error;
      }
    })();
    expect(failure).toBeInstanceOf(FreezeError);
    expect((failure as FreezeError).changedPaths).toContain('concepts/new-page-3.md');
    expect(attempts).toBe(3);
    expect(existsSync(join(out, 'manifest.json'))).toBe(false);
    expect(existsSync(join(out, 'vault'))).toBe(false);
  });

  it('refuses the repository, non-empty targets, and tampered copies', () => {
    const vault = temp();
    writeSyntheticVault(vault);
    expect(() => freezeVault(vault, join(REPO_ROOT, 'evals', 'compile-value', 'tmp-freeze'))).toThrow(/outside the repository/);
    const busy = temp();
    writeFileSync(join(busy, 'x'), 'x');
    expect(() => freezeVault(vault, busy)).toThrow(/non-empty/);
    const freeze = freezeVault(vault, join(temp(), 'freeze'));
    writeFileSync(join(freeze.vaultDir, notePath(1)), 'tampered');
    expect(() => loadFreeze(freeze.dir, { verify: true })).toThrow(/differs from its manifest/);
  });

  it('verification covers the file set and mtimes, not only content: one freeze id, one queue', () => {
    const w = world();
    expect(w.freeze.orderParity).toEqual({ queue: 43, triage: true });
    expect(loadFreeze(w.freeze.dir).freezeId).toBe(w.freeze.freezeId);
    const before = loadQueue(loadFreeze(w.freeze.dir)).notes.map((note) => note.path);
    expect(policiesFor(w.queue).find((policy) => policy.id === 'B0')).toMatchObject({ order: before });

    const touched = join(w.freeze.vaultDir, notePath(30));
    const now = Date.now() / 1000;
    utimesSync(touched, now, now);
    expect(loadQueue(w.freeze).notes[0].path).toBe(notePath(30));
    expect(() => loadFreeze(w.freeze.dir)).toThrow(/differs from its manifest/);
    const mtime = (w.freeze.manifest.files.find((file) => file.path === notePath(30)) as { mtimeMs: number }).mtimeMs / 1000;
    utimesSync(touched, mtime, mtime);
    expect(loadFreeze(w.freeze.dir).freezeId).toBe(w.freeze.freezeId);

    writeFileSync(join(w.freeze.vaultDir, 'Journal', 'added.md'), '# added after freezing\n');
    expect(() => loadFreeze(w.freeze.dir)).toThrow(/Journal\/added\.md/);
    rmSync(join(w.freeze.vaultDir, 'Journal', 'added.md'));
    writeFileSync(join(w.freeze.vaultDir, '.hidden-extra'), 'x');
    expect(() => loadFreeze(w.freeze.dir)).toThrow(/\.hidden-extra/);
    rmSync(join(w.freeze.vaultDir, '.hidden-extra'));
    rmSync(join(w.freeze.vaultDir, notePath(2)));
    expect(() => loadFreeze(w.freeze.dir)).toThrow(/differs from its manifest/);
  });

  it('refuses a copy whose queue order differs from the source vault', () => {
    const vault = temp();
    writeSyntheticVault(vault);
    const out = join(temp(), 'freeze');
    const failure = ((): unknown => {
      try {
        freezeVault(vault, out, {
          afterCopy: () => {
            const now = Date.now() / 1000;
            utimesSync(join(out, 'vault', notePath(30)), now, now);
          },
        });
        return null;
      } catch (error) {
        return error;
      }
    })();
    expect(failure).toBeInstanceOf(FreezeError);
    expect((failure as Error).message).toMatch(/does not reproduce the vault's queue order.*mtime order rank 1: source .*note-00.*copy .*note-30/);
    expect(existsSync(join(out, 'manifest.json'))).toBe(false);
  });
});

describe('policies (protocol §8)', () => {
  it('B0 and B2 rank the frozen queue with the product code; unbuilt producers are named, never faked', () => {
    const w = world();
    const b0 = w.policies.find((policy) => policy.id === 'B0') as AvailablePolicy;
    const b2 = w.policies.find((policy) => policy.id === 'B2') as AvailablePolicy;
    expect(b0.order.slice(0, 3)).toEqual([notePath(0), notePath(1), notePath(2)]);
    expect(b2.order.slice(0, 10)).toEqual([22, 25, 28, 31, 34, 0, 3, 30, 33, 36].map(notePath));
    expect(b2.order.slice(-3)).toEqual([notePath(1), notePath(2), notePath(4)]);
    const unavailable = w.policies.filter((policy) => !policy.available);
    expect(unavailable.map((policy) => policy.id)).toEqual(["B2'", 'C1', 'C2', 'C3', 'C4']);
    for (const policy of unavailable) expect(policy.available ? [] : policy.missing).not.toHaveLength(0);
  });

  it('B2 is not available without frozen 1.6.0 scores', () => {
    const vault = temp();
    writeSyntheticVault(vault);
    rmSync(join(vault, '.knowlery', 'triage.json'));
    const freeze = freezeVault(vault, join(temp(), 'freeze'));
    const b2 = policiesFor(loadQueue(freeze)).find((policy) => policy.id === 'B2');
    expect(b2?.available).toBe(false);
  });
});

describe('diagnostic sample (protocol §3–4)', () => {
  it('allocation honours floors and stratum sizes', () => {
    const allocation = allocate(new Map([['le30d', 4], ['30to180d', 16], ['gt180d', 20]]), 10, 6);
    expect([...allocation.values()].reduce((a, b) => a + b, 0)).toBe(10);
    expect(allocation.get('gt180d')).toBeGreaterThanOrEqual(6);
    for (const [key, n] of allocation) expect(n).toBeLessThanOrEqual(new Map([['le30d', 4], ['30to180d', 16], ['gt180d', 20]]).get(key) as number);
  });

  it('every non-empty stratum gets at least one draw, so π > 0 everywhere', () => {
    const allocation = allocate(new Map([['a', 3999], ['b', 1]]), 80, 0);
    expect(allocation.get('b')).toBe(1);
    expect(allocation.get('a')).toBe(79);
    const many = allocate(new Map([['gt180d|le0.2', 1], ['le30d|gt0.8', 2], ['30to180d|unscored', 500], ['gt180d|gt0.8', 3000]]), 20, 6);
    expect([...many.values()].reduce((a, b) => a + b, 0)).toBe(20);
    for (const n of many.values()) expect(n).toBeGreaterThanOrEqual(1);
    expect(allocate(new Map([['a', 5], ['b', 0]]), 3, 0).has('b')).toBe(false);
    expect(() => allocate(new Map([['a', 1], ['b', 1], ['c', 1]]), 2, 0)).toThrow(SampleError);
  });

  it('falls back to age-only strata when age × Jev cells outnumber the sample', () => {
    const w = world();
    const jevCells = new Set(w.queue.notes.map((note) => `${note.ageBucket}|${note.jevBand ?? 'unscored'}`)).size;
    const ageCells = new Set(w.queue.notes.map((note) => note.ageBucket)).size;
    expect(jevCells).toBeGreaterThan(ageCells);
    const { privateFile, warnings } = drawSample(w.freeze, w.queue, { size: ageCells, floor: 0, seed: 3, now: T0 });
    expect(privateFile.sample.usedJevStrata).toBe(false);
    expect(warnings.join(' ')).toMatch(/falling back to age-only strata/);
    for (const stratum of privateFile.sample.strata) expect(stratum.allocated).toBe(1);
  });

  it('systematic sampling draws n distinct members', () => {
    const picked = systematic(Array.from({ length: 17 }, (_, i) => i), 5, mulberry32(3));
    expect(new Set(picked).size).toBe(5);
  });

  it('inclusion probabilities re-weight the sample to the eligible population exactly', () => {
    const w = world();
    const { privateFile } = drawSample(w.freeze, w.queue, { size: 16, floor: 4, seed: 42, now: T0 });
    expect(privateFile.sample.ineligible).toEqual(['Specs/api spec 2025-08-01.md']);
    const diagnostic = Object.values(privateFile.entries).filter((entry) => entry.sources.includes('diagnostic'));
    expect(diagnostic).toHaveLength(16);
    const weighted = diagnostic.reduce((sum, entry) => sum + 1 / (entry.pi as number), 0);
    expect(weighted).toBeCloseTo(42, 9);
    const oldest = diagnostic.filter((entry) => entry.stratum?.startsWith('gt180d'));
    expect(oldest.length).toBeGreaterThanOrEqual(4);
    expect(privateFile.sample.usedJevStrata).toBe(true);
  });

  it('the sheet is blind: no scores, strata, probabilities, tiers or seeded flags', () => {
    const w = world();
    const { sheet, privateFile } = sampledAndPooled(w);
    const parsed = parseYaml(serializeSheet(sheet)) as Sheet;
    // The rules comment may mention Jev; the data must not.
    const text = JSON.stringify(parsed);
    for (const note of parsed.notes) expect(Object.keys(note).sort()).toEqual([...SHEET_NOTE_KEYS].sort());
    expect(Object.keys(parsed).sort()).toEqual(['header', 'notes', 'selected_next']);
    for (const forbidden of ['stratum', 'seeded', 'pi:', 'jev', 'diagnostic', 'pool', 'probe', '0.95', 'gt0.8', 'le0.2']) {
      expect(text.toLowerCase()).not.toContain(forbidden);
    }
    expect(Object.values(privateFile.entries).some((entry) => entry.sources.includes('seeded'))).toBe(true);
    expect(parsed.notes.map((note) => note.id).every((id) => /^n[0-9a-f]{6,}$/.test(id))).toBe(true);
  });

  it('rejects seeded notes outside the queue and more than ten', () => {
    const w = world();
    expect(() => drawSample(w.freeze, w.queue, { seed: 1, seeded: ['concepts/example-storage.md'] })).toThrow(/uncooked notes in the freeze/);
    expect(() => drawSample(w.freeze, w.queue, { seed: 1, seeded: Array.from({ length: 11 }, (_, i) => notePath(i)) })).toThrow(/At most 10/);
  });

  it('records focus sources in force at frozenAt in the frozen zone', () => {
    const w = world();
    const { sheet } = drawSample(w.freeze, w.queue, { seed: 1 });
    expect(sheet.header.focus_sources).toEqual(['.knowlery/focus.md', 'KNOWLEDGE.md']);
    expect(sheet.header.frozen_tz).toBe(T0_ZONE);
  });
});

describe('operational pool (protocol §5)', () => {
  it('is the union of every available policy top 20, merged blind into the sheet', () => {
    const w = world();
    const { sheet, privateFile } = sampledAndPooled(w);
    const pooled = Object.values(privateFile.entries).filter((entry) => entry.sources.includes('pool')).map((entry) => entry.path).sort();
    const expected = [...Array.from({ length: 20 }, (_, i) => i), 22, 25, 28, 30, 31, 33, 34, 36].map(notePath).sort();
    expect(pooled).toEqual(expected);
    expect(new Set(sheet.notes.map((note) => note.path))).toEqual(new Set(Object.values(privateFile.entries).map((entry) => entry.path)));
    expect(privateFile.pool?.policies).toEqual(['B0', 'B2']);
    expect(() => buildPool(sheet, privateFile, availablePolicies(w.policies), { seed: 1 })).toThrow(/already has a pool/);
  });

  it('the probe records its inclusion probability and pooling after labelling is flagged', () => {
    const w = world();
    const sample = drawSample(w.freeze, w.queue, { size: 16, floor: 4, seed: 42 });
    const started = label(sample.sheet, w.notes);
    const result = buildPool(started, sample.privateFile, availablePolicies(w.policies), { seed: 42, probePerPolicy: 5 });
    const probes = Object.values(result.privateFile.entries).flatMap((entry) => entry.probes ?? []);
    expect(probes.filter((probe) => probe.policy === 'B0')).toHaveLength(5);
    for (const probe of probes) {
      expect(probe.rank).toBeGreaterThanOrEqual(21);
      expect(probe.pi).toBeCloseTo(5 / 23, 10);
    }
    expect(result.privateFile.pool?.appendedAfterLabelling).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/already started/);
  });
});

describe('evaluation (protocol §8–10) on hand-computed fixture values', () => {
  function evaluated(w: World, selected: string[] = [notePath(3), notePath(25), notePath(0)]): EvaluationReport {
    const { sheet, privateFile } = sampledAndPooled(w);
    return evaluate({ freeze: w.freeze, queue: w.queue, policies: w.policies, privateFile, sheet: label(sheet, w.notes, selected), seed: 7, resamples: 300 });
  }

  it('operational precision, nDCG and the oracle ceiling match the fixture design', () => {
    const report = evaluated(world());
    const b0 = report.operational.rows.find((row) => row.policy === 'B0');
    const b2 = report.operational.rows.find((row) => row.policy === 'B2');
    expect(b0?.complete).toBe(true);
    expect(b0?.precisionAt10.value).toBeCloseTo(0.4, 10);
    expect(b0?.precisionAt20.value).toBeCloseTo(0.3, 10);
    expect(b2?.precisionAt10.value).toBeCloseTo(0.6, 10);
    expect(b2?.precisionAt20.value).toBeCloseTo(0.45, 10);
    expect(b2?.diffVsB0?.precisionAt10.value).toBeCloseTo(0.2, 10);
    expect(report.operational.oracle.precisionAt10).toBe(1);

    // Gains: selected + actionable critical 3 (note-03, note-25); selected 2 (note-00); other yes 1.
    const log2 = Math.log2;
    const ideal = 3 + 3 / log2(3) + 2 / 2 + [5, 6, 7, 8, 9, 10, 11].reduce((sum, r) => sum + 1 / log2(r), 0);
    const b0Dcg = 2 + 3 / log2(5) + 1 / log2(7) + 1 / log2(10);
    // note-22 first contributes 0: Jev's top score, but redundant.
    const b2Dcg = 3 / log2(3) + 1 / 2 + 1 / log2(5) + 1 / log2(6) + 2 / log2(7) + 3 / log2(8);
    expect(b0?.ndcgAt10.value).toBeCloseTo(b0Dcg / ideal, 10);
    expect(b2?.ndcgAt10.value).toBeCloseTo(b2Dcg / ideal, 10);
    for (const row of report.operational.rows) {
      const [low, high] = row.precisionAt10.ci as [number, number];
      expect(low).toBeLessThanOrEqual(high);
    }
    expect(report.intervalScope).toBe('exploratory, single vault');
  });

  it('actionable critical: note-39 is buried by both baselines; seeded notes are reported individually', () => {
    const report = evaluated(world());
    for (const row of report.misses.rows) {
      expect(row.worstObservedPercentile).toBeGreaterThan(80);
      expect(row.recall.find((entry) => entry.k === 10)?.labelledInTopK).toBe(row.policy === 'B0' ? 1 : 2);
    }
    const seeded = new Map(report.seeded.map((entry) => [entry.path, entry]));
    expect(seeded.get(notePath(39))?.actionableCritical).toBe(true);
    expect(seeded.get(notePath(3))?.actionableCritical).toBe(true);
    expect(seeded.get(notePath(39))?.percentiles.B0).toBeCloseTo((100 * 39.5) / 43, 10);
  });

  it('actionable-critical estimates count the labelled pool exactly, so recall agrees with the labelled top k (§9.3)', () => {
    const w = world();
    const report = evaluated(w);
    const total = report.misses.estimatedActionableCritical.value as number;
    // note-03 (B0 top 20) and note-25 (B2 top 10) are pooled and counted once each;
    // note-39 is a diagnostic note outside the pool, weighted by 1/π.
    const pi39 = Object.values(sampledAndPooled(w).privateFile.entries).find((entry) => entry.path === notePath(39))?.pi as number;
    expect(pi39).toBeGreaterThan(0);
    expect(total).toBeCloseTo(2 + 1 / pi39, 10);
    for (const row of report.misses.rows) {
      for (const entry of row.recall.filter((recall) => recall.k <= 20)) {
        expect(entry.labelledInTopK).not.toBeNull();
        expect((entry.estimate.value as number) * total).toBeCloseTo(entry.labelledInTopK as number, 10);
      }
    }
    expect(report.misses.rows.find((row) => row.policy === 'B0')?.recall.find((entry) => entry.k === 10)?.estimate.value).toBeCloseTo(1 / total, 10);
    expect(report.misses.rows.find((row) => row.policy === 'B2')?.bottom20Share.value).toBeCloseTo(1 / pi39 / total, 10);

    const { sheet, privateFile } = sampledAndPooled(w);
    const labelled = label(sheet, w.notes);
    const pooledOnly = Object.entries(privateFile.entries).find(([, entry]) => entry.sources.join() === 'pool') as [string, PrivateFile['entries'][string]];
    const partial = { ...labelled, notes: labelled.notes.map((note) => (note.id === pooledOnly[0] ? { ...note, worth: null, delta: null, relevance: null, cook_next: null, cook_next_reason: null, type: null, importance: null } : note)) };
    const withheld = evaluate({ freeze: w.freeze, queue: w.queue, policies: w.policies, privateFile, sheet: partial, seed: 7, resamples: 20 });
    expect(withheld.misses.estimatedActionableCritical.value).toBeNull();
    expect(withheld.misses.rows.every((row) => row.bottom20Share.value === null)).toBe(true);
    expect(withheld.misses.notes.join(' ')).toMatch(/Pool incomplete: 1 pooled note/);
  });

  it('never reports a zero-width or event-conditioned interval for actionable-critical estimates', () => {
    const w = world();
    const candidate = oracleCandidate(w);
    // Seed 1: the only actionable-critical diagnostic note is note-25, which the pool already holds.
    const sample = drawSample(w.freeze, w.queue, { size: 16, floor: 4, seed: 1, now: T0 });
    const diagnosticAc = Object.values(sample.privateFile.entries).filter((entry) => [notePath(3), notePath(25), notePath(39)].includes(entry.path)).map((entry) => entry.path);
    expect(diagnosticAc).toEqual([notePath(25)]);
    const pooled = buildPool(sample.sheet, sample.privateFile, [...availablePolicies(w.policies), candidate], { seed: 1, now: T0 });
    const labelled = label(pooled.sheet, w.notes);
    const report = evaluate({ freeze: w.freeze, queue: w.queue, policies: [...w.policies, candidate], privateFile: pooled.privateFile, sheet: labelled, intraSheet: labelled, seed: 7, resamples: 300 });
    // The candidate pools all three actionable-critical notes, so the total is exact.
    expect(report.misses.estimatedActionableCritical.value).toBeCloseTo(3, 10);
    expect(report.misses.estimatedActionableCritical.ci).toBeNull();
    for (const row of report.misses.rows) {
      expect(row.bottom20Share.value).not.toBeNull();
      expect(row.bottom20Share.ci).toBeNull();
      expect(row.recall.every((entry) => entry.estimate.ci === null)).toBe(true);
      expect(row.diffVsB0?.ci ?? null).toBeNull();
    }
    expect(report.misses.notes.join(' ')).toMatch(/nothing to resample/);
    const decision = report.decisions.find((entry) => entry.policy === 'C-oracle');
    for (const check of decision?.checks.filter((entry) => entry.rule.includes('Bottom-20%')) ?? []) expect(check.outcome).toBe('insufficient evidence');
    expect(decision?.outcome).toBe('insufficient evidence');

    // Without a pool, the one event is missing from some resamples: those replicates are
    // undefined, and an interval over the rest would have read [1, 1].
    const unpooled = evaluate({ freeze: w.freeze, queue: w.queue, policies: w.policies, privateFile: sample.privateFile, sheet: label(sample.sheet, w.notes), seed: 7, resamples: 300 });
    const b2 = unpooled.misses.rows.find((row) => row.policy === 'B2');
    expect(b2?.recall.find((entry) => entry.k === 10)?.estimate.value).toBe(1);
    expect(b2?.recall.find((entry) => entry.k === 10)?.estimate.ci).toBeNull();
    expect(b2?.bottom20Share.ci).toBeNull();
  });

  it('no candidate is available in 1.6.1, so no decision is made — and the report says so', () => {
    const report = evaluated(world());
    expect(report.decisions).toEqual([]);
    expect(report.decisionNote).toMatch(/No candidate policy is available/);
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('not available — missing: local-delta producer (1.7.0)');
    expect(markdown).toContain('exploratory, single vault');
    expect(report.cost).toMatch(/No paid calls/);
  });

  it('runs the §10 checks for an available candidate and never reports a CI containing 0 as superior', () => {
    const w = world();
    const b0 = w.policies.find((policy) => policy.id === 'B0') as AvailablePolicy;
    const candidate: AvailablePolicy = { id: 'C-test', kind: 'candidate', description: 'test-only', available: true, order: [...b0.order].reverse() };
    const { sheet, privateFile } = sampledAndPooled(w, [candidate]);
    const report = evaluate({
      freeze: w.freeze, queue: w.queue, policies: [...w.policies, candidate], privateFile, sheet: label(sheet, w.notes), seed: 7, resamples: 300,
    });
    const decision = report.decisions.find((entry) => entry.policy === 'C-test');
    expect(decision).toBeDefined();
    expect(decision?.checks).toHaveLength(7);
    expect(decision?.outcome).toBe('fail');
    const superiorityCheck = decision?.checks[0];
    expect(superiorityCheck?.outcome).not.toBe('pass');
  });

  /** Ranks actionable-critical, then cook_next notes first; `buried` keep their B0 place. */
  function oracleCandidate(w: World, buried: string[] = []): AvailablePolicy {
    const b0 = w.policies.find((policy) => policy.id === 'B0') as AvailablePolicy;
    const truth = new Map(w.notes.map((note) => [note.path, note.truth]));
    const score = (path: string) => {
      const t = truth.get(path);
      if (!t || buried.includes(path)) return 0;
      const ac = t.importance === 'critical' && (t.delta === 'new' || t.delta === 'partial');
      return (ac ? 2 : 0) + (t.cookNext ? 1 : 0);
    };
    const order = [...b0.order].sort((a, b) => score(b) - score(a) || b0.order.indexOf(a) - b0.order.indexOf(b));
    return { id: 'C-oracle', kind: 'candidate', description: 'test-only', available: true, order };
  }

  it('a label with κ below 0.4, or no re-label at all, cannot carry a pass (§7)', () => {
    const w = world();
    // note-39 stays buried, as in both baselines, so one actionable-critical diagnostic
    // note lies outside the pool and the miss-share intervals are estimable.
    const candidate = oracleCandidate(w, [notePath(39)]);
    const { sheet, privateFile } = sampledAndPooled(w, [candidate], [notePath(3)]);
    const labelled = label(sheet, w.notes);
    const run = (intraSheet?: Sheet) => {
      const report = evaluate({ freeze: w.freeze, queue: w.queue, policies: [...w.policies, candidate], privateFile, sheet: labelled, ...(intraSheet ? { intraSheet } : {}), seed: 7, resamples: 300 });
      return report.decisions.find((entry) => entry.policy === 'C-oracle') as EvaluationReport['decisions'][number];
    };
    const gate = (decision: EvaluationReport['decisions'][number]) => decision.checks.find((check) => check.rule.startsWith('§7')) as EvaluationReport['decisions'][number]['checks'][number];

    const agreed = run(labelled);
    expect(agreed.checks.filter((check) => check !== gate(agreed)).map((check) => check.outcome)).toEqual(Array(6).fill('pass'));
    expect(gate(agreed).outcome).toBe('pass');
    expect(agreed.outcome).toBe('pass');

    const none = run();
    expect(gate(none).detail).toMatch(/no intra-rater/);
    expect(none.outcome).toBe('insufficient evidence');

    const few = run({ ...labelled, notes: labelled.notes.slice(0, 3), selected_next: [] });
    expect(gate(few).detail).toMatch(/3 re-labelled, \d+ needed/);
    expect(few.outcome).toBe('insufficient evidence');

    const flipped = run({
      ...labelled,
      notes: labelled.notes.map((note, i) => (i % 2 === 0
        ? { ...note, cook_next: note.cook_next === 'yes' ? ('no' as const) : ('yes' as const), cook_next_reason: note.cook_next === 'yes' ? null : { code: 'new-decision' as const, why: 'Flipped on re-label.' } }
        : note)),
    });
    expect(gate(flipped).detail).toMatch(/cook_next/);
    expect(flipped.outcome).toBe('insufficient evidence');
  });

  it('withholds population estimates while the diagnostic sample is incomplete', () => {
    const w = world();
    const candidate = oracleCandidate(w);
    const { sheet, privateFile } = sampledAndPooled(w, [candidate]);
    const labelled = label(sheet, w.notes);
    const diagnosticOnly = Object.entries(privateFile.entries).find(([, entry]) => entry.sources.join() === 'diagnostic') as [string, PrivateFile['entries'][string]];
    expect(diagnosticOnly).toBeDefined();
    const partial = {
      ...labelled,
      notes: labelled.notes.map((note) => (note.id === diagnosticOnly[0] ? { ...note, worth: null, delta: null, relevance: null, cook_next: null, cook_next_reason: null, type: null, importance: null } : note)),
    };
    const report = evaluate({ freeze: w.freeze, queue: w.queue, policies: [...w.policies, candidate], privateFile, sheet: partial, intraSheet: labelled, seed: 7, resamples: 50 });
    expect(report.counts.diagnosticLabelled).toBe(report.counts.diagnostic - 1);
    expect(report.b1.prevalence).toEqual({ value: null, ci: null });
    expect(report.misses.estimatedActionableCritical).toEqual({ value: null, ci: null });
    for (const row of report.misses.rows) {
      expect(row.bottom20Share.value).toBeNull();
      expect(row.recall.every((entry) => entry.estimate.value === null)).toBe(true);
      expect(row.diffVsB0?.value ?? null).toBeNull();
    }
    expect(report.diagnostic.withinSample.every((row) => row.precisionAt10 === null)).toBe(true);
    expect(report.diagnostic.groups).toEqual([]);
    expect(report.diagnostic.calibration).toBeNull();
    expect(report.warnings.join(' ')).toMatch(/Diagnostic sample incomplete: \d+ of \d+ labelled/);
    const decision = report.decisions.find((entry) => entry.policy === 'C-oracle');
    expect(decision?.checks.find((check) => check.rule.includes('Diagnostic veto'))?.outcome).toBe('insufficient evidence');
    expect(decision?.outcome).toBe('insufficient evidence');
    expect(report.operational.rows.find((row) => row.policy === 'B0')?.complete).toBe(true);
  });

  it('refuses mixed freezes and sheets with label errors; withholds metrics for an incomplete top 20', () => {
    const w = world();
    const otherVault = temp();
    writeSyntheticVault(otherVault);
    const other = { freeze: freezeVault(otherVault, join(temp(), 'freeze'), { now: new Date('2026-10-02T00:00:00Z'), timeZone: T0_ZONE }) };
    expect(other.freeze.freezeId).not.toBe(w.freeze.freezeId);
    const { sheet, privateFile } = sampledAndPooled(w);
    const labelled = label(sheet, w.notes);
    expect(() => evaluate({ freeze: other.freeze, queue: w.queue, policies: w.policies, privateFile, sheet: labelled, seed: 1, resamples: 10 })).toThrow(EvaluationError);

    const broken = { ...labelled, notes: labelled.notes.map((note, i) => (i === 0 ? { ...note, cook_next: 'yes' as const, cook_next_reason: null } : note)) };
    expect(() => evaluate({ freeze: w.freeze, queue: w.queue, policies: w.policies, privateFile, sheet: broken, seed: 1, resamples: 10 })).toThrow(/cook_next_reason/);

    const top = notePath(0);
    const partial = { ...labelled, notes: labelled.notes.map((note) => (note.path === top ? { ...note, worth: null, delta: null, relevance: null, cook_next: null, cook_next_reason: null, type: null, importance: null } : note)) };
    const report = evaluate({ freeze: w.freeze, queue: w.queue, policies: w.policies, privateFile, sheet: partial, seed: 1, resamples: 10 });
    const b0 = report.operational.rows.find((row) => row.policy === 'B0');
    expect(b0?.complete).toBe(false);
    expect(b0?.precisionAt10.value).toBeNull();
    expect(report.warnings.join(' ')).toMatch(/unlabelled/);
  });

  it('round-trips the sheet through YAML and computes intra-rater κ', () => {
    const w = world();
    const { sheet, privateFile } = sampledAndPooled(w);
    const dir = temp();
    writeSheet(join(dir, 'sheet.yaml'), label(sheet, w.notes));
    const reread = readSheet(join(dir, 'sheet.yaml'));
    const report = evaluate({ freeze: w.freeze, queue: w.queue, policies: w.policies, privateFile, sheet: reread, intraSheet: reread, seed: 1, resamples: 10 });
    expect(report.kappa?.find((row) => row.label === 'cook_next')?.kappa).toBe(1);
  });
});

describe('CLIs', () => {
  it('freeze → sample → pool → run end to end on the synthetic vault', () => {
    const vault = temp();
    writeSyntheticVault(vault);
    const work = temp();
    mkdirSync(join(work, 'labels'));
    const tsx = join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
    const run = (script: string, args: string[]) => spawnSync(tsx, [join(REPO_ROOT, 'evals', 'compile-value', script), ...args], { encoding: 'utf8', cwd: REPO_ROOT });
    const freezeDir = join(work, 'freeze');
    const sheet = join(work, 'labels', 'sheet.yaml');
    const priv = join(work, 'labels', 'private.json');
    expect(run('freeze.ts', ['--vault', vault, '--out', freezeDir, '--time-zone', 'UTC']).status).toBe(0);
    expect(run('sample.ts', ['--freeze', freezeDir, '--sheet', sheet, '--private', priv, '--size', '12', '--floor', '3', '--seed', '5']).status).toBe(0);
    expect(run('sample.ts', ['--freeze', freezeDir, '--sheet', sheet, '--private', priv]).stderr).toMatch(/refusing to overwrite/);
    expect(run('pool.ts', ['--freeze', freezeDir, '--sheet', sheet, '--private', priv]).status).toBe(0);
    const out = join(work, 'report');
    const result = run('run.ts', ['--freeze', freezeDir, '--sheet', sheet, '--private', priv, '--resamples', '50', '--out', out]);
    expect(result.status).toBe(0);
    expect(readFileSync(join(out, 'report.md'), 'utf8')).toContain('No candidate policy is available');
    const version = (JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string }).version;
    expect((JSON.parse(readFileSync(join(out, 'report.json'), 'utf8')) as { harness: string }).harness).toBe(version);
    const baseline = readFileSync(join(out, 'report.json'), 'utf8');
    const again = run('run.ts', ['--freeze', freezeDir, '--sheet', sheet, '--private', priv, '--resamples', '10', '--out', out]);
    expect(again.status).not.toBe(0);
    expect(again.stderr).toMatch(/Refusing to overwrite an existing report/);
    expect(readFileSync(join(out, 'report.json'), 'utf8')).toBe(baseline);
    expect(run('freeze.ts', ['--vault', vault, '--out', join(REPO_ROOT, 'evals', 'compile-value', 'nope')]).stderr).toMatch(/outside the repository/);
  }, 60_000);
});
