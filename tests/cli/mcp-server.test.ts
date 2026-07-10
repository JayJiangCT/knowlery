import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmod, mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildMcpServer, MCP_PROMPT_SKILLS } from '../../src/core/mcp/server';
import { addKb } from '../../src/core/kb-registry';
import { runFederatedQuery } from '../../src/core/federated-query';
import { BUNDLED_SKILLS } from '../../src/assets/skills';

/**
 * Spec 1.0 f2, §5: protocol round trips over the SDK's in-memory transport —
 * no subprocesses. Each test gets an isolated registry via KNOWLERY_CONFIG_DIR.
 */

let workDir: string;
let client: Client;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'knowlery-mcp-'));
  process.env.KNOWLERY_CONFIG_DIR = join(workDir, 'config');
});

afterEach(async () => {
  delete process.env.KNOWLERY_CONFIG_DIR;
  await client?.close().catch(() => { /* already closed */ });
  await rm(workDir, { recursive: true, force: true });
});

async function makeKb(name: string): Promise<string> {
  const dir = join(workDir, name);
  await mkdir(join(dir, 'concepts'), { recursive: true });
  await mkdir(join(dir, 'Projects'), { recursive: true });
  await writeFile(join(dir, 'KNOWLEDGE.md'), `# ${name} KB\n`);
  await writeFile(join(dir, 'concepts', 'backpressure.md'),
    '---\ntitle: Backpressure\ntype: concept\ncreated: 2026-01-01\n---\n\nQueues protect the ingest path.\n');
  await writeFile(join(dir, 'Projects', 'secret-notes.md'),
    '---\ntitle: Secret Notes\n---\n\nRaw private thinking.\n');
  return dir;
}

