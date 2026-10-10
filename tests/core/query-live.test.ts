import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { App } from 'obsidian';
import {
  buildPageFromContent,
  scanVault,
  type VaultSnapshot,
} from '../../src/core/query/scan';
import { runQuery } from '../../src/core/query/engine';
import { formatQueryResult } from '../../src/core/query/format';
import { LiveQuerySnapshot, type SnapshotTimers } from '../../src/core/query/live-snapshot';
import {
  QUERY_CLI_USAGE,
  QUERY_CLI_WARMING,
  handleQueryCli,
  handleStaleCli,
} from '../../src/core/query/cli-handler';
import { JEV_MODEL } from '../../src/core/jev/model';

const FIXTURE_VAULT = join(__dirname, '..', '..', 'evals', 'fixtures', 'vault');

const PAGE_A = `---
title: Widget Design
type: concept
created: 2026-01-01
tags: [design]
description: How widgets are designed.
---

Widgets are designed with care.
`;

const PAGE_B = `---
title: Daily Note
type: daily
date: 2026-01-02
---

Mentioned widgets in passing.
`;

/**
 * `files` may hold non-Markdown entries (e.g. a `package.json` project marker); they
 * show up in getFiles() but not getMarkdownFiles(), as in Obsidian. Folders are derived
 * from the file paths, since Obsidian has no empty folders worth indexing here.
 */
function stubApp(
  files: Record<string, string>,
  hidden: Record<string, string> = {},
): App {
  const asFile = (path: string) => ({ path, stat: { mtime: 1000 } });
  const folders = () => {
    const found = new Set<string>();
    for (const path of Object.keys(files)) {
      const segments = path.split('/');
      for (let i = 1; i < segments.length; i++) found.add(segments.slice(0, i).join('/'));
    }
    return [...found].map((path) => ({ path }));
  };
  return {
    vault: {
      getFiles: () => Object.keys(files).map(asFile),
      getMarkdownFiles: () => Object.keys(files).filter((path) => path.endsWith('.md')).map(asFile),
      getAllFolders: () => folders(),
      getFileByPath: (path: string) => (path in files ? asFile(path) : null),
      cachedRead: async (file: { path: string }) => files[file.path],
      adapter: {
        exists: async (path: string) => path in hidden,
        read: async (path: string) => hidden[path],
      },
    },
  } as unknown as App;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Node timers for tests — the plugin default uses window timers, absent under vitest. */
const nodeTimers: SnapshotTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (id) => clearTimeout(id as NodeJS.Timeout),
};

function makeLive(app: App, debounceMs: number): LiveQuerySnapshot {
  return new LiveQuerySnapshot(app, debounceMs, nodeTimers);
}

describe('transport parity (spec f5, §5.1/§5.2)', () => {
  it('buildPageFromContent produces exactly what the fs scanner produces', () => {
    const snapshot = scanVault(FIXTURE_VAULT);
    const path = 'concepts/response-time-metrics.md';
    const fsPage = snapshot.pages.find((page) => page.path === path);
    const livePage = buildPageFromContent(
      path,
      readFileSync(join(FIXTURE_VAULT, path), 'utf8'),
      // Obsidian's file.stat.mtime is whole milliseconds; node's statSync is fractional on APFS.
      Math.round(statSync(join(FIXTURE_VAULT, path)).mtimeMs),
    );
    expect(livePage).toEqual(fsPage);
  });

  it('both transports format identical output for the same snapshot', () => {
    const snapshot = scanVault(FIXTURE_VAULT);
    const question = 'What did we decide about response time metrics?';
    const scriptOutput = formatQueryResult(runQuery(question, snapshot, 12)).trimEnd();
    const handlerOutput = handleQueryCli({ question }, snapshot);
    expect(handlerOutput).toBe(scriptOutput);
  });
});

