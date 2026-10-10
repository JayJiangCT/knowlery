import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanVault } from '../../src/core/query/scan';
import { computeStaleness, type StalenessReport, type UncookedNote } from '../../src/core/query/staleness';
import { formatStalenessReport } from '../../src/core/query/format';
import { JEV_MODEL, type JevRequest, type JevResponse, type JevTransport } from '../../src/core/jev/client';
import {
  TRIAGE_PATH,
  annotateWithTriage,
  buildTriagePrompt,
  currentEntry,
  emptyTriageStore,
  parseTriageStore,
  readTriageStore,
  recordScores,
  scoredNotesOf,
  serializeTriageStore,
  unscoredNotes,
} from '../../src/core/jev/triage-store';
import { autoTriage, autoTriageAll, jevApiKeyFromEnv } from '../../src/core/jev/auto-triage';
import { PLUGIN_DATA_PATH, resolveJevApiKey } from '../../src/core/jev/api-key';
import { runStaleCommand } from '../../src/cli/commands/stale';
import { runTriageCommand } from '../../src/cli/commands/triage';
import { handleStaleCli } from '../../src/core/query/cli-handler';
import { nodeVaultFs } from '../../src/platform/node-fs';

/**
 * `.knowlery/triage.json` is the bridge that lets agents cooking from Codex, Claude
 * Code, Cursor or MCP see Jev's ranking without holding a key: a producer writes it,
 * every transport of the staleness report reads it. These tests pin the file's
 * contract (cache semantics, pruning, tolerant parsing), the annotated ordering, the
 * producer step, and that the key never lands anywhere on disk.
 */

let root: string;

function write(path: string, content: string, mtimeMs: number): void {
  const full = join(root, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
  utimesSync(full, mtimeMs / 1000, mtimeMs / 1000);
}

const NOTE = (title: string, body = 'Some content here.') => `---\ntitle: ${title}\n---\n\n${body}\n`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'knowlery-triage-store-'));
  for (const dir of ['entities', 'concepts', 'comparisons', 'queries']) mkdirSync(join(root, dir));
  write('KNOWLEDGE.md', '# KB\n', 1000);
  write('concepts/payouts.md', '---\ntitle: Payout retry policy\ndescription: How payouts retry\ntype: concept\n---\nRetries.\n', 1000);
  write('notes/newest.md', NOTE('Newest scratch'), 5000);
  write('notes/decision.md', NOTE('Payout retry decision', 'We decided payouts retry three times.'), 4000);
  write('notes/agenda.md', NOTE('Agenda'), 3000);
  write('notes/old.md', NOTE('Old spec'), 2000);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function nouls(request: JevRequest, value: (name: string, request: JevRequest) => number): JevResponse {
  const answers: JevResponse['answers'] = {};
  for (const name of Object.keys(request.questions)) answers[name] = { type: 'noul', noul: value(name, request) };
  return { model: JEV_MODEL, answers, usage: { input_tokens: 400, output_tokens: 0 } };
}

/** Scores by note title: decisions high, agendas low, everything else middling. */
function fakeTransport(calls: JevRequest[] = []): JevTransport {
  return (_url, headers, body) => {
    const request = JSON.parse(body) as JevRequest;
    calls.push(request);
    const title = (request.state as { note: { title: string } }).note.title;
    const worth = title.includes('decision') ? 0.93 : title.includes('Agenda') ? 0.08 : 0.5;
    const response = nouls(request, (name) => (name === 'worth_compiling' ? worth : title.includes('Payout') ? 0.9 : 0.1));
    expect(headers.Authorization).toBe('Bearer ts-test');
    return Promise.resolve({ status: 200, text: JSON.stringify(response) });
  };
}

function paths(report: StalenessReport): string[] {
  return report.uncookedNotes.map((note) => note.path);
}

