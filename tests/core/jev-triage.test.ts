import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanVault, type VaultSnapshot } from '../../src/core/query/scan';
import { computeStaleness } from '../../src/core/query/staleness';
import { askJev, JEV_ENDPOINT, JEV_MODEL, JevError, type JevRequest, type JevResponse, type JevTransport } from '../../src/core/jev/client';
import {
  buildTriagePrompt,
  buildTriageRequest,
  cacheKey,
  notePreview,
  readTriageAnswer,
  shortlistCandidates,
  TRIAGE_CAP,
  triageUncookedNotes,
  type TriageScore,
} from '../../src/core/jev/triage';

/**
 * Jev cook triage is optional and sits outside the retrieval path. These tests pin
 * the privacy boundary (what leaves the machine), the ranking/target decoding, the
 * cache contract, and that failures degrade per note rather than aborting the run.
 */

let root: string;
let snapshot: VaultSnapshot;

function write(path: string, content: string, mtimeMs: number): void {
  const full = join(root, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
  utimesSync(full, mtimeMs / 1000, mtimeMs / 1000);
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'knowlery-jev-'));
  for (const dir of ['entities', 'concepts', 'comparisons', 'queries', 'notes']) mkdirSync(join(root, dir));
  write('KNOWLEDGE.md', '# KB\n', 1000);
  write(
    'queries/zipline-webhook.md',
    '---\ntitle: Zipline webhook runtime validation\ndescription: Contract for Zipline sandbox API webhook validation\ntags: [zipline, webhook]\ntype: query\n---\nZipline webhook runtime validation contract.\n',
    1000,
  );
  write(
    'concepts/drone-strategy.md',
    '---\ntitle: Drone delivery integration strategy\ndescription: How drone delivery integrates with fulfillment\ntags: [drone]\ntype: concept\n---\nDrone eligibility and routing.\n',
    1000,
  );
  const filler = Array.from({ length: 20 }, (_, i) => `detail ${i}`).join('\n');
  write('notes/zipline-qa.md', `---\ntitle: Zipline QA doc\ntags: [zipline]\n---\n\nZipline webhook validation sandbox QA table\n\n${filler}\n\nSecret body line that must not be sent\n`, 3000);
  write('notes/agenda.md', '---\ntitle: Agenda\n---\n\n- agenda item\n', 2000);
  snapshot = scanVault(root);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function fakeTransport(answer: (request: JevRequest) => JevResponse, calls: JevRequest[] = []): JevTransport {
  return (_url, _headers, body) => {
    const request = JSON.parse(body) as JevRequest;
    calls.push(request);
    return Promise.resolve({ status: 200, text: JSON.stringify(answer(request)) });
  };
}

function nouls(request: JevRequest, value: (name: string) => number): JevResponse {
  const answers: JevResponse['answers'] = {};
  for (const name of Object.keys(request.questions)) answers[name] = { type: 'noul', noul: value(name) };
  return { model: JEV_MODEL, answers, usage: { input_tokens: 500, output_tokens: 0 } };
}

describe('notePreview — the privacy boundary', () => {
  it('sends title, frontmatter and the first non-empty lines, never the whole body', () => {
    const raw = `---\ntitle: T\ntags: [a]\n---\n\n${Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n\n')}\n`;
    const view = notePreview('notes/t.md', raw);
    expect(view.title).toBe('T');
    expect(view.tags).toEqual(['a']);
    expect(view.frontmatter).toBe('title: T\ntags: [a]');
    expect(view.preview.split('\n')).toHaveLength(15);
    expect(view.preview).not.toContain('line 29');
    expect(view.firstLine).toBe('line 0');
  });

  it('falls back to the basename when there is no title', () => {
    expect(notePreview('notes/Some Note.md', 'body only').title).toBe('Some Note');
  });
});

describe('buildTriageRequest', () => {
  it('pins the model and asks one worth question plus one same-subject question per candidate', () => {
    const view = { path: 'n.md', title: 'N', frontmatter: '', preview: 'p' };
    const request = buildTriageRequest(view, [
      { path: 'queries/a.md', title: 'A', description: 'd' },
      { path: 'queries/b.md', title: 'B' },
    ]);
    expect(request.model).toBe(JEV_MODEL);
    expect(Object.keys(request.questions)).toEqual(['worth_compiling', 'same_subject_p1', 'same_subject_p2']);
    expect(request.state).toMatchObject({
      note: view,
      existing_pages: [
        { id: 'p1', path: 'queries/a.md', title: 'A', description: 'd' },
        { id: 'p2', path: 'queries/b.md', title: 'B', description: '' },
      ],
    });
  });
});

