import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildOrientationMap, renderOrientationMap } from '../../src/core/query/orientation';
import { collectOrientationMap } from '../../src/core/orientation-source';
import { scanVault } from '../../src/core/query/scan';
import { runIndexCommand } from '../../src/cli/commands/index-map';
import { buildMcpServer } from '../../src/core/mcp/server';
import { addKb } from '../../src/core/kb-registry';

/**
 * Spec 1.2 f1, §5: the orientation map — a view, not a file. Purity by
 * injection, the browsing boundary, the tolerant bundle join, cross-rendering
 * parity, and zero writes proven by content hashes.
 */

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'knowlery-orient-'));
  process.env.KNOWLERY_CONFIG_DIR = join(workDir, 'config');
});

afterEach(async () => {
  delete process.env.KNOWLERY_CONFIG_DIR;
  await rm(workDir, { recursive: true, force: true });
});

async function makeKb(name: string): Promise<string> {
  const dir = join(workDir, name);
  for (const sub of ['entities', 'concepts', 'Projects', 'Daily']) {
    await mkdir(join(dir, sub), { recursive: true });
  }
  await writeFile(join(dir, 'KNOWLEDGE.md'), `# ${name} Knowledge Base\n`);
  await writeFile(join(dir, 'concepts', 'backpressure.md'),
    '---\ntitle: Backpressure\ntype: concept\ndomain: infra\ncreated: 2026-01-01\nupdated: 2026-06-01\ndescription: Queues protect ingest\n---\n\nBody.\n');
  await writeFile(join(dir, 'entities', 'zebra.md'),
    '---\ntitle: Zebra\ncreated: 2026-01-01\n---\n\nNo type frontmatter at all.\n');
  await writeFile(join(dir, 'Projects', 'raw.md'), '---\ntitle: Raw\n---\n\nUser note.\n');
  await writeFile(join(dir, 'Daily', '2026-07-10.md'), 'diary\n');
  return dir;
}

async function hashTree(dir: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = join(entry.parentPath ?? (entry as unknown as { path: string }).path, entry.name);
    out.set(full, createHash('sha256').update(await readFile(full)).digest('hex'));
  }
  return out;
}

describe('the pure core (§5.1)', () => {
  it('is a function of its inputs — grouping is by directory, totals add up', async () => {
    const dir = await makeKb('work');
    const snapshot = scanVault(dir);
    const inputs = { snapshot, bundles: [], kbName: 'work KB', generatedAt: '2026-07-10T00:00:00.000Z' };

    const first = buildOrientationMap(inputs);
    const second = buildOrientationMap(inputs);
    expect(second).toEqual(first); // same inputs, same map — no clock, no I/O

    // zebra.md has no frontmatter type; it still lands in entities by directory.
    const groups = Object.fromEntries(first.compiled.map((group) => [group.group, group.pages.length]));
    expect(groups).toEqual({ entities: 1, concepts: 1 });
    expect(first.counts.compiled).toBe(2); // equals the sum of the groups
    expect(first.counts.uncooked).toBe(2); // Projects/raw.md + Daily note — counted, never listed
    expect(JSON.stringify(first.compiled)).not.toContain('Projects/');

    const concept = first.compiled.find((group) => group.group === 'concepts')!.pages[0];
    expect(concept).toEqual({
      path: 'concepts/backpressure.md', title: 'Backpressure',
      description: 'Queues protect ingest', domain: 'infra', updated: '2026-06-01',
    });
  });
});

describe('view semantics and zero writes (§5.2)', () => {
  it('a change between two reads is reflected; content hashes prove nothing was written', async () => {
    const dir = await makeKb('work');

    const before = await hashTree(dir);
    const log1: string[] = [];
    await runIndexCommand(dir, { json: true, log: (line) => log1.push(line) });
    const map1 = JSON.parse(log1.join('\n')) as { counts: { compiled: number } };
    expect(map1.counts.compiled).toBe(2);

    await writeFile(join(dir, 'concepts', 'new-idea.md'),
      '---\ntitle: New Idea\ntype: concept\ncreated: 2026-07-10\n---\n\nBody.\n');

    const log2: string[] = [];
    await runIndexCommand(dir, { json: true, log: (line) => log2.push(line) });
    const map2 = JSON.parse(log2.join('\n')) as { counts: { compiled: number } };
    expect(map2.counts.compiled).toBe(3); // the view reflects the live vault

    const after = await hashTree(dir);
    const added = join(dir, 'concepts', 'new-idea.md');
    expect(after.size).toBe(before.size + 1);
    for (const [path, hash] of before) {
      expect(after.get(path), path).toBe(hash); // no overwrites either
    }
    expect(after.has(added)).toBe(true);
  });
});

