import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
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

async function connect(): Promise<Client> {
  const server = buildMcpServer();
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
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(
      ['health', 'list_bundles', 'list_kbs', 'query', 'stale'],
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
    expect(resources.resources.map((resource) => resource.uri)).toEqual(['knowlery://work/KNOWLEDGE.md']);

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
