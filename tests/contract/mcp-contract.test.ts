import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildMcpServer, MCP_PROMPT_SKILLS } from '../../src/core/mcp/server';
import { addKb } from '../../src/core/kb-registry';

/**
 * The 1.0 MCP contract (spec 1.0 f5, §4.2.2): the advertised protocol surface
 * is pinned against a committed golden snapshot. A failure here means you are
 * breaking the 1.0 stability contract; if the change is deliberate, run
 * `npm run contract:regen` and justify the golden diff in review.
 */

let workDir: string;
let client: Client;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'knowlery-mcpc-'));
  process.env.KNOWLERY_CONFIG_DIR = join(workDir, 'config');
  const server = buildMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  client = new Client({ name: 'contract', version: '0.0.0' });
  await client.connect(clientTransport);
});

afterEach(async () => {
  delete process.env.KNOWLERY_CONFIG_DIR;
  await client.close().catch(() => { /* closed */ });
  await rm(workDir, { recursive: true, force: true });
});

async function makeKb(name: string): Promise<string> {
  const dir = join(workDir, name);
  await mkdir(join(dir, 'concepts'), { recursive: true });
  await mkdir(join(dir, 'Projects'), { recursive: true });
  await writeFile(join(dir, 'KNOWLEDGE.md'), `# ${name}\n`);
  await writeFile(join(dir, 'concepts', 'signal.md'),
    '---\ntitle: Signal\ntype: concept\ncreated: 2026-01-01\n---\n\nSignals propagate.\n');
  await writeFile(join(dir, 'Projects', 'raw-note.md'),
    '---\ntitle: Raw Note\n---\n\nUncooked thinking.\n');
  await addKb(name, dir);
  return dir;
}

describe('the advertised surface matches the committed golden snapshot', () => {
  it('tools/list (names + full schemas), prompts, resource template', async () => {
    const golden = JSON.parse(
      readFileSync(join(__dirname, 'golden', 'mcp-contract.json'), 'utf8'),
    ) as { tools: unknown; prompts: string[]; resourceTemplates: string[] };

    const tools = await client.listTools();
    const live = tools.tools
      .map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema, outputSchema: tool.outputSchema }))
      .sort((a, b) => a.name.localeCompare(b.name));
    expect(live).toEqual(golden.tools);

    const prompts = await client.listPrompts();
    expect(prompts.prompts.map((prompt) => prompt.name).sort()).toEqual(golden.prompts);
    expect(golden.prompts).toEqual([...MCP_PROMPT_SKILLS].sort());

    const templates = await client.listResourceTemplates();
    expect(templates.resourceTemplates.map((template) => template.uriTemplate)).toEqual(golden.resourceTemplates);
    expect(golden.resourceTemplates).toEqual(['knowlery://{kb}/{+path}']);
  });
});

describe('structuredContent key sets are 1.0-frozen', () => {
  it('read tools carry exactly their frozen top-level keys', async () => {
    await makeKb('work');

    const kbs = await client.callTool({ name: 'list_kbs', arguments: {} });
    expect(Object.keys(kbs.structuredContent as object).sort()).toEqual(['kbs']);

    const query = await client.callTool({ name: 'query', arguments: { kb: 'work', question: 'signal' } });
    expect(Object.keys(query.structuredContent as object).sort()).toEqual(['candidates', 'verdict']);

    const federated = await client.callTool({ name: 'query', arguments: { kb: '*', question: 'signal' } });
    expect(Object.keys(federated.structuredContent as object).sort()).toEqual(['candidates', 'verdictByKb']);

    const stale = await client.callTool({ name: 'stale', arguments: { kb: 'work' } });
    expect(Object.keys(stale.structuredContent as object).sort()).toEqual(['stalePages', 'uncookedNotes']);

    const health = await client.callTool({ name: 'health', arguments: { kb: 'work' } });
    expect(Object.keys(health.structuredContent as object).sort()).toEqual(['config', 'healthy', 'knowledgePages']);

    const bundles = await client.callTool({ name: 'list_bundles', arguments: { kb: 'work' } });
    expect(Object.keys(bundles.structuredContent as object).sort()).toEqual(['bundles']);
  });

  it('findings are data: abstention, unhealthy, and stale-heavy come back as successes (semantics frozen)', async () => {
    await makeKb('work');

    const abstain = await client.callTool({ name: 'query', arguments: { kb: 'work', question: 'zebra quantum lighthouse' } });
    expect(abstain.isError).toBeFalsy();
    expect((abstain.structuredContent as { verdict: string }).verdict).toBe('no-confident-match');

    const health = await client.callTool({ name: 'health', arguments: { kb: 'work' } }); // bare KB: unhealthy
    expect(health.isError).toBeFalsy();
    expect((health.structuredContent as { healthy: boolean }).healthy).toBe(false);

    const stale = await client.callTool({ name: 'stale', arguments: { kb: 'work' } }); // uncooked note present
    expect(stale.isError).toBeFalsy();
    expect((stale.structuredContent as { uncookedNotes: unknown[] }).uncookedNotes.length).toBeGreaterThan(0);
  });
});