async function connect(options: { toolVersion?: string } = {}): Promise<Client> {
  const server = buildMcpServer(options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const mcpClient = new Client({ name: 'test-client', version: '0.0.0' });
  await mcpClient.connect(clientTransport);
  return mcpClient;
}

describe('mcp tools (spec 1.0 f2, §5.1/§5.2/§5.4)', () => {
  it('lists exactly the five tools with schemas, and round-trips each happy path', async () => {
    const dir = await makeKb('work');
    await addKb('work', dir);
    client = await connect();

    const tools = await client.listTools();
    // 8 → 9 with register_kb — the sanctioned count update (spec 1.1 f1, §4.3).
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(
      ['capture', 'health', 'init_kb', 'list_bundles', 'list_kbs', 'query', 'register_kb', 'stale', 'sync'],
    );
    expect(tools.tools.every((tool) => tool.inputSchema)).toBe(true);

    const kbs = await client.callTool({ name: 'list_kbs', arguments: {} });
    expect((kbs.structuredContent as { kbs: Array<{ name: string }> }).kbs[0].name).toBe('work');

    const query = await client.callTool({ name: 'query', arguments: { kb: 'work', question: 'backpressure' } });
    const queryData = query.structuredContent as { verdict: string; candidates: Array<{ path: string }> };
    expect(queryData.verdict).toBe('ok');
    expect(queryData.candidates[0].path).toBe('concepts/backpressure.md');

    const stale = await client.callTool({ name: 'stale', arguments: { kb: 'work' } });
    expect(stale.structuredContent).toHaveProperty('stalePages');
    expect(stale.structuredContent).toHaveProperty('uncookedNotes');

    const bundles = await client.callTool({ name: 'list_bundles', arguments: { kb: 'work' } });
    expect(bundles.structuredContent).toEqual({ bundles: {} });
  });

  it('findings are data: unhealthy health and abstaining query are successful results (§5.4)', async () => {
    const dir = await makeKb('bare'); // no skills/config — unhealthy by construction
    await addKb('bare', dir);
    client = await connect();

    const health = await client.callTool({ name: 'health', arguments: { kb: 'bare' } });
    expect(health.isError).toBeFalsy();
    expect((health.structuredContent as { healthy: boolean }).healthy).toBe(false);

    const abstain = await client.callTool({ name: 'query', arguments: { kb: 'bare', question: 'zebra quantum lighthouse' } });
    expect(abstain.isError).toBeFalsy();
    expect((abstain.structuredContent as { verdict: string }).verdict).toBe('no-confident-match');
  });

  it('broken calls are errors: unknown kb lists registered names; malformed input rejected (§5.2)', async () => {
    await addKb('work', await makeKb('work'));
    client = await connect();

    const unknown = await client.callTool({ name: 'query', arguments: { kb: 'nope', question: 'x' } });
    expect(unknown.isError).toBe(true);
    expect(JSON.stringify(unknown.content)).toContain('Registered: work');

    const malformed = await client.callTool({ name: 'query', arguments: { kb: 'work' } }); // missing question
    expect(malformed.isError).toBe(true);

    // Unknown fields are rejected, not silently stripped (spec §4.1 — the SDK's
    // default normalization strips; the strict wrapper in defineTool rejects).
    const extraField = await client.callTool({
      name: 'query',
      arguments: { kb: 'work', question: 'backpressure', unexpected: 'boom' },
    });
    expect(extraField.isError).toBe(true);
    expect(JSON.stringify(extraField.content)).toContain('unexpected');
  });

  it('federated query via MCP matches the shared core (§5.6)', async () => {
    const alpha = await makeKb('alpha');
    await addKb('alpha', alpha);
    const beta = join(workDir, 'beta');
    await mkdir(join(beta, 'concepts'), { recursive: true });
    await writeFile(join(beta, 'KNOWLEDGE.md'), '# beta\n');
    await writeFile(join(beta, 'concepts', 'gardening.md'),
      '---\ntitle: Gardening\ntype: concept\ncreated: 2026-01-01\n---\n\nCompost.\n');
    await addKb('beta', beta);
    client = await connect();

    const viaMcp = await client.callTool({ name: 'query', arguments: { kb: '*', question: 'backpressure' } });
    const viaCore = await runFederatedQuery('backpressure', 12);
    const mcpData = viaMcp.structuredContent as { verdictByKb: Record<string, string>; candidates: Array<{ kb: string; path: string }> };
    expect(mcpData.verdictByKb).toEqual(viaCore.verdictByKb);
    expect(mcpData.candidates.map((c) => `${c.kb}:${c.path}`))
      .toEqual(viaCore.candidates.map((c) => `${c.kb}:${c.path}`));
    expect(mcpData.candidates[0].kb).toBe('alpha');
  });
});

describe('mcp write path (spec 1.0 f3, §5)', () => {
  it('capture round trip: inbox note, verbatim content, then uncooked in stale and findable by query (§5.1)', async () => {
    const dir = await makeKb('work');
    await addKb('work', dir);
    client = await connect();

    const capture = await client.callTool({
      name: 'capture',
      arguments: { kb: 'work', content: 'Quasar beacon rotation happens nightly.', title: 'Quasar beacon' },
    });
    expect(capture.isError).toBeFalsy();
    const captured = capture.structuredContent as { path: string; title: string };
    expect(captured.path).toMatch(/^inbox\/\d{4}-\d{2}-\d{2}-\d{6}-quasar-beacon\.md$/);
    expect(captured.title).toBe('Quasar beacon');

    const written = await readFile(join(dir, captured.path), 'utf8');
    expect(written).toContain('Quasar beacon rotation happens nightly.');
    expect(written).toContain('source: conversation');

    const stale = await client.callTool({ name: 'stale', arguments: { kb: 'work' } });
    const staleData = stale.structuredContent as { uncookedNotes: Array<{ path: string }> };
    expect(staleData.uncookedNotes.map((note) => note.path)).toContain(captured.path);

    const found = await client.callTool({ name: 'query', arguments: { kb: 'work', question: 'quasar beacon rotation' } });
    const foundData = found.structuredContent as { candidates: Array<{ path: string }> };
    expect(foundData.candidates[0].path).toBe(captured.path);
  });

  it('capture is sealed: hostile titles slug inside inbox/, collisions suffix, bad input errors (§5.2)', async () => {
    const dir = await makeKb('work');
    await addKb('work', dir);
    client = await connect();

    const hostile = await client.callTool({
      name: 'capture',
      arguments: { kb: 'work', content: 'x', title: '../../etc/passwd' },
    });
    const hostilePath = (hostile.structuredContent as { path: string }).path;
    expect(hostilePath).toMatch(/^inbox\/\d{4}-\d{2}-\d{2}-\d{6}-etc-passwd\.md$/);
    await stat(join(dir, hostilePath)); // really inside the KB's inbox

    const first = await client.callTool({ name: 'capture', arguments: { kb: 'work', content: 'a', title: 'Same' } });
    const second = await client.callTool({ name: 'capture', arguments: { kb: 'work', content: 'b', title: 'Same' } });
    const firstPath = (first.structuredContent as { path: string }).path;
    const secondPath = (second.structuredContent as { path: string }).path;
    expect(secondPath).not.toBe(firstPath);
    expect(await readFile(join(dir, firstPath), 'utf8')).toContain('a');
    expect(await readFile(join(dir, secondPath), 'utf8')).toContain('b');

    // A symlinked inbox/ (-> a compiled dir, or -> outside the KB) is refused —
    // capture appends only to a *real* inbox (maintainer P1 at implementation review).
    const linkedDir = await mkdtemp(join(tmpdir(), 'knowlery-linked-'));
    try {
      for (const linkTarget of [join(dir, 'concepts'), linkedDir]) {
        await rm(join(dir, 'inbox'), { recursive: true, force: true });
        await symlink(linkTarget, join(dir, 'inbox'));
        const viaLink = await client.callTool({ name: 'capture', arguments: { kb: 'work', content: 'x', title: 'Escapee' } });
        expect(viaLink.isError).toBe(true);
        expect(JSON.stringify(viaLink.content)).toContain('symlink');
      }
    } finally {
      await rm(join(dir, 'inbox'), { recursive: true, force: true });
      await rm(linkedDir, { recursive: true, force: true });
    }

    const empty = await client.callTool({ name: 'capture', arguments: { kb: 'work', content: '   ' } });
    expect(empty.isError).toBe(true);
    const star = await client.callTool({ name: 'capture', arguments: { kb: '*', content: 'x' } });
    expect(star.isError).toBe(true);
    const unknown = await client.callTool({ name: 'capture', arguments: { kb: 'nope', content: 'x' } });
    expect(unknown.isError).toBe(true);
    expect(JSON.stringify(unknown.content)).toContain('Registered: work');
  });

  it('init_kb happy path: scaffold + registration, immediately serving on the same session (§5.3)', async () => {
    client = await connect();

    const target = join(workDir, 'fresh-kb');
    const init = await client.callTool({
      name: 'init_kb',
      arguments: { name: 'fresh', path: target, platform: 'claude-code' },
    });
    expect(init.isError).toBeFalsy();
    const initData = init.structuredContent as { name: string; path: string };
    expect(initData.name).toBe('fresh');

    await stat(join(target, 'KNOWLEDGE.md'));
    await stat(join(target, '.knowlery', 'manifest.json'));

    const kbs = await client.callTool({ name: 'list_kbs', arguments: {} });
    expect((kbs.structuredContent as { kbs: Array<{ name: string; state: string }> }).kbs)
      .toContainEqual(expect.objectContaining({ name: 'fresh', state: 'ok' }));

    const health = await client.callTool({ name: 'health', arguments: { kb: 'fresh' } });
    expect((health.structuredContent as { healthy: boolean }).healthy).toBe(true);
  });

  it('init_kb path contract: parent rules, emptiness, nesting, symlinks, duplicate name (§5.4)', async () => {
    const dir = await makeKb('work');
    await addKb('work', dir);
    client = await connect();

    const refused = async (name: string, path: string, pattern: RegExp) => {
      const result = await client.callTool({ name: 'init_kb', arguments: { name, path } });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toMatch(pattern);
    };

    await refused('a1', join(workDir, 'no-such-parent', 'kb'), /Parent directory does not exist/);
    await refused('a2', join(workDir, 'two', 'levels'), /Parent directory does not exist/);
    await refused('a3', dir, /not empty/);
    await refused('a4', join(dir, 'concepts', 'nested-kb'), /inside the registered KB .*work/);
    await refused('work', join(workDir, 'whatever'), /already registered/);
    // Duplicate name is checked before any write: target untouched.
    expect(await stat(join(workDir, 'whatever')).catch(() => null)).toBeNull();

    // A missing leaf under a symlinked parent resolves through the parent's
    // realpath — created at the real location, prefix checks see it (P1 fix).
    const realParent = join(workDir, 'real-parent');
    await mkdir(realParent);
    await symlink(realParent, join(workDir, 'link-parent'));
    const viaLink = await client.callTool({
      name: 'init_kb',
      arguments: { name: 'via-link', path: join(workDir, 'link-parent', 'linked-kb') },
    });
    expect(viaLink.isError).toBeFalsy();
    const realResolved = (viaLink.structuredContent as { path: string }).path;
    expect(realResolved).toBe(await realpath(join(realParent, 'linked-kb')));
    expect(realResolved).toContain('real-parent');

    // An existing target that is itself a symlink is refused.
    const elsewhere = join(workDir, 'elsewhere');
    await mkdir(elsewhere);
    await symlink(elsewhere, join(workDir, 'sym-target'));
    await refused('a5', join(workDir, 'sym-target'), /symlink/);
  });

  it('init_kb cleanup: newly-created target removed entirely; pre-existing empty target left standing (§5.5)', async () => {
    client = await connect();
    // Make the config dir unwritable so registration (addKb) fails after scaffold.
    const configDir = process.env.KNOWLERY_CONFIG_DIR!;
    await mkdir(configDir, { recursive: true });
    await chmod(configDir, 0o500);

    try {
      const created = join(workDir, 'born-here');
      const failCreated = await client.callTool({ name: 'init_kb', arguments: { name: 'doomed1', path: created } });
      expect(failCreated.isError).toBe(true);
      expect(await stat(created).catch(() => null)).toBeNull(); // removed entirely

      const preExisting = join(workDir, 'was-here');
      await mkdir(preExisting);
      const failPre = await client.callTool({ name: 'init_kb', arguments: { name: 'doomed2', path: preExisting } });
      expect(failPre.isError).toBe(true);
      const after = await stat(preExisting).catch(() => null);
      expect(after?.isDirectory()).toBe(true); // the user's directory survives
      expect(await readdir(preExisting)).toEqual([]); // only this run's writes rolled back
    } finally {
      await chmod(configDir, 0o700);
    }
  });

  it('sync semantics: idempotent no-change data, restores a deleted skill, downgrade is a tool error (§5.6)', async () => {
    client = await connect({ toolVersion: '1.0.0' });
    const target = join(workDir, 'synced');
    await client.callTool({ name: 'init_kb', arguments: { name: 'synced', path: target } });

    // The first sync may stamp lastSyncedBy into the manifest; from then on, no changes — twice.
    await client.callTool({ name: 'sync', arguments: { kb: 'synced' } });
    const first = await client.callTool({ name: 'sync', arguments: { kb: 'synced' } });
    const second = await client.callTool({ name: 'sync', arguments: { kb: 'synced' } });
    expect((first.structuredContent as { updated: string[] }).updated).toEqual([]);
    expect((second.structuredContent as { updated: string[] }).updated).toEqual([]);

    await rm(join(target, '.claude', 'skills', 'ask', 'SKILL.md'));
    const restore = await client.callTool({ name: 'sync', arguments: { kb: 'synced' } });
    const restored = (restore.structuredContent as { updated: string[] }).updated;
    expect(restored.some((path) => path.includes('ask'))).toBe(true);
    await stat(join(target, '.claude', 'skills', 'ask', 'SKILL.md'));

    // Downgrade guard: a manifest marked by a newer version → tool error (spec §4.4).
    const manifestPath = join(target, '.knowlery', 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>;
    manifest.lastSyncedBy = '99.0.0';
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    const downgrade = await client.callTool({ name: 'sync', arguments: { kb: 'synced' } });
    expect(downgrade.isError).toBe(true);
    expect(JSON.stringify(downgrade.content)).toContain('newer Knowlery');
  });
});

describe('register_kb (spec 1.1 f1, §5)', () => {
  it('registers an initialized KB; immediately queryable by name on the same session (§5.1)', async () => {
    const dir = await makeKb('work'); // has KNOWLEDGE.md → initialized
    client = await connect();

    const registered = await client.callTool({ name: 'register_kb', arguments: { name: 'work', path: dir } });
    expect(registered.isError).toBeFalsy();
    const data = registered.structuredContent as { name: string; path: string; alsoRegisteredAs: string[] };
    expect(data.name).toBe('work');
    expect(data.path).toBe(await realpath(dir));
    expect(data.alsoRegisteredAs).toEqual([]);

    const kbs = await client.callTool({ name: 'list_kbs', arguments: {} });
    expect((kbs.structuredContent as { kbs: Array<{ name: string; state: string }> }).kbs)
      .toContainEqual(expect.objectContaining({ name: 'work', state: 'ok' }));

    const query = await client.callTool({ name: 'query', arguments: { kb: 'work', question: 'backpressure' } });
    expect((query.structuredContent as { candidates: Array<{ path: string }> }).candidates[0].path)
      .toBe('concepts/backpressure.md');
  });

  it('refusals: missing path, uninitialized dir (both fix-it routes), duplicate name, bad grammar (§5.2)', async () => {
    const dir = await makeKb('work');
    await addKb('work', dir);
    client = await connect();

    const missing = await client.callTool({ name: 'register_kb', arguments: { name: 'a1', path: join(workDir, 'nope') } });
    expect(missing.isError).toBe(true);

    const plainDir = join(workDir, 'plain');
    await mkdir(plainDir);
    const uninit = await client.callTool({ name: 'register_kb', arguments: { name: 'a2', path: plainDir } });
    expect(uninit.isError).toBe(true);
    const uninitText = JSON.stringify(uninit.content);
    expect(uninitText).toContain('init_kb');
    expect(uninitText).toContain('knowlery init');

    const registryBefore = await readFile(join(workDir, 'config', 'registry.json'), 'utf8');
    const duplicate = await client.callTool({ name: 'register_kb', arguments: { name: 'work', path: plainDir } });
    expect(duplicate.isError).toBe(true);
    expect(JSON.stringify(duplicate.content)).toContain('already registered');
    expect(await readFile(join(workDir, 'config', 'registry.json'), 'utf8')).toBe(registryBefore); // untouched

    const badName = await client.callTool({ name: 'register_kb', arguments: { name: 'Work KB', path: dir } });
    expect(badName.isError).toBe(true);
  });

  it('writes the registry only; a symlinked path registers its realpath; alsoRegisteredAs is data (§5.3, §5.4)', async () => {
    const dir = await makeKb('work');
    client = await connect();

    const before = (await readdir(dir, { recursive: true })).sort();
    await client.callTool({ name: 'register_kb', arguments: { name: 'first', path: dir } });
    expect((await readdir(dir, { recursive: true })).sort()).toEqual(before); // nothing created or touched

    await symlink(dir, join(workDir, 'link-to-kb'));
    const viaLink = await client.callTool({ name: 'register_kb', arguments: { name: 'second', path: join(workDir, 'link-to-kb') } });
    const linkData = viaLink.structuredContent as { path: string; alsoRegisteredAs: string[] };
    expect(linkData.path).toBe(await realpath(dir)); // canonicalized through addKb
    expect(linkData.alsoRegisteredAs).toEqual(['first']);
  });
});

describe('mcp prompts (spec 1.0 f2, §5.5)', () => {
  it('exposes exactly the curated set, each matching the bundled skill', async () => {
    await addKb('work', await makeKb('work'));
    client = await connect();

    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name).sort()).toEqual([...MCP_PROMPT_SKILLS].sort());

    const ask = await client.getPrompt({ name: 'ask', arguments: {} });
    const skill = BUNDLED_SKILLS.find((entry) => entry.name === 'ask')!;
    const first = ask.messages[0].content;
    expect(first.type).toBe('text');
    expect((first as { text: string }).text).toBe(skill.content);
  });
});

