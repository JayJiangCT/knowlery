import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { realpath, stat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startMcpHttpServer, tokenMatches } from '../../src/core/mcp/http-server';
import { resolveServeOptions } from '../../src/cli/commands/mcp';
import { CliError } from '../../src/cli/commands/shared';
import { addKb } from '../../src/core/kb-registry';
import type { McpAccess } from '../../src/core/mcp/server';

/**
 * Spec 1.0 f4, §5: remote mode over a real HTTP server on an ephemeral port.
 * The stdio suites (mcp-server.test.ts) prove the access default; this file
 * proves the HTTP shell: auth, structural flags, confinement, statelessness.
 */

const TOKEN = 'test-token-0123456789abcdef';

let workDir: string;
let server: Server | null = null;
const clients: Client[] = [];

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'knowlery-http-'));
  process.env.KNOWLERY_CONFIG_DIR = join(workDir, 'config');
});

afterEach(async () => {
  delete process.env.KNOWLERY_CONFIG_DIR;
  for (const client of clients.splice(0)) await client.close().catch(() => { /* closed */ });
  await stopServer();
  await rm(workDir, { recursive: true, force: true });
});

async function stopServer(): Promise<void> {
  if (!server) return;
  const closing = new Promise<void>((resolve) => server!.close(() => resolve()));
  server.closeAllConnections(); // keep-alive sockets would otherwise stall close()
  await closing;
  server = null;
}

async function makeKb(name: string): Promise<string> {
  const dir = join(workDir, name);
  await mkdir(join(dir, 'concepts'), { recursive: true });
  await writeFile(join(dir, 'KNOWLEDGE.md'), `# ${name}\n`);
  await writeFile(join(dir, 'concepts', 'backpressure.md'),
    '---\ntitle: Backpressure\ntype: concept\ncreated: 2026-01-01\n---\n\nQueues protect the ingest path.\n');
  return dir;
}

async function serve(access: McpAccess = {}): Promise<number> {
  server = await startMcpHttpServer({ port: 0, host: '127.0.0.1', token: TOKEN, access });
  return (server.address() as { port: number }).port;
}

async function connectHttp(port: number, token: string = TOKEN): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client({ name: 'http-test', version: '0.0.0' });
  await client.connect(transport);
  clients.push(client);
  return client;
}

describe('startup refusals (spec §5.2)', () => {
  const base = { allowCapture: false, allowSync: false, allowInit: false };
  const expectExit2 = async (args: Parameters<typeof resolveServeOptions>[0], env: Record<string, string | undefined>, pattern: RegExp) => {
    const error = await resolveServeOptions(args, env).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliError);
    expect((error as CliError).exitCode).toBe(2);
    expect((error as CliError).message).toMatch(pattern);
  };

  it('refuses missing port, missing/ambiguous/short tokens, and init without kb-root', async () => {
    await expectExit2({ ...base }, { KNOWLERY_MCP_TOKEN: TOKEN }, /--port/);
    await expectExit2({ ...base, port: 1234 }, {}, /No token configured/);
    await expectExit2({ ...base, port: 1234, tokenFile: '/x' }, { KNOWLERY_MCP_TOKEN: TOKEN }, /ambiguous/);
    await expectExit2({ ...base, port: 1234 }, { KNOWLERY_MCP_TOKEN: 'short' }, /too guessable/);
    await expectExit2({ ...base, port: 1234, allowInit: true }, { KNOWLERY_MCP_TOKEN: TOKEN }, /--kb-root/);
    await expectExit2({ ...base, port: 1234, allowInit: true, kbRoot: join(workDir, 'nope') }, { KNOWLERY_MCP_TOKEN: TOKEN }, /does not exist/);
    await expectExit2({ ...base, port: 1234, kbRoot: workDir }, { KNOWLERY_MCP_TOKEN: TOKEN }, /only makes sense/);
  });

  it('reads the token from a file and canonicalizes kb-root', async () => {
    const tokenFile = join(workDir, 'token');
    await writeFile(tokenFile, `${TOKEN}\n`);
    const kbRoot = join(workDir, 'kbs');
    await mkdir(kbRoot);
    const options = await resolveServeOptions(
      { ...base, port: 1234, tokenFile, allowInit: true, kbRoot },
      {},
    );
    expect(options.token).toBe(TOKEN);
    expect(options.access.init).toEqual({ kbRoot: await realpath(kbRoot) });
  });
});

describe('auth gate (spec §5.1, §5.8 hygiene)', () => {
  it('401 without or with a wrong token — no tool executes; correct token round-trips', async () => {
    await addKb('work', await makeKb('work'));
    const port = await serve();

    for (const headers of [{}, { Authorization: 'Bearer wrong-token-completely' }, { Authorization: 'NotBearer x' }]) {
      const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }),
      });
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain('Bearer');
      const body = await response.text();
      expect(body).toContain('Unauthorized');
      expect(body).not.toContain(TOKEN); // token hygiene: never echoed
    }

    const client = await connectHttp(port);
    const query = await client.callTool({ name: 'query', arguments: { kb: 'work', question: 'backpressure' } });
    expect((query.structuredContent as { candidates: Array<{ path: string }> }).candidates[0].path)
      .toBe('concepts/backpressure.md');

    const missing = await fetch(`http://127.0.0.1:${port}/other`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(missing.status).toBe(404);
  });

  it('tokenMatches is exact', () => {
    expect(tokenMatches(TOKEN, `Bearer ${TOKEN}`)).toBe(true);
    expect(tokenMatches(TOKEN, `Bearer ${TOKEN} `)).toBe(false);
    expect(tokenMatches(TOKEN, `Bearer ${TOKEN.slice(0, -1)}`)).toBe(false);
    expect(tokenMatches(TOKEN, undefined)).toBe(false);
    expect(tokenMatches(TOKEN, TOKEN)).toBe(false); // no Bearer prefix
  });
});

