import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
} from '../../src/core/query/cli-handler';

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

function stubApp(
  files: Record<string, string>,
  hidden: Record<string, string> = {},
): App {
  const asFile = (path: string) => ({ path, stat: { mtime: 1000 } });
  return {
    vault: {
      getMarkdownFiles: () => Object.keys(files).map(asFile),
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
      statSync(join(FIXTURE_VAULT, path)).mtimeMs,
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
    const parsed = JSON.parse(output);
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

  it('excludes system files (instruction docs and the cook log)', async () => {
    const live = makeLive(
      stubApp({
        'KNOWLEDGE.md': '# guide',
        'SCHEMA.md': '# schema',
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
});