describe('triage store file contract', () => {
  it('parses tolerantly: missing, malformed, wrong-model and bad entries all degrade to empty, never throw', () => {
    expect(parseTriageStore(null, JEV_MODEL)).toEqual(emptyTriageStore(JEV_MODEL));
    expect(parseTriageStore('{ nope', JEV_MODEL).entries).toEqual({});
    expect(parseTriageStore(JSON.stringify({ model: 'jev-0.1', entries: { 'a.md': { mtimeMs: 1, worth: 0.5, target: null } } }), JEV_MODEL).entries).toEqual({});
    const mixed = parseTriageStore(JSON.stringify({
      schemaVersion: 1,
      model: JEV_MODEL,
      entries: {
        'ok.md': { mtimeMs: 1, worth: 1.7, target: { path: 'concepts/x.md', title: 'X', score: 0.9 }, scoredAt: 'now' },
        'new.md': { mtimeMs: 2, worth: 0.4, target: null },
        'bad-worth.md': { mtimeMs: 1, worth: 'high', target: null },
        'bad-target.md': { mtimeMs: 1, worth: 0.5, target: { nope: true } },
      },
    }), JEV_MODEL);
    expect(Object.keys(mixed.entries).sort()).toEqual(['new.md', 'ok.md']);
    expect(mixed.entries['ok.md'].worth).toBe(1); // clamped
    expect(mixed.entries['new.md'].target).toBeNull();
  });

  it('round-trips through serialize with sorted keys', () => {
    const store = recordScores(emptyTriageStore(JEV_MODEL), [
      { path: 'b.md', mtimeMs: 2, worth: 0.2, target: null },
      { path: 'a.md', mtimeMs: 1, worth: 0.9, target: { path: 'concepts/x.md', title: 'X', score: 0.8 } },
    ], [{ path: 'a.md', title: 'A', mtimeMs: 1 }, { path: 'b.md', title: 'B', mtimeMs: 2 }], new Date('2026-10-09T00:00:00Z'));
    const text = serializeTriageStore(store);
    expect(text.indexOf('"a.md"')).toBeLessThan(text.indexOf('"b.md"'));
    expect(parseTriageStore(text, JEV_MODEL)).toEqual(store);
    expect(store.entries['a.md'].scoredAt).toBe('2026-10-09T00:00:00.000Z');
  });

  it('is a cache keyed by path + mtime: a changed note is unscored again, and pruning follows the live report', () => {
    const uncooked = [{ path: 'a.md', title: 'A', mtimeMs: 1 }, { path: 'b.md', title: 'B', mtimeMs: 2 }];
    let store = recordScores(emptyTriageStore(JEV_MODEL), [
      { path: 'a.md', mtimeMs: 1, worth: 0.9, target: null },
      { path: 'b.md', mtimeMs: 2, worth: 0.3, target: null },
    ], uncooked);
    expect(unscoredNotes(uncooked, store)).toEqual([]);

    const edited = [{ path: 'a.md', title: 'A', mtimeMs: 9 }, { path: 'c.md', title: 'C', mtimeMs: 3 }];
    expect(unscoredNotes(edited, store).map((n) => n.path)).toEqual(['a.md', 'c.md']);
    expect(currentEntry(store, edited[0])).toBeNull();

    // b.md got cooked (no longer uncooked) and a.md changed: both entries go on the next write.
    store = recordScores(store, [{ path: 'c.md', mtimeMs: 3, worth: 0.6, target: null }], edited);
    expect(Object.keys(store.entries)).toEqual(['c.md']);
  });
});