describe('shortlistCandidates', () => {
  it('returns only compiled (agent-tier) pages for the note subject', () => {
    const view = notePreview('notes/zipline-qa.md', '---\ntitle: Zipline QA doc\ntags: [zipline]\n---\nZipline webhook validation sandbox QA\n');
    const candidates = shortlistCandidates(view, snapshot);
    expect(candidates.map((c) => c.path)).toContain('queries/zipline-webhook.md');
    expect(candidates.every((c) => !c.path.startsWith('notes/'))).toBe(true);
  });

  it('returns nothing for an empty subject', () => {
    expect(shortlistCandidates({ title: '', tags: [], firstLine: '' }, snapshot)).toEqual([]);
  });
});

describe('readTriageAnswer', () => {
  const candidates = [
    { path: 'queries/a.md', title: 'A' },
    { path: 'queries/b.md', title: 'B' },
  ];
  const response = (worth: number, p1: number, p2: number): JevResponse => ({
    model: JEV_MODEL,
    answers: {
      worth_compiling: { type: 'noul', noul: worth },
      same_subject_p1: { type: 'noul', noul: p1 },
      same_subject_p2: { type: 'noul', noul: p2 },
    },
    usage: { input_tokens: 1, output_tokens: 0 },
  });

  it('picks the best-matching candidate when it clears the threshold', () => {
    expect(readTriageAnswer(response(0.9, 0.3, 0.8), candidates)).toEqual({
      worth: 0.9,
      target: { path: 'queries/b.md', title: 'B', score: 0.8 },
    });
  });

  it('suggests a new page when no candidate is about the same subject', () => {
    expect(readTriageAnswer(response(0.9, 0.3, 0.4), candidates).target).toBeNull();
  });

  it('treats missing or out-of-range answers as zero', () => {
    const partial: JevResponse = { model: JEV_MODEL, answers: { worth_compiling: { type: 'noul', noul: 7 } }, usage: { input_tokens: 1, output_tokens: 0 } };
    expect(readTriageAnswer(partial, candidates)).toEqual({ worth: 1, target: null });
  });
});

describe('askJev', () => {
  it('posts a bearer-authenticated JSON body to the pinned endpoint', async () => {
    let seen: { url: string; headers: Record<string, string> } | null = null;
    const transport: JevTransport = (url, headers) => {
      seen = { url, headers };
      return Promise.resolve({ status: 200, text: JSON.stringify({ model: 'm', answers: {}, usage: { input_tokens: 0, output_tokens: 0 } }) });
    };
    await askJev(transport, 'secret', { state: {}, model: JEV_MODEL, questions: {} });
    expect(seen).toEqual({ url: JEV_ENDPOINT, headers: { Authorization: 'Bearer secret', 'Content-Type': 'application/json' } });
  });

  it.each([
    [401, 'unauthorized'],
    [429, 'rate-limited'],
    [500, 'http'],
  ] as const)('maps HTTP %i to a typed %s error', async (status, kind) => {
    const transport: JevTransport = () => Promise.resolve({ status, text: '' });
    await expect(askJev(transport, 'k', { state: {}, model: JEV_MODEL, questions: {} })).rejects.toMatchObject({ kind });
  });

  it('rejects non-JSON and answer-less bodies as malformed', async () => {
    const bad: JevTransport = () => Promise.resolve({ status: 200, text: 'nope' });
    await expect(askJev(bad, 'k', { state: {}, model: JEV_MODEL, questions: {} })).rejects.toBeInstanceOf(JevError);
    const empty: JevTransport = () => Promise.resolve({ status: 200, text: '{}' });
    await expect(askJev(empty, 'k', { state: {}, model: JEV_MODEL, questions: {} })).rejects.toMatchObject({ kind: 'malformed' });
  });
});