describe('handleQueryCli (spec f5, §5.3)', () => {
  const emptySnapshot: VaultSnapshot = { root: '', pages: [], bundleEntries: [] };

  it('returns a string synchronously — never a promise (microtask constraint, R4)', () => {
    const result: unknown = handleQueryCli({ question: 'widgets' }, emptySnapshot);
    expect(typeof result).toBe('string');
  });

  it('returns usage when question is missing or bare', () => {
    expect(handleQueryCli({}, emptySnapshot)).toBe(QUERY_CLI_USAGE);
    expect(handleQueryCli({ question: 'true' }, emptySnapshot)).toBe(QUERY_CLI_USAGE);
  });

  it('returns the warming message before the snapshot is ready', () => {
    expect(handleQueryCli({ question: 'widgets' }, null)).toBe(QUERY_CLI_WARMING);
  });

  it('honors k and json flags', () => {
    const snapshot = scanVault(FIXTURE_VAULT);
    const output = handleQueryCli({ question: 'pulseboard metrics', k: '2', json: 'true' }, snapshot);
    const parsed = JSON.parse(output) as { verdict: string; candidates: unknown[] };
    expect(parsed.verdict).toBe('ok');
    expect(parsed.candidates.length).toBeLessThanOrEqual(2);
  });
});

describe('LiveQuerySnapshot (spec f5, §5.2)', () => {
  it('is null before build and serves pages after', async () => {
    const live = makeLive(stubApp({ 'concepts/widget.md': PAGE_A }), 1);
    expect(live.snapshot()).toBeNull();
    await live.build();
    const snapshot = live.snapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.pages.map((page) => page.path)).toEqual(['concepts/widget.md']);
    expect(snapshot!.pages[0].tier).toBe('agent');
  });

  it('excludes system files (instruction docs, generated AGENTS.md, and the cook log)', async () => {
    const live = makeLive(
      stubApp({
        'KNOWLEDGE.md': '# guide',
        'SCHEMA.md': '# schema',
        'AGENTS.md': '# agents',
        'log.md': '# Cook Log\n\n| Date | Mode |',
        'Daily/note.md': PAGE_B,
      }),
      1,
    );
    await live.build();
    expect(live.snapshot()!.pages.map((page) => page.path)).toEqual(['Daily/note.md']);
  });

  it('applies debounced incremental updates on change', async () => {
    const files: Record<string, string> = { 'concepts/widget.md': PAGE_A };
    const live = makeLive(stubApp(files), 1);
    await live.build();

    files['concepts/widget.md'] = PAGE_A.replace('Widget Design', 'Gadget Design');
    live.scheduleRefresh('concepts/widget.md');
    live.scheduleRefresh('concepts/widget.md'); // coalesces with the previous call
    await sleep(15);

    expect(live.snapshot()!.pages[0].title).toBe('Gadget Design');
  });

  it('handles delete and rename', async () => {
    const files: Record<string, string> = {
      'concepts/widget.md': PAGE_A,
      'Daily/note.md': PAGE_B,
    };
    const live = makeLive(stubApp(files), 1);
    await live.build();

    live.handleDelete('Daily/note.md');
    expect(live.snapshot()!.pages.map((page) => page.path)).toEqual(['concepts/widget.md']);

    files['concepts/renamed.md'] = files['concepts/widget.md'];
    delete files['concepts/widget.md'];
    live.handleRename('concepts/widget.md', 'concepts/renamed.md');
    await sleep(15);
    expect(live.snapshot()!.pages.map((page) => page.path)).toEqual(['concepts/renamed.md']);
  });

  it('loads bundle entries from the hidden registry via the adapter', async () => {
    const live = makeLive(
      stubApp(
        { 'Daily/note.md': PAGE_B },
        {
          '.knowlery/bundles.json': JSON.stringify({
            schemaVersion: 1,
            bundles: { pack: { title: 'Pack', libraryPath: 'Library/pack' } },
          }),
          'Library/pack/agent-index.json': JSON.stringify({
            concepts: [{ path: 'concepts/thing.md', title: 'Thing', description: 'A thing.' }],
          }),
        },
      ),
      1,
    );
    await live.build();
    const snapshot = live.snapshot()!;
    expect(snapshot.bundleEntries).toHaveLength(1);
    expect(snapshot.bundleEntries[0].path).toBe('Library/pack/concepts/thing.md');
  });

  it('degrades a malformed reference config exactly like the fs scanner, and says why', async () => {
    const hidden: Record<string, string> = { '.knowlery/config.json': JSON.stringify({ referenceDirs: ['teams'] }) };
    const live = makeLive(stubApp({ 'teams/x.md': PAGE_B, 'Daily/note.md': PAGE_B }, hidden), 1);
    await live.build();
    expect(live.snapshot()!.referenceDirs).toEqual(['teams']);
    expect(live.snapshot()!.referenceConfigError).toBeUndefined();

    hidden['.knowlery/config.json'] = '{ not json';
    await live.refreshBundles();
    const degraded = live.snapshot()!;
    expect(degraded).not.toBeNull();
    expect(degraded.referenceDirs).toEqual([]);
    expect(degraded.referenceConfigError).toContain('not valid JSON');

    hidden['.knowlery/config.json'] = JSON.stringify({ referenceDirs: ['teams'] });
    await live.refreshBundles();
    expect(live.snapshot()!.referenceDirs).toEqual(['teams']);
    expect(live.snapshot()!.referenceConfigError).toBeUndefined();
  });
});