describe('mtime precision across shells', () => {
  // node statSync on APFS: fractional. Obsidian file.stat.mtime: the same instant, rounded.
  const cases = [
    { fs: 1783090433413.4277, obsidian: 1783090433413 },
    { fs: 1783090433413.5247, obsidian: 1783090433414 }, // rounds up — the half Math.floor got wrong
    { fs: 1783090433413.6033, obsidian: 1783090433414 },
    { fs: 1783090433413.9999, obsidian: 1783090433414 },
  ];

  it('entries written by either shell are current for the other, for every fractional part', () => {
    for (const { fs: fsMtime, obsidian } of cases) {
      const byPlugin = recordScores(emptyTriageStore(JEV_MODEL), [{ path: 'n.md', mtimeMs: obsidian, worth: 0.9, target: null }], [{ path: 'n.md', mtimeMs: obsidian } as UncookedNote]);
      expect(currentEntry(byPlugin, { path: 'n.md', mtimeMs: fsMtime }), `plugin→cli ${fsMtime}`).not.toBeNull();

      const byCli = recordScores(emptyTriageStore(JEV_MODEL), [{ path: 'n.md', mtimeMs: fsMtime, worth: 0.9, target: null }], [{ path: 'n.md', mtimeMs: fsMtime } as UncookedNote]);
      expect(byCli.entries['n.md'].mtimeMs).toBe(obsidian); // stored the way Obsidian reports it
      expect(currentEntry(byCli, { path: 'n.md', mtimeMs: obsidian }), `cli→plugin ${fsMtime}`).not.toBeNull();

      // Pruning uses the same comparison: a plugin-written entry survives a CLI write and the reverse.
      expect(Object.keys(recordScores(byPlugin, [], [{ path: 'n.md', mtimeMs: fsMtime } as UncookedNote]).entries)).toEqual(['n.md']);
      expect(Object.keys(recordScores(byCli, [], [{ path: 'n.md', mtimeMs: obsidian } as UncookedNote]).entries)).toEqual(['n.md']);
    }
  });

  it('reads files written before normalisation (fractional, or floored) as current', () => {
    for (const legacyMtime of [1783090433413.6033, 1783090433413 /* floored by the first fix */]) {
      const legacy = parseTriageStore(JSON.stringify({
        schemaVersion: 1, model: JEV_MODEL,
        entries: { 'n.md': { mtimeMs: legacyMtime, worth: 0.5, target: null, scoredAt: '' } },
      }), JEV_MODEL);
      expect(currentEntry(legacy, { path: 'n.md', mtimeMs: 1783090433413.6033 }), `legacy ${legacyMtime} vs fs`).not.toBeNull();
    }
    // A floored legacy value against Obsidian's rounded-up value is exactly 1 ms apart: the one case
    // we accept re-scoring, since no released build ever wrote floored values.
  });

  it('a genuinely different mtime still misses', () => {
    const store = recordScores(emptyTriageStore(JEV_MODEL), [{ path: 'n.md', mtimeMs: 1783090433413, worth: 0.9, target: null }], [{ path: 'n.md', mtimeMs: 1783090433413 } as UncookedNote]);
    expect(currentEntry(store, { path: 'n.md', mtimeMs: 1783090433415 })).toBeNull();
    expect(currentEntry(store, { path: 'n.md', mtimeMs: 1783090433412 })).toBeNull();
  });

  it('the fs scanner itself reports rounded whole milliseconds, so CLI and plugin JSON agree', () => {
    write('notes/frac.md', NOTE('Frac'), 1783090433413.6033);
    const page = scanVault(root).pages.find((p) => p.path === 'notes/frac.md');
    expect(page).toBeDefined();
    expect(Number.isInteger(page!.mtimeMs)).toBe(true);
    // utimes may truncate sub-ms precision on some filesystems; whichever it kept, we round it.
    expect(Math.abs(page!.mtimeMs - 1783090433413.6033) < 1).toBe(true);
  });
});

describe('annotateWithTriage ordering', () => {
  it('puts likely notes first by worth, then unscored by mtime, then the confident-no band — never dropping any', () => {
    const report = computeStaleness(scanVault(root));
    expect(paths(report)).toEqual(['notes/newest.md', 'notes/decision.md', 'notes/agenda.md', 'notes/old.md']);

    const store = recordScores(emptyTriageStore(JEV_MODEL), [
      { path: 'notes/decision.md', mtimeMs: 4000, worth: 0.93, target: { path: 'concepts/payouts.md', title: 'Payout retry policy', score: 0.9 } },
      { path: 'notes/agenda.md', mtimeMs: 3000, worth: 0.08, target: null },
      { path: 'notes/old.md', mtimeMs: 2000, worth: 0.55, target: null },
    ], report.uncookedNotes);
    const ranked = annotateWithTriage(report, store);
    expect(paths(ranked)).toEqual(['notes/decision.md', 'notes/old.md', 'notes/newest.md', 'notes/agenda.md']);
    expect(ranked.uncookedNotes[0].jev).toEqual({ worth: 0.93, target: { path: 'concepts/payouts.md', title: 'Payout retry policy' } });
    expect(ranked.uncookedNotes[2].jev).toBeUndefined();
    expect(ranked.stalePages).toBe(report.stalePages);

    // Stale entries (mtime moved on) are ignored, so the note is treated as unscored.
    const stale = recordScores(emptyTriageStore(JEV_MODEL), [{ path: 'notes/newest.md', mtimeMs: 1, worth: 0.99, target: null }], []);
    expect(paths(annotateWithTriage(report, stale))).toEqual(paths(report));
  });

  it('flows through computeStaleness when the snapshot carries the store, in every transport', () => {
    const base = computeStaleness(scanVault(root));
    const store = recordScores(emptyTriageStore(JEV_MODEL), [
      { path: 'notes/old.md', mtimeMs: 2000, worth: 0.9, target: null },
    ], base.uncookedNotes);
    mkdirSync(join(root, '.knowlery'), { recursive: true });
    writeFileSync(join(root, TRIAGE_PATH), serializeTriageStore(store));

    const snapshot = scanVault(root);
    expect(snapshot.triage).toEqual(store);
    const report = computeStaleness(snapshot);
    expect(paths(report)[0]).toBe('notes/old.md');

    // Text and JSON renderers carry the score; the Obsidian CLI handler is the same code path.
    const text = formatStalenessReport(report);
    expect(text).toContain('Jev-ranked, 1 of 4 scored');
    expect(text).toContain('1. notes/old.md (1970-01-01)  jev 0.90 → new page');
    const json = JSON.parse(handleStaleCli({ json: 'true' }, snapshot)) as StalenessReport;
    expect(json.uncookedNotes[0].jev).toEqual({ worth: 0.9, target: null });
    expect(json.uncookedNotes[1].jev).toBeUndefined();
  });

  it('builds the cook prompt from the annotated notes', () => {
    const report = computeStaleness(scanVault(root));
    const store = recordScores(emptyTriageStore(JEV_MODEL), [
      { path: 'notes/decision.md', mtimeMs: 4000, worth: 0.93, target: { path: 'concepts/payouts.md', title: 'P', score: 0.9 } },
      { path: 'notes/agenda.md', mtimeMs: 3000, worth: 0.08, target: null },
    ], report.uncookedNotes);
    const prompt = buildTriagePrompt(scoredNotesOf(annotateWithTriage(report, store)));
    expect(prompt).toContain('- 0.93  notes/decision.md  → update concepts/payouts.md');
    expect(prompt).toContain('Ranked unlikely');
    expect(prompt).toContain('- 0.08  notes/agenda.md');
  });
});

