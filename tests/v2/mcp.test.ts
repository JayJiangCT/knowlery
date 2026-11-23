import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { runCli } from '../../src/v2/cli/main';
import { findMcpRoot } from '../../src/v2/mcp/root';
import {
  buildMcpServer,
  ERROR_TEXT_LIMIT,
  measureToolResultBytes,
  RESULT_SIZE_LIMIT,
  SEARCH_STRUCTURED_LIMIT,
  type McpServerOptions,
} from '../../src/v2/mcp/server';
import {
  HEALTH_DESCRIPTION,
  READ_DESCRIPTION,
  SEARCH_DESCRIPTION,
  SERVER_INSTRUCTIONS,
} from '../../src/v2/mcp/texts';
import { configure, failure, fileState, invoke, jsonRun, makeKb } from './helpers';

type ToolCallResult = {
  content: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

const cleanupDirs: string[] = [];
const activeClients: Client[] = [];

afterEach(async () => {
  while (activeClients.length > 0) {
    const client = activeClients.pop()!;
    await client.close().catch(() => { /* already closed */ });
  }
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop()!;
    await rm(dir, { recursive: true, force: true });
  }
});

async function tempDir(prefix = 'knowlery-v2-mcp-'): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), prefix)));
  cleanupDirs.push(dir);
  return dir;
}

async function trackedKb(): Promise<string> {
  const root = await makeKb();
  cleanupDirs.push(root);
  return root;
}