describe('LiveQuerySnapshot triage store (added 1.6.0)', () => {
  it('carries .knowlery/triage.json so obsidian knowlery:stale ranks like every other transport, and re-reads it on demand', async () => {
    const hidden: Record<string, string> = {};
    const live = makeLive(stubApp({ 'notes/a.md': PAGE_B, 'notes/b.md': PAGE_B }, hidden), 1);
    await live.build();
    expect(live.snapshot()!.triage).toBeUndefined();

    hidden['.knowlery/triage.json'] = JSON.stringify({
      schemaVersion: 1,
      model: JEV_MODEL,
      entries: { 'notes/b.md': { mtimeMs: 1000, worth: 0.9, target: null, scoredAt: '' } },
    });
    await live.refreshTriage();
    expect(live.snapshot()!.triage?.entries['notes/b.md'].worth).toBe(0.9);
    const report = JSON.parse(handleStaleCli({ json: 'true' }, live.snapshot())) as { uncookedNotes: Array<{ path: string; jev?: unknown }> };
    expect(report.uncookedNotes.map((n) => n.path)).toEqual(['notes/b.md', 'notes/a.md']);
    expect(report.uncookedNotes[0].jev).toEqual({ worth: 0.9, target: null });

    hidden['.knowlery/triage.json'] = '{ broken';
    await live.refreshBundles(); // the dashboard-refresh path also re-reads it
    expect(live.snapshot()!.triage?.entries).toEqual({});
  });
});