describe('autoTriage — the producer step', () => {
  it('scores only unscored notes (newest first, within the cap), writes the store, and returns the ranked report', async () => {
    const fs = nodeVaultFs(root);
    const calls: JevRequest[] = [];
    const snapshot = scanVault(root);
    const first = await autoTriage({
      fs,
      snapshot,
      readNote: (path) => readFile(join(root, path), 'utf8'),
      transport: fakeTransport(calls),
      apiKey: 'ts-test',
      now: () => new Date('2026-10-09T00:00:00Z'),
    });
    expect(calls).toHaveLength(4);
    expect(first.outcome?.scores).toHaveLength(4);
    expect(paths(first.report)).toEqual(['notes/decision.md', 'notes/newest.md', 'notes/old.md', 'notes/agenda.md']);
    expect(first.report.uncookedNotes[0].jev?.target?.path).toBe('concepts/payouts.md');

    const written = JSON.parse(readFileSync(join(root, TRIAGE_PATH), 'utf8')) as { model: string; entries: Record<string, unknown> };
    expect(written.model).toBe(JEV_MODEL);
    expect(Object.keys(written.entries).sort()).toEqual(['notes/agenda.md', 'notes/decision.md', 'notes/newest.md', 'notes/old.md']);
    // The key is used for the HTTP header and nothing else.
    expect(readFileSync(join(root, TRIAGE_PATH), 'utf8')).not.toContain('ts-test');

    // Second pass: everything is current, Jev is not called, the file is untouched.
    const before = readFileSync(join(root, TRIAGE_PATH), 'utf8');
    const second = await autoTriage({
      fs, snapshot: scanVault(root), readNote: (path) => readFile(join(root, path), 'utf8'), transport: fakeTransport(calls), apiKey: 'ts-test',
    });
    expect(second.outcome).toBeNull();
    expect(calls).toHaveLength(4);
    expect(readFileSync(join(root, TRIAGE_PATH), 'utf8')).toBe(before);

    // Edit one note: only it is re-sent; its old entry is replaced.
    write('notes/agenda.md', NOTE('Agenda', 'Now with outcomes'), 6000);
    const third = await autoTriage({
      fs, snapshot: scanVault(root), readNote: (path) => readFile(join(root, path), 'utf8'), transport: fakeTransport(calls), apiKey: 'ts-test',
    });
    expect(calls).toHaveLength(5);
    expect(third.outcome?.scores.map((s) => s.path)).toEqual(['notes/agenda.md']);
    expect(third.store.entries['notes/agenda.md'].mtimeMs).toBe(6000);
  });

  it('leaves the mechanical report and the disk untouched when every call fails', async () => {
    const failing: JevTransport = () => Promise.resolve({ status: 500, text: 'boom' });
    const result = await autoTriage({
      fs: nodeVaultFs(root), snapshot: scanVault(root), readNote: (path) => readFile(join(root, path), 'utf8'), transport: failing, apiKey: 'ts-test',
    });
    expect(result.outcome?.failures).toHaveLength(4);
    expect(paths(result.report)).toEqual(['notes/newest.md', 'notes/decision.md', 'notes/agenda.md', 'notes/old.md']);
    expect(existsSync(join(root, TRIAGE_PATH))).toBe(false);
  });
});

