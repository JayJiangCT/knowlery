import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildMcpServer } from '../../src/core/mcp/server';

/**
 * Regenerates the 1.0 contract golden files (spec 1.0 f5, §4.2.4).
 *
 * Run deliberately: `npm run contract:regen` — and only when a contract
 * change has been decided, not to make a red test green. A diff in the
 * golden files is a diff in the 1.0 promise.
 */
async function main(): Promise<void> {
  const configDir = await mkdtemp(join(tmpdir(), 'knowlery-regen-'));
  process.env.KNOWLERY_CONFIG_DIR = configDir;
  try {
    const server = buildMcpServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: 'contract-regen', version: '0.0.0' });
    await client.connect(clientTransport);

    const tools = await client.listTools();
    const prompts = await client.listPrompts();
    const templates = await client.listResourceTemplates();

    const snapshot = {
      tools: tools.tools
        .map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema, outputSchema: tool.outputSchema }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      prompts: prompts.prompts.map((prompt) => prompt.name).sort(),
      resourceTemplates: templates.resourceTemplates.map((template) => template.uriTemplate),
    };

    const goldenDir = join(__dirname, 'golden');
    await mkdir(goldenDir, { recursive: true });
    await writeFile(join(goldenDir, 'mcp-contract.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
    await client.close();
    process.stdout.write('Regenerated tests/contract/golden/mcp-contract.json\n');
    process.stdout.write('Review the diff: a change here is a change to the 1.0 promise.\n');
  } finally {
    delete process.env.KNOWLERY_CONFIG_DIR;
    await rm(configDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