describe('triageUncookedNotes', () => {
  const readNote = (path: string) => Promise.resolve(readFileSync(join(root, path), 'utf8'));

  it('ranks uncooked notes by worth and suggests the matching compiled page', async () => {
    const uncooked = computeStaleness(snapshot).uncookedNotes;
    expect(uncooked.map((n) => n.path)).toEqual(['notes/zipline-qa.md', 'notes/agenda.md']);

    const calls: JevRequest[] = [];
    const transport = fakeTransport((request) => {
      const note = (request.state as { note: { title: string } }).note;
      return nouls(request, (name) => {
        if (name === 'worth_compiling') return note.title === 'Agenda' ? 0.1 : 0.9;
        const pages = (request.state as { existing_pages: { id: string; path: string }[] }).existing_pages;
        const page = pages.find((p) => `same_subject_${p.id}` === name)!;
        return page.path.includes('zipline') ? 0.85 : 0.1;
      });
    }, calls);

    const outcome = await triageUncookedNotes(uncooked, { snapshot, readNote, transport, apiKey: 'k' });
    expect(outcome.failures).toEqual([]);
    expect(outcome.skipped).toBe(0);
    expect(outcome.scores.map((s) => [s.path, s.worth])).toEqual([
      ['notes/zipline-qa.md', 0.9],
      ['notes/agenda.md', 0.1],
    ]);
    expect(outcome.scores[0].target).toMatchObject({ path: 'queries/zipline-webhook.md', score: 0.85 });
    expect(outcome.scores[0].inputTokens).toBe(500);

    // Privacy: the body line past the preview never left the machine.
    const sent = JSON.stringify(calls);
    expect(sent).toContain('Zipline webhook validation sandbox QA table');
    expect(sent).not.toContain('Secret body line');
  });

  it('serves repeat runs from the shell cache without calling Jev again', async () => {
    const uncooked = computeStaleness(snapshot).uncookedNotes;
    const calls: JevRequest[] = [];
    const transport = fakeTransport((request) => nouls(request, () => 0.5), calls);
    const cache = new Map<string, TriageScore>();

    await triageUncookedNotes(uncooked, { snapshot, readNote, transport, apiKey: 'k', cache });
    await triageUncookedNotes(uncooked, { snapshot, readNote, transport, apiKey: 'k', cache });
    expect(calls).toHaveLength(uncooked.length);
    expect([...cache.keys()]).toEqual(uncooked.map(cacheKey));
    expect(cacheKey({ path: 'a.md', mtimeMs: 5 })).toBe('a.md@5');
  });

  it('records per-note failures and keeps going', async () => {
    const uncooked = computeStaleness(snapshot).uncookedNotes;
    const transport: JevTransport = (_url, _headers, body) => {
      const request = JSON.parse(body) as JevRequest;
      const title = (request.state as { note: { title: string } }).note.title;
      if (title === 'Agenda') return Promise.resolve({ status: 500, text: '' });
      return Promise.resolve({ status: 200, text: JSON.stringify(nouls(request, () => 0.7)) });
    };
    const outcome = await triageUncookedNotes(uncooked, { snapshot, readNote, transport, apiKey: 'k' });
    expect(outcome.scores.map((s) => s.path)).toEqual(['notes/zipline-qa.md']);
    expect(outcome.failures).toEqual([{ path: 'notes/agenda.md', message: 'Jev returned HTTP 500.' }]);
  });

  it('caps the batch and reports what was not sent', async () => {
    const many = Array.from({ length: TRIAGE_CAP + 3 }, (_, i) => ({ path: `notes/n${i}.md`, title: `n${i}`, mtimeMs: i }));
    const transport = fakeTransport((request) => nouls(request, () => 0.5));
    const outcome = await triageUncookedNotes(many, { snapshot, readNote: () => Promise.resolve('x'), transport, apiKey: 'k' });
    expect(outcome.scores).toHaveLength(TRIAGE_CAP);
    expect(outcome.skipped).toBe(3);
  });
});

describe('buildTriagePrompt', () => {
  it('lists likely notes in rank order with targets, and unlikely ones last', () => {
    const prompt = buildTriagePrompt([
      { path: 'b.md', title: 'b', mtimeMs: 1, worth: 0.1, target: null, inputTokens: 0 },
      { path: 'a.md', title: 'a', mtimeMs: 1, worth: 0.9, target: { path: 'queries/x.md', title: 'x', score: 0.8 }, inputTokens: 0 },
      { path: 'c.md', title: 'c', mtimeMs: 1, worth: 0.6, target: null, inputTokens: 0 },
    ]);
    const lines = prompt.split('\n');
    const a = lines.findIndex((l) => l.includes('a.md'));
    const c = lines.findIndex((l) => l.includes('c.md'));
    const b = lines.findIndex((l) => l.includes('b.md'));
    expect(a).toBeLessThan(c);
    expect(c).toBeLessThan(b);
    expect(lines[a]).toContain('update queries/x.md');
    expect(lines[c]).toContain('new page');
    expect(prompt).toContain('Ranked unlikely');
  });
});