describe('knowlery stale with a key in the environment', () => {
  it('scores, writes the store, reports on stderr only, and stays a plain read without a key', async () => {
    const out: string[] = [];
    const warn: string[] = [];
    await runStaleCommand(root, { json: true, log: (l) => out.push(l), warn: (l) => warn.push(l) });
    expect(existsSync(join(root, TRIAGE_PATH))).toBe(false);
    expect(warn).toEqual([]);

    out.length = 0;
    await runStaleCommand(root, {
      json: true, log: (l) => out.push(l), warn: (l) => warn.push(l), jevApiKey: 'ts-test', jevTransport: fakeTransport(),
    });
    const report = JSON.parse(out.join('\n')) as StalenessReport;
    expect(paths(report)[0]).toBe('notes/decision.md');
    expect(report.uncookedNotes[0].jev?.worth).toBe(0.93);
    expect(warn).toEqual(['Jev scored 4 note(s).']);
    expect(existsSync(join(root, TRIAGE_PATH))).toBe(true);

    // A key-less reader (e.g. query.mjs on another machine) now sees the same ranking.
    out.length = 0;
    await runStaleCommand(root, { json: true, log: (l) => out.push(l) });
    expect(paths(JSON.parse(out.join('\n')) as StalenessReport)[0]).toBe('notes/decision.md');
  });

  it('degrades to the mechanical report when Jev is unreachable', async () => {
    const out: string[] = [];
    const warn: string[] = [];
    await runStaleCommand(root, {
      json: true, log: (l) => out.push(l), warn: (l) => warn.push(l), jevApiKey: 'ts-test',
      jevTransport: () => Promise.reject(new Error('ECONNREFUSED')),
    });
    const report = JSON.parse(out.join('\n')) as StalenessReport;
    expect(paths(report)).toEqual(['notes/newest.md', 'notes/decision.md', 'notes/agenda.md', 'notes/old.md']);
    expect(warn[0]).toContain('ECONNREFUSED');
  });

  it('reads the key from TYPESAFE_API_KEY and treats blank as absent', () => {
    expect(jevApiKeyFromEnv({})).toBeUndefined();
    expect(jevApiKeyFromEnv({ TYPESAFE_API_KEY: '  ' })).toBeUndefined();
    expect(jevApiKeyFromEnv({ TYPESAFE_API_KEY: ' ts-x ' })).toBe('ts-x');
  });
});

describe('resolveJevApiKey — configure the key once', () => {
  it('prefers the environment, falls back to the plugin settings file, tolerates a missing or broken file', async () => {
    const fs = nodeVaultFs(root);
    expect(await resolveJevApiKey(fs, {})).toBeNull();

    write(PLUGIN_DATA_PATH, '{ not json', 1000);
    expect(await resolveJevApiKey(fs, {})).toBeNull();

    write(PLUGIN_DATA_PATH, JSON.stringify({ kbName: 'KB', jevApiKey: ' ts-plugin ' }), 1000);
    expect(await resolveJevApiKey(fs, {})).toEqual({ apiKey: 'ts-plugin', source: 'plugin' });
    expect(await resolveJevApiKey(fs, { TYPESAFE_API_KEY: 'ts-env' })).toEqual({ apiKey: 'ts-env', source: 'env' });

    write(PLUGIN_DATA_PATH, JSON.stringify({ kbName: 'KB', jevApiKey: '' }), 1000);
    expect(await resolveJevApiKey(fs, {})).toBeNull();

    // A vault with a non-default config directory, when the caller knows it.
    write('config-alt/plugins/knowlery/data.json', JSON.stringify({ jevApiKey: 'ts-alt' }), 1000);
    expect(await resolveJevApiKey(fs, {}, 'config-alt')).toEqual({ apiKey: 'ts-alt', source: 'plugin' });
  });
});