describe('LiveQuerySnapshot exclusions (parity with query/exclusions.ts)', () => {
  const paths = (live: LiveQuerySnapshot) => live.snapshot()!.pages.map((page) => page.path).sort();

  it('skips node_modules anywhere, and build output only beside a project manifest', async () => {
    const live = makeLive(
      stubApp({
        'Daily/note.md': PAGE_B,
        'projects/app/package.json': '{}',
        'projects/app/dist/README.md': PAGE_B,
        'projects/app/node_modules/dep/README.md': PAGE_B,
        'projects/app/src/notes.md': PAGE_B,
        'build/plan.md': PAGE_B, // a notes folder that happens to be called build/
      }),
      1,
    );
    await live.build();
    expect(paths(live)).toEqual(['Daily/note.md', 'build/plan.md', 'projects/app/src/notes.md']);
    expect(live.snapshot()!.ignoredDirs).toEqual([
      { path: 'projects/app/dist', reason: 'project-output' },
      { path: 'projects/app/node_modules', reason: 'builtin' },
    ]);
  });

  it('applies config ignoreDirs, drops pages when a dir is added and re-reads when removed', async () => {
    const hidden: Record<string, string> = {};
    const live = makeLive(stubApp({ 'archive/old.md': PAGE_B, 'Daily/note.md': PAGE_B }, hidden), 1);
    await live.build();
    expect(paths(live)).toEqual(['Daily/note.md', 'archive/old.md']);

    hidden['.knowlery/config.json'] = JSON.stringify({ ignoreDirs: ['archive'] });
    await live.refreshBundles();
    expect(paths(live)).toEqual(['Daily/note.md']);
    expect(live.snapshot()!.ignoreDirs).toEqual(['archive']);
    expect(live.snapshot()!.ignoredDirs).toEqual([{ path: 'archive', reason: 'config' }]);
    // Events for files under an ignored dir never resurrect them.
    await live.refreshFile('archive/old.md');
    expect(paths(live)).toEqual(['Daily/note.md']);

    hidden['.knowlery/config.json'] = JSON.stringify({ ignoreDirs: [] });
    await live.refreshBundles();
    expect(paths(live)).toEqual(['Daily/note.md', 'archive/old.md']);
  });

  it('re-judges sibling build output when a project manifest appears or disappears', async () => {
    const files: Record<string, string> = { 'proj/dist/out.md': PAGE_B, 'proj/src/in.md': PAGE_B };
    const live = makeLive(stubApp(files), 1);
    await live.build();
    expect(paths(live)).toEqual(['proj/dist/out.md', 'proj/src/in.md']);

    files['proj/package.json'] = '{}';
    await live.handleMarkerChange('proj/package.json');
    expect(paths(live)).toEqual(['proj/src/in.md']);

    delete files['proj/package.json'];
    await live.handleMarkerChange('proj/package.json');
    expect(paths(live)).toEqual(['proj/dist/out.md', 'proj/src/in.md']);

    // Non-marker files are a no-op, so vault events for ordinary notes cost nothing.
    await live.handleMarkerChange('proj/src/in.md');
    expect(paths(live)).toEqual(['proj/dist/out.md', 'proj/src/in.md']);
  });

  it('matches the fs scanner on the same tree, including the skipped-directory report', async () => {
    const files: Record<string, string> = {
      'Daily/note.md': PAGE_B,
      'build/plan.md': PAGE_B,
      'projects/app/package.json': '{}',
      'projects/app/dist/README.md': PAGE_B,
      'projects/app/dist/nested/deep.md': PAGE_B,
      'projects/app/node_modules/dep/README.md': PAGE_B,
      'projects/app/src/notes.md': PAGE_B,
      'archive/old.md': PAGE_B,
      'vendor/plain/notes.md': PAGE_B, // no manifest at the root → scanned
    };
    const hidden = { '.knowlery/config.json': JSON.stringify({ ignoreDirs: ['archive'] }) };
    const root = mkdtempSync(join(tmpdir(), 'knowlery-parity-'));
    try {
      for (const [path, content] of Object.entries({ ...files, ...hidden })) {
        mkdirSync(join(root, dirname(path)), { recursive: true });
        writeFileSync(join(root, path), content);
      }
      const fsSnapshot = scanVault(root);
      const live = makeLive(stubApp(files, hidden), 1);
      await live.build();
      const liveSnapshot = live.snapshot()!;

      expect(paths(live)).toEqual(fsSnapshot.pages.map((page) => page.path).sort());
      expect(liveSnapshot.ignoredDirs).toEqual(fsSnapshot.ignoredDirs);
      expect(liveSnapshot.ignoreDirs).toEqual(fsSnapshot.ignoreDirs);
      expect(fsSnapshot.ignoredDirs).toEqual([
        { path: 'archive', reason: 'config' },
        { path: 'projects/app/dist', reason: 'project-output' },
        { path: 'projects/app/node_modules', reason: 'builtin' },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