describe('structural access flags (spec §5.3)', () => {
  it('default is exactly the five read tools; a write call is unknown, and the disk shows it', async () => {
    const dir = await makeKb('work');
    await addKb('work', dir);
    const port = await serve();
    const client = await connectHttp(port);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual(
      ['health', 'list_bundles', 'list_kbs', 'query', 'stale'],
    );

    const write = await client.callTool({ name: 'capture', arguments: { kb: 'work', content: 'x' } });
    expect(write.isError).toBe(true);
    expect(JSON.stringify(write.content)).toMatch(/not found/i);
    expect(await readdir(dir)).not.toContain('inbox');
  });

  it('each flag registers exactly its tool; all three make eight', async () => {
    const kbRoot = join(workDir, 'kbs');
    await mkdir(kbRoot);

    const port1 = await serve({ capture: true, sync: false, init: false });
    const client1 = await connectHttp(port1);
    const tools1 = (await client1.listTools()).tools.map((tool) => tool.name).sort();
    expect(tools1).toContain('capture');
    expect(tools1).not.toContain('sync');
    expect(tools1).not.toContain('init_kb');
    await stopServer();

    const port2 = await serve({ capture: true, sync: true, init: { kbRoot } });
    const client2 = await connectHttp(port2);
    expect((await client2.listTools()).tools.map((tool) => tool.name).sort()).toEqual(
      ['capture', 'health', 'init_kb', 'list_bundles', 'list_kbs', 'query', 'stale', 'sync'],
    );
  });
});

describe('kb-root confinement (spec §5.4)', () => {
  it('init inside the root works; outside refused naming the root; the F3 contract reproduces over HTTP', async () => {
    const kbRoot = await realpath(await mkdtemp(join(tmpdir(), 'knowlery-kbroot-')));
    try {
      const port = await serve({ init: { kbRoot } });
      const client = await connectHttp(port);

      const inside = await client.callTool({
        name: 'init_kb',
        arguments: { name: 'confined', path: join(kbRoot, 'confined') },
      });
      expect(inside.isError).toBeFalsy();
      await stat(join(kbRoot, 'confined', 'KNOWLEDGE.md'));

      const outside = await client.callTool({
        name: 'init_kb',
        arguments: { name: 'escapee', path: join(workDir, 'escapee') },
      });
      expect(outside.isError).toBe(true);
      expect(JSON.stringify(outside.content)).toContain('--kb-root');

      // A representative F3 refusal through HTTP — same core, same message.
      const nonEmpty = await client.callTool({
        name: 'init_kb',
        arguments: { name: 'occupied', path: join(kbRoot, 'confined') },
      });
      expect(nonEmpty.isError).toBe(true);
      expect(JSON.stringify(nonEmpty.content)).toContain('not empty');
    } finally {
      await rm(kbRoot, { recursive: true, force: true });
    }
  });
});

describe('stateless lifecycle (spec §5.5, §5.6)', () => {
  it('sequential requests and two concurrent clients on one process — no message-ID interference', async () => {
    await addKb('work', await makeKb('work'));
    const port = await serve();

    // Sequential: the test that fails if one transport/server pair is reused.
    const first = await connectHttp(port);
    for (let i = 0; i < 3; i++) {
      const result = await first.callTool({ name: 'list_kbs', arguments: {} });
      expect((result.structuredContent as { kbs: Array<{ name: string }> }).kbs[0].name).toBe('work');
    }

    // Concurrent: two clients, interleaved round trips.
    const [a, b] = await Promise.all([connectHttp(port), connectHttp(port)]);
    const [ra, rb] = await Promise.all([
      a.callTool({ name: 'query', arguments: { kb: 'work', question: 'backpressure' } }),
      b.callTool({ name: 'query', arguments: { kb: 'work', question: 'backpressure' } }),
    ]);
    for (const result of [ra, rb]) {
      expect((result.structuredContent as { candidates: Array<{ path: string }> }).candidates[0].path)
        .toBe('concepts/backpressure.md');
    }
  });

  it('a restarted server answers identically — no session coupling', async () => {
    await addKb('work', await makeKb('work'));
    const port1 = await serve();
    const before = await (await connectHttp(port1)).callTool({ name: 'query', arguments: { kb: 'work', question: 'backpressure' } });
    await stopServer();

    const port2 = await serve();
    const after = await (await connectHttp(port2)).callTool({ name: 'query', arguments: { kb: 'work', question: 'backpressure' } });
    expect(after.structuredContent).toEqual(before.structuredContent);
  });
});