describe('the bundle join (§5.4)', () => {
  it('joins the registry with each manifest; a missing manifest falls back, never blocks', async () => {
    const dir = await makeKb('work');
    await mkdir(join(dir, '.knowlery'), { recursive: true });
    await mkdir(join(dir, 'Library', 'good.pack'), { recursive: true });
    await mkdir(join(dir, 'Library', 'old.pack'), { recursive: true });
    await writeFile(join(dir, 'Library', 'good.pack', 'knowlery-bundle.json'), JSON.stringify({
      schemaVersion: 1, okfVersion: '0.1', id: 'good.pack', title: 'Good', version: '2.0.0',
      creator: { name: 'x', url: '' }, releasedAt: '2026-07-01T00:00:00.000Z',
      entrypoint: 'start-here.md', contentHash: 'sha256-x', license: 'personal',
      knowleryVersion: '1.1.0', conceptCount: 1,
    }));
    const entry = (id: string, title: string) => ({
      version: '1.0.0', title, source: 'local', installedAt: '2026-07-01T00:00:00.000Z',
      libraryPath: `Library/${id}`, manifestContentHash: 'sha256-a', installedContentHash: 'sha256-b',
      conformance: 'passed', conformanceErrorCount: 0,
    });
    await writeFile(join(dir, '.knowlery', 'bundles.json'), JSON.stringify({
      schemaVersion: 1,
      bundles: { 'good.pack': entry('good.pack', 'Good'), 'old.pack': entry('old.pack', 'Old — no manifest') },
    }));

    const map = await collectOrientationMap(dir, '2026-07-10T00:00:00.000Z');
    expect(map.kbName).toBe('work Knowledge Base');
    expect(map.bundles).toEqual([
      { id: 'good.pack', title: 'Good', version: '1.0.0', entrypoint: 'start-here.md' },
      { id: 'old.pack', title: 'Old — no manifest', version: '1.0.0', entrypoint: 'index.md' },
    ]);
    expect(map.counts.bundles).toBe(2);
  });
});

describe('cross-rendering parity and resource routing (§5.5, §5.6)', () => {
  let client: Client;

  afterEach(async () => {
    await client?.close().catch(() => { /* closed */ });
  });

  it('the MCP index resource and the CLI render from the same map; a real root index.md stays refused', async () => {
    const dir = await makeKb('work');
    await writeFile(join(dir, 'index.md'), 'a REAL user file named index.md\n');
    await addKb('work', dir);

    const server = buildMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'orient-test', version: '0.0.0' });
    await client.connect(clientTransport);

    const listed = await client.listResources();
    expect(listed.resources.map((resource) => resource.uri)).toEqual(
      ['knowlery://work/KNOWLEDGE.md', 'knowlery://work/index'],
    );

    const resource = await client.readResource({ uri: 'knowlery://work/index' });
    const text = (resource.contents[0] as { text: string }).text;
    expect(text).toContain('orientation map');
    expect(text).toContain('concepts/backpressure.md');
    expect(text).not.toContain('a REAL user file'); // the virtual view, not the file

    // Parity: the resource rendering equals renderOrientationMap over the
    // same collected map (timestamp aside — assert on the stable body).
    const map = await collectOrientationMap(dir, 'X');
    const stripStamp = (value: string) => value.split('\n').filter((line) => !line.startsWith('Generated ')).join('\n');
    expect(stripStamp(text)).toBe(stripStamp(renderOrientationMap(map, { markdown: true })));

    // The frozen boundary does not move: the real root index.md is refused.
    await expect(client.readResource({ uri: 'knowlery://work/index.md' }))
      .rejects.toThrow(/readable knowledge surface/);
  });
});