describe('autoTriageAll — the whole backlog', () => {
  function manyNotes(count: number): void {
    for (let i = 0; i < count; i += 1) write(`bulk/note-${String(i).padStart(3, '0')}.md`, NOTE(`Bulk ${i}`), 10_000 + i);
  }

  it('keeps passing until nothing is unscored, reporting overall progress, and writes one store', async () => {
    manyNotes(95); // + 4 fixture notes = 99 unscored → 3 passes of 40
    const fs = nodeVaultFs(root);
    const calls: JevRequest[] = [];
    const progress: Array<[number, number]> = [];
    const result = await autoTriageAll({
      fs,
      snapshot: scanVault(root),
      readNote: (path) => readFile(join(root, path), 'utf8'),
      transport: fakeTransport(calls),
      apiKey: 'ts-test',
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(result.passes).toBe(3);
    expect(result.scores).toHaveLength(99);
    expect(result.failures).toEqual([]);
    expect(result.remaining).toBe(0);
    expect(calls).toHaveLength(99);
    expect(progress[0][1]).toBe(99);
    expect(progress.at(-1)).toEqual([99, 99]);
    expect(Object.keys(result.store.entries)).toHaveLength(99);
    expect(unscoredNotes(result.report.uncookedNotes, result.store)).toEqual([]);
    expect(Object.keys((JSON.parse(readFileSync(join(root, TRIAGE_PATH), 'utf8')) as { entries: object }).entries)).toHaveLength(99);

    // Nothing left: a second run sends nothing.
    const again = await autoTriageAll({
      fs, snapshot: scanVault(root), readNote: (path) => readFile(join(root, path), 'utf8'), transport: fakeTransport(calls), apiKey: 'ts-test',
    });
    expect(again.passes).toBe(0);
    expect(calls).toHaveLength(99);
  });

  it('stops after a pass in which every note failed instead of looping', async () => {
    let attempts = 0;
    const failing: JevTransport = () => {
      attempts += 1;
      return Promise.resolve({ status: 401, text: '{"error":"bad key"}' });
    };
    const result = await autoTriageAll({
      fs: nodeVaultFs(root), snapshot: scanVault(root), readNote: (path) => readFile(join(root, path), 'utf8'), transport: failing, apiKey: 'ts-test',
    });
    expect(result.passes).toBe(1);
    expect(result.scores).toEqual([]);
    expect(result.failures).toHaveLength(4);
    expect(result.remaining).toBe(4);
    expect(attempts).toBe(4);
    expect(existsSync(join(root, TRIAGE_PATH))).toBe(false);
  });
});

describe('knowlery triage', () => {
  it('refuses without a key, naming both places to put one', async () => {
    await expect(runTriageCommand(root, { log: () => undefined, key: null }))
      .rejects.toMatchObject({ exitCode: 1, message: expect.stringContaining('TYPESAFE_API_KEY') as string });
  });

  it('scores the backlog, prints bands and cost, keeps --json stdout clean, and is idempotent', async () => {
    const out: string[] = [];
    const err: string[] = [];
    await runTriageCommand(root, {
      log: (line) => out.push(line),
      warn: (line) => err.push(line),
      key: { apiKey: 'ts-test', source: 'plugin' },
      jevTransport: fakeTransport(),
    });
    const text = out.join('\n');
    expect(text).toContain('4 note(s) scored in 1 pass(es)');
    expect(text).toContain('likely knowledge: 1'); // decision
    expect(text).toContain('unlikely:         1'); // agenda
    expect(text).toContain('Key from plugin settings');
    expect(err).toEqual([]); // progress goes to the main log without --json

    const json: string[] = [];
    const progress: string[] = [];
    await runTriageCommand(root, {
      json: true,
      log: (line) => json.push(line),
      warn: (line) => progress.push(line),
      key: { apiKey: 'ts-test', source: 'env' },
      jevTransport: fakeTransport(),
    });
    const summary = JSON.parse(json.join('\n')) as { scored: number; bands: { likely: number; unlikely: number }; keySource: string };
    expect(summary).toMatchObject({ scored: 0, keySource: 'env' });
    expect(progress).toEqual([]);
    expect(readFileSync(join(root, TRIAGE_PATH), 'utf8')).not.toContain('ts-test');
  });
});

describe('readTriageStore', () => {
  it('returns an empty store for a workspace without the file', async () => {
    expect(await readTriageStore(nodeVaultFs(root), JEV_MODEL)).toEqual(emptyTriageStore(JEV_MODEL));
  });
});