describe('mcp resources (spec 1.0 f2, §5.3)', () => {
  it('resources/list carries per-KB entry points; templates/list carries the template — separately', async () => {
    await addKb('work', await makeKb('work'));
    client = await connect();

    const resources = await client.listResources();
    // Two bounded entries per KB since 1.2 f1 — the sanctioned count update (spec 1.2 f1, §4.4).
    expect(resources.resources.map((resource) => resource.uri)).toEqual(
      ['knowlery://work/KNOWLEDGE.md', 'knowlery://work/index'],
    );

    const templates = await client.listResourceTemplates();
    expect(templates.resourceTemplates).toHaveLength(1);
    expect(templates.resourceTemplates[0].uriTemplate).toBe('knowlery://{kb}/{+path}');
  });

  it('reads compiled pages verbatim; refuses user-tier notes with the boundary explanation', async () => {
    const dir = await makeKb('work');
    await addKb('work', dir);
    client = await connect();

    const page = await client.readResource({ uri: 'knowlery://work/concepts/backpressure.md' });
    expect((page.contents[0] as { text: string }).text).toContain('Queues protect the ingest path.');

    const entry = await client.readResource({ uri: 'knowlery://work/KNOWLEDGE.md' });
    expect((entry.contents[0] as { text: string }).text).toContain('# work KB');

    // The asymmetry: query can surface this note, but reading it is out of bounds.
    await expect(client.readResource({ uri: 'knowlery://work/Projects/secret-notes.md' }))
      .rejects.toThrow(/readable knowledge surface|\/cook/);
  });

  it('refuses traversal and symlink escapes (§5.3)', async () => {
    const dir = await makeKb('work');
    await writeFile(join(workDir, 'outside.md'), 'outside the kb');
    await symlink(join(workDir, 'outside.md'), join(dir, 'concepts', 'escape.md'));
    await addKb('work', dir);
    client = await connect();

    await expect(client.readResource({ uri: 'knowlery://work/concepts/../../outside.md' }))
      .rejects.toThrow();
    await expect(client.readResource({ uri: 'knowlery://work/concepts/escape.md' }))
      .rejects.toThrow(/escapes the knowledge base root/);
  });
});