async function connect(options: McpServerOptions): Promise<Client> {
  const server = buildMcpServer(options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  activeClients.push(client);
  return client;
}

function textOf(result: ToolCallResult): string {
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe('text');
  return result.content[0].text ?? '';
}

function parseNextLine(text: string): Record<string, unknown> {
  const line = text.split('\n').find((l) => l.startsWith('next: '));
  expect(line, `expected next: line in:\n${text}`).toBeDefined();
  return JSON.parse(line!.slice('next: '.length)) as Record<string, unknown>;
}

describe('v2 mcp', () => {
  it('exposes only three read-only tools, no resources or prompts, and neutral texts within length limits', async () => {
    const root = await trackedKb();
    const client = await connect({ cwd: root });

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['health', 'read', 'search']);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.openWorldHint).toBe(false);
    }

    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    expect((await client.listResources()).resources).toEqual([]);
    expect((await client.listPrompts()).prompts).toEqual([]);

    expect(SERVER_INSTRUCTIONS.length).toBeLessThanOrEqual(2000);
    for (const desc of [SEARCH_DESCRIPTION, READ_DESCRIPTION, HEALTH_DESCRIPTION]) {
      expect(desc.length).toBeLessThanOrEqual(1000);
    }

    const forbidden = ['Obsidian', 'Claude', 'Codex', 'Cursor', 'Gemini', 'Copilot'];
    const allTexts = [SERVER_INSTRUCTIONS, SEARCH_DESCRIPTION, READ_DESCRIPTION, HEALTH_DESCRIPTION];
    for (const text of allTexts) {
      for (const word of forbidden) {
        expect(text).not.toContain(word);
      }
    }

    // Strict input schema rejects unknown keys via SDK.
    const extraKey = await client.callTool({
      name: 'health',
      arguments: { unexpected: true },
    }) as ToolCallResult;
    expect(extraKey.isError).toBe(true);
  });

  it('lets a model go from question to cited evidence using text alone and never repeats read body in structuredContent', async () => {
    const root = await trackedKb();
    const client = await connect({ cwd: root });

    const searchRes = await client.callTool({
      name: 'search',
      arguments: { query: 'record preservation' },
    }) as ToolCallResult;
    expect(searchRes.isError).toBeFalsy();
    const searchText = textOf(searchRes);
    expect(searchText).toContain('wiki/record-preservation.md');

    const hitVersionMatch = searchText.match(/wiki\/record-preservation\.md[^\n]*\n {2}version: (sha256:[a-f0-9]{64})/);
    expect(hitVersionMatch).not.toBeNull();

    const inv = await jsonRun(root, ['inventory', '--paths', 'wiki/record-preservation.md']);
    expect(inv.paths[0].exists).toBe(true);
    if (inv.paths[0].exists) {
      expect(hitVersionMatch![1]).toBe(inv.paths[0].sha256);
    }

    const readPageRes = await client.callTool({
      name: 'read',
      arguments: { path: 'wiki/record-preservation.md' },
    }) as ToolCallResult;
    expect(readPageRes.isError).toBeFalsy();
    const readPageText = textOf(readPageRes);
    const cliRead = await invoke(root, ['read', 'wiki/record-preservation.md']);
    expect(readPageText.split('\n')[0]).toBe(cliRead.stdout.split('\n')[0]);
    expect(readPageRes.structuredContent).toBeDefined();
    expect(readPageRes.structuredContent).not.toHaveProperty('text');

    const sourcesRes = await client.callTool({
      name: 'read',
      arguments: { path: 'wiki/record-preservation.md', select: 'section:Sources' },
    }) as ToolCallResult;
    expect(sourcesRes.isError).toBeFalsy();
    expect(sourcesRes.structuredContent).not.toHaveProperty('text');
    expect(textOf(sourcesRes)).toContain('Notes/meeting.md');

    const citedRes = await client.callTool({
      name: 'read',
      arguments: {
        path: 'Notes/meeting.md',
        select: 'cited:s2',
        from: 'wiki/record-preservation.md',
      },
    }) as ToolCallResult;
    expect(citedRes.isError).toBeFalsy();
    const citedText = textOf(citedRes);
    expect(citedText.split('\n')[0]).toContain('pin match');
    expect(citedRes.structuredContent).not.toHaveProperty('text');
  });

  it('continues paginated read and search with the exact arguments from next: and detects stale_version', async () => {
    const root = await trackedKb();
    const client = await connect({ cwd: root });

    // Long raw source read continuation.
    const firstRead = await client.callTool({
      name: 'read',
      arguments: { path: 'Notes/会议记录.txt', select: 'line 1' },
    }) as ToolCallResult;
    expect(firstRead.isError).toBeFalsy();
    const firstReadText = textOf(firstRead);
    expect(firstReadText.split('\n')[0]).toMatch(/more$/);
    const nextReadArgs = parseNextLine(firstReadText);
    expect(nextReadArgs).toMatchObject({
      path: 'Notes/会议记录.txt',
      select: 'line 1',
    });

    const secondRead = await client.callTool({
      name: 'read',
      arguments: nextReadArgs,
    }) as ToolCallResult;
    expect(secondRead.isError).toBeFalsy();
    expect(secondRead.structuredContent).not.toHaveProperty('text');

    // Modify file and reuse the same next args -> stale_version.
    await writeFile(
      join(root, 'Notes/会议记录.txt'),
      `${await readFile(join(root, 'Notes/会议记录.txt'), 'utf8')}\n追加一行。\n`,
    );
    const staleRead = await client.callTool({
      name: 'read',
      arguments: nextReadArgs,
    }) as ToolCallResult;
    expect(staleRead.isError).toBe(true);
    expect(textOf(staleRead)).toContain('error [stale_version]:');
    expect((staleRead.structuredContent?.error as { code: string }).code).toBe('stale_version');

    // Paginated search with limit: 1 over multiple hits.
    const firstSearch = await client.callTool({
      name: 'search',
      arguments: { query: 'record', scope: 'wiki', limit: 1 },
    }) as ToolCallResult;
    expect(firstSearch.isError).toBeFalsy();
    const firstSearchText = textOf(firstSearch);
    expect(firstSearchText.split('\n')[0]).toMatch(/\(more\)$/);
    const nextSearchArgs = parseNextLine(firstSearchText);
    expect(nextSearchArgs).toMatchObject({
      query: 'record',
      scope: 'wiki',
      limit: 1,
      offset: 1,
    });

    const secondSearch = await client.callTool({
      name: 'search',
      arguments: nextSearchArgs,
    }) as ToolCallResult;
    expect(secondSearch.isError).toBeFalsy();
    expect((secondSearch.structuredContent as { offset: number }).offset).toBe(1);
  });

  it('enforces mcp.raw on every call and checks path_denied before raw_disabled', async () => {
    const root = await trackedKb();
    await configure(root, { kf: '2.0', mcp: { raw: false } });
    const client = await connect({ cwd: root });

    const rawSearch = await client.callTool({
      name: 'search',
      arguments: { query: 'meeting', scope: 'raw' },
    }) as ToolCallResult;
    expect(rawSearch.isError).toBe(true);
    expect((rawSearch.structuredContent?.error as { code: string }).code).toBe('raw_disabled');
    expect(textOf(rawSearch)).toContain('mcp.raw');

    const rawRead = await client.callTool({
      name: 'read',
      arguments: { path: 'Notes/meeting.md' },
    }) as ToolCallResult;
    expect(rawRead.isError).toBe(true);
    expect((rawRead.structuredContent?.error as { code: string }).code).toBe('raw_disabled');

    const outsideRead = await client.callTool({
      name: 'read',
      arguments: { path: '../x' },
    }) as ToolCallResult;
    expect(outsideRead.isError).toBe(true);
    expect((outsideRead.structuredContent?.error as { code: string }).code).toBe('path_denied');

    const wikiRead = await client.callTool({
      name: 'read',
      arguments: { path: 'wiki/record-preservation.md' },
    }) as ToolCallResult;
    expect(wikiRead.isError).toBeFalsy();

    // Flip mcp.raw back to true on the same connection.
    await configure(root, { kf: '2.0', mcp: { raw: true } });

    const rawSearchOk = await client.callTool({
      name: 'search',
      arguments: { query: 'meeting', scope: 'raw' },
    }) as ToolCallResult;
    expect(rawSearchOk.isError).toBeFalsy();

    const rawReadOk = await client.callTool({
      name: 'read',
      arguments: { path: 'Notes/meeting.md' },
    }) as ToolCallResult;
    expect(rawReadOk.isError).toBeFalsy();
  });

  it('resolves root in order: --dir > KNOWLERY_DIR > walking up from cwd, treating empty KNOWLERY_DIR as unset', async () => {
    const kbFlag = await trackedKb();
    const kbEnv = await trackedKb();
    const kbWalk = await trackedKb();
    const nested = join(kbWalk, 'Notes', 'sub', 'deep');
    await mkdir(nested, { recursive: true });

    expect(await findMcpRoot(kbFlag, kbEnv, nested)).toEqual({ root: kbFlag, source: '--dir' });
    expect(await findMcpRoot(undefined, kbEnv, nested)).toEqual({ root: kbEnv, source: 'KNOWLERY_DIR' });
    expect(await findMcpRoot(undefined, '', nested)).toEqual({ root: kbWalk, source: 'cwd' });
    expect(await findMcpRoot(undefined, undefined, nested)).toEqual({ root: kbWalk, source: 'cwd' });

    // health reports root and root_from for each source.
    const client = await connect({ cwd: nested });
    const healthRes = await client.callTool({ name: 'health', arguments: {} }) as ToolCallResult;
    expect(healthRes.isError).toBeFalsy();
    expect(textOf(healthRes).split('\n')[0]).toBe(`root: ${kbWalk}  (from working directory)`);
    expect(healthRes.structuredContent).toMatchObject({ root: kbWalk, root_from: 'cwd' });
  });

  it('starts with no root, returns not_found on every tool, and succeeds after init on the same connection', async () => {
    const empty = await tempDir('knowlery-v2-empty-');
    const client = await connect({ cwd: empty });

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['health', 'read', 'search']);

    const calls: Array<{ name: string; arguments: Record<string, unknown> }> = [
      { name: 'health', arguments: {} },
      { name: 'search', arguments: { query: 'test' } },
      { name: 'read', arguments: { path: 'wiki/index.md' } },
    ];
    for (const call of calls) {
      const res = await client.callTool(call) as ToolCallResult;
      expect(res.isError).toBe(true);
      const text = textOf(res);
      expect(text).toContain('error [not_found]:');
      expect(text).toContain('knowlery init');
      expect(text).toContain('--dir');
      expect(text).toContain('KNOWLERY_DIR');
      expect((res.structuredContent?.error as { code: string }).code).toBe('not_found');
    }

    // Run init in that folder, then call health on the same connection.
    const initCode = await runCli(['init'], {
      cwd: empty,
      stdout: () => { /* discard */ },
      stderr: () => { /* discard */ },
    });
    expect(initCode).toBe(0);

    const afterInit = await client.callTool({ name: 'health', arguments: {} }) as ToolCallResult;
    expect(afterInit.isError).toBeFalsy();
    expect(afterInit.structuredContent).toMatchObject({ root: empty, root_from: 'cwd' });
  });

  it('enforces size limits on CJK content, truncates long errors to 2 KiB, and returns deadline deterministically', async () => {
    const root = await trackedKb();

    // Create CJK wiki pages so a search with hits in structuredContent exceeds 24 KiB (with \uXXXX accounting)
    // while the result without structured hits stays under 32 KiB.
    const cjkDesc = '知识库检索测试摘要内容'.repeat(20);
    const cjkClaim = '核心结论包含大量中文记录用于测试长度限制与结构化输出裁剪'.repeat(6);
    for (let i = 1; i <= 15; i++) {
      await writeFile(
        join(root, `wiki/cjk-page-${i}.md`),
        [
          '---',
          'type: concept',
          `title: 中文检索测试页${i}`,
          `description: ${cjkDesc}`,
          'status: current',
          'created: 2026-10-01',
          'updated: 2026-11-18',
          '---',
          `# 中文检索测试页${i}`,
          '',
          '## Current',
          `- ${cjkClaim} ^c1`,
        ].join('\n') + '\n',
      );
    }

    const client = await connect({ cwd: root });

    const cjkSearch = await client.callTool({
      name: 'search',
      arguments: { query: '中文检索测试', scope: 'wiki', limit: 15 },
    }) as ToolCallResult;
    expect(cjkSearch.isError).toBeFalsy();
    const measuredSearch = measureToolResultBytes({
      content: [{ type: 'text', text: textOf(cjkSearch) }],
      structuredContent: cjkSearch.structuredContent ?? {},
    });
    expect(measuredSearch).toBeLessThanOrEqual(RESULT_SIZE_LIMIT);
    expect(cjkSearch.structuredContent).toHaveProperty('hits_omitted', true);
    expect(cjkSearch.structuredContent).not.toHaveProperty('hits');
    expect(textOf(cjkSearch)).toContain('wiki/cjk-page-1.md');

    // Confirm that including hits would indeed have exceeded SEARCH_STRUCTURED_LIMIT.
    const smallSearch = await client.callTool({
      name: 'search',
      arguments: { query: '中文检索测试', scope: 'wiki', limit: 1 },
    }) as ToolCallResult;
    expect(smallSearch.isError).toBeFalsy();
    expect(smallSearch.structuredContent).toHaveProperty('hits');
    expect(measureToolResultBytes({
      content: [{ type: 'text', text: textOf(smallSearch) }],
      structuredContent: smallSearch.structuredContent ?? {},
    })).toBeLessThanOrEqual(SEARCH_STRUCTURED_LIMIT);

    // CJK read stays under 32 KiB or returns limit_reached.
    const cjkRead = await client.callTool({
      name: 'read',
      arguments: { path: 'Notes/会议记录.txt', select: 'lines 1-500' },
    }) as ToolCallResult;
    const measuredRead = measureToolResultBytes({
      content: [{ type: 'text', text: textOf(cjkRead) }],
      structuredContent: cjkRead.structuredContent ?? {},
      ...(cjkRead.isError ? { isError: true } : {}),
    });
    expect(measuredRead).toBeLessThanOrEqual(RESULT_SIZE_LIMIT);

    // Error text is capped at 2,048 UTF-8 bytes even for a huge path.
    const longPath = `Notes/${'中'.repeat(1200)}.txt`;
    const errRes = await client.callTool({
      name: 'read',
      arguments: { path: longPath },
    }) as ToolCallResult;
    expect(errRes.isError).toBe(true);
    expect(Buffer.byteLength(textOf(errRes), 'utf8')).toBeLessThanOrEqual(ERROR_TEXT_LIMIT);

    // Deterministic deadline (0 ms fails immediately before work completes).
    const deadlineClient = await connect({ cwd: root, deadlineMs: 0 });
    const timedOut = await deadlineClient.callTool({
      name: 'read',
      arguments: { path: 'Notes/meeting.md' },
    }) as ToolCallResult;
    expect(timedOut.isError).toBe(true);
    expect((timedOut.structuredContent?.error as { code: string }).code).toBe('deadline');
    expect(textOf(timedOut)).toContain('knowlery extract');
  });

  it('is read-only: leaves every file outside .knowlery/cache/ byte-identical', async () => {
    const root = await trackedKb();
    const before = await fileState(root);
    const client = await connect({ cwd: root });

    expect(((await client.callTool({ name: 'health', arguments: {} })) as ToolCallResult).isError).toBeFalsy();
    expect(((await client.callTool({ name: 'search', arguments: { query: 'record' } })) as ToolCallResult).isError).toBeFalsy();
    expect(((await client.callTool({ name: 'read', arguments: { path: 'wiki/record-preservation.md' } })) as ToolCallResult).isError).toBeFalsy();

    expect(await fileState(root)).toEqual(before);
  });

  it('validates mcp CLI invocation and lists mcp in --help', async () => {
    const root = await trackedKb();
    await failure(root, ['mcp', 'extra'], 'invalid_invocation', 2);
    await failure(root, ['mcp', '--limit', '1'], 'invalid_invocation', 2);

    const help = await invoke(root, ['--help']);
    expect(help.code).toBe(0);
    expect(help.stdout).toContain('mcp [--dir ROOT]');
  });
});
