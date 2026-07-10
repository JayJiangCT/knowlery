import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, POSITIONAL_LIMITS } from '../../src/cli/args';
import { CliError } from '../../src/cli/commands/shared';
import { nodeVaultFs } from '../../src/platform/node-fs';
import { runInit } from '../../src/cli/commands/init';
import { runHealth, buildHealthReport } from '../../src/cli/commands/health';
import { runQueryCommand, runFederatedQueryCommand } from '../../src/cli/commands/query';
import { runStaleCommand } from '../../src/cli/commands/stale';
import { runKbCommand } from '../../src/cli/commands/kb';
import { runBundleCommand } from '../../src/cli/commands/bundle';
import { addKb } from '../../src/core/kb-registry';

/**
 * The 1.0 CLI contract (spec 1.0 f5, §4.2.1). These tests pin the frozen
 * surface: commands, arities, flags, --json key sets, and exit-code classes.
 * A failure here means you are breaking the 1.0 stability contract — that
 * requires a major version, not a test update.
 */

describe('commands and arities are 1.0-frozen', () => {
  it('the command set and positional limits', () => {
    expect(POSITIONAL_LIMITS).toEqual({
      init: 0,
      kb: 3,
      mcp: 1,
      sync: 0,
      health: 0,
      query: 1,
      stale: 0,
      index: 0,  // added 1.2.0 — additive, sanctioned (spec 1.2 f1, §4.4)
      bundle: 2,
    });
  });
});

describe('flags are 1.0-frozen', () => {
  // Every flag shipped in 1.0, proven accepted by the real parser. Removing
  // or renaming any is a major version; new flags may be added freely.
  const FROZEN_FLAGS: Record<string, string[]> = {
    '--dir': ['x'], '--kb': ['x'], '--platform': ['claude-code'], '--name': ['n'],
    '--k': ['5'], '--hops': ['2'], '--creator': ['c'], '--bundle-version': ['1.0.0'],
    '--verify': ['abc'], '--repo': ['o/r'], '--port': ['8787'], '--host': ['127.0.0.1'],
    '--kb-root': ['x'], '--token-file': ['x'], '--approve': ['a'], '--flag': ['a'],
    '--public': [], '--all': [], '--acknowledge-risks': [], '--allow-capture': [],
    '--allow-sync': [], '--allow-init': [], '--zip': [], '--list': [], '--force': [],
    '--skip-conformance': [], '--json': [], '--version': [], '--help': [],
  };

  it('every 1.0 flag parses; an unknown flag is a usage error (exit 2)', () => {
    for (const [flag, value] of Object.entries(FROZEN_FLAGS)) {
      expect(() => parseArgs(['query', 'q', flag, ...value]), flag).not.toThrow();
    }
    expect(() => parseArgs(['query', '--no-such-flag'])).toThrow(CliError);
    try {
      parseArgs(['query', '--no-such-flag']);
    } catch (error) {
      expect((error as CliError).exitCode).toBe(2);
    }
  });

  it('exit-code classes: 1 operational (default), 2 usage (explicit)', () => {
    expect(new CliError('operational').exitCode).toBe(1);
    expect(new CliError('usage', 2).exitCode).toBe(2);
  });
});

describe('--json key sets are 1.0-frozen', () => {
  let workDir: string;
  let root: string;
  const jsonOf = (lines: string[]) => JSON.parse(lines.join('\n')) as Record<string, unknown>;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'knowlery-contract-'));
    process.env.KNOWLERY_CONFIG_DIR = join(workDir, 'config');
    root = join(workDir, 'kb');
    await runInit(nodeVaultFs(root), {
      platform: 'claude-code', name: 'Contract KB', prompt: null, log: () => { /* quiet */ },
    });
    await writeFile(join(root, 'concepts', 'signal.md'),
      '---\ntitle: Signal\ntype: concept\ncreated: 2026-01-01\n---\n\nSignals propagate.\n');
    await addKb('contract', root);
  });

  afterAll(async () => {
    delete process.env.KNOWLERY_CONFIG_DIR;
    await rm(workDir, { recursive: true, force: true });
  });

  it('query / federated query', async () => {
    const single: string[] = [];
    runQueryCommand(root, { question: 'signal', json: true, log: (l) => single.push(l) });
    expect(Object.keys(jsonOf(single)).sort()).toEqual(['candidates', 'terms', 'verdict']);
    const candidate = (jsonOf(single).candidates as Array<Record<string, unknown>>)[0];
    expect(Object.keys(candidate).sort()).toEqual(
      ['description', 'evidence', 'matchedTerms', 'path', 'score', 'tier', 'title', 'type'].filter(
        (key) => key in candidate,
      ),
    );
    for (const key of ['path', 'score', 'tier', 'title', 'evidence', 'matchedTerms']) {
      expect(candidate).toHaveProperty(key);
    }

    const federated: string[] = [];
    await runFederatedQueryCommand({ question: 'signal', json: true, log: (l) => federated.push(l) });
    expect(Object.keys(jsonOf(federated)).sort()).toEqual(['candidates', 'question', 'verdictByKb']);
  });

  it('index (added 1.2.0)', async () => {
    const { runIndexCommand } = await import('../../src/cli/commands/index-map');
    const lines: string[] = [];
    await runIndexCommand(root, { json: true, log: (l) => lines.push(l) });
    const map = jsonOf(lines);
    expect(Object.keys(map).sort()).toEqual(['bundles', 'compiled', 'counts', 'generatedAt', 'kbName']);
    expect(Object.keys(map.counts as object).sort()).toEqual(['bundles', 'compiled', 'stale', 'uncooked']);
  });

  it('stale / health / kb list / bundle list', async () => {
    const stale: string[] = [];
    runStaleCommand(root, { json: true, log: (l) => stale.push(l) });
    expect(Object.keys(jsonOf(stale)).sort()).toEqual(['danglingSources', 'stalePages', 'uncookedNotes']);

    const health = await buildHealthReport(nodeVaultFs(root), root);
    expect(Object.keys(health).sort()).toEqual(['config', 'healthy', 'knowledgePages']);
    const healthLines: string[] = [];
    await runHealth(nodeVaultFs(root), { root, json: true, log: (l) => healthLines.push(l) });
    expect(Object.keys(jsonOf(healthLines)).sort()).toEqual(['config', 'healthy', 'knowledgePages']);

    const kbList: string[] = [];
    await runKbCommand({ sub: 'list', json: true, log: (l) => kbList.push(l) });
    const kbListJson = jsonOf(kbList) as { registry: string; kbs: Array<Record<string, unknown>> };
    expect(Object.keys(kbListJson).sort()).toEqual(['kbs', 'registry']);
    expect(Object.keys(kbListJson.kbs[0]).sort()).toEqual(['name', 'path', 'state']);

    const bundles: string[] = [];
    await runBundleCommand(nodeVaultFs(root), { sub: 'list', root, json: true, log: (l) => bundles.push(l) });
    expect(Object.keys(jsonOf(bundles)).sort()).toEqual(['bundles', 'schemaVersion']);
  });
});
