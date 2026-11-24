import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { runHealth } from '../cli/commands/health';
import { formatReadText, runRead, type ReadResult } from '../cli/commands/read';
import { formatSearchText, runSearch, type SearchResult } from '../cli/commands/search';
import { readConfig, type Config } from '../core/config';
import { KnowleryError } from '../core/errors';
import type { ExtractionOptions } from '../core/extract';
import { isWikiRelPath, relativePath, resolveInside } from '../core/paths';
import { KIT_VERSION } from '../version';
import { findMcpRoot, formatRootSource, type ResolvedMcpRoot } from './root';
import { HEALTH_DESCRIPTION, READ_DESCRIPTION, SEARCH_DESCRIPTION, SERVER_INSTRUCTIONS } from './texts';

export const SEARCH_STRUCTURED_LIMIT = 24 * 1024;
export const RESULT_SIZE_LIMIT = 32 * 1024;
export const ERROR_TEXT_LIMIT = 2 * 1024;
export const DEFAULT_DEADLINE_MS = 30_000;

export interface McpServerOptions {
  dir?: string;
  envDir?: string;
  cwd: string;
  deadlineMs?: number;
  extractionOptions?: Pick<ExtractionOptions, 'registry' | 'ceiling'>;
}

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
}

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  openWorldHint: false,
} as const;

export function measureToolResultBytes(result: ToolResult): number {
  const json = JSON.stringify(result);
  let bytes = 0;
  for (let i = 0; i < json.length; i++) {
    bytes += json.charCodeAt(i) > 0x7f ? 6 : 1;
  }
  return bytes;
}

function truncateToUtf8Bytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  let bytes = 0;
  let end = 0;
  for (const ch of text) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    if (bytes + chBytes > maxBytes) break;
    bytes += chBytes;
    end += ch.length;
  }
  return text.slice(0, end);
}

function formatErrorResult(error: unknown): ToolResult {
  const failure = error instanceof KnowleryError
    ? error
    : new KnowleryError('internal', error instanceof Error ? error.message : String(error), 'Check file permissions and retry.');
  const { code, recovery } = failure;
  let message = failure.message;
  const prefix = `error [${code}]: `;
  const suffix = `\nrecovery: ${recovery}\n`;
  const overhead = Buffer.byteLength(prefix, 'utf8') + Buffer.byteLength(suffix, 'utf8');
  if (overhead + Buffer.byteLength(message, 'utf8') > ERROR_TEXT_LIMIT) {
    message = truncateToUtf8Bytes(message, Math.max(0, ERROR_TEXT_LIMIT - overhead));
  }
  const text = `${prefix}${message}${suffix}`;
  return {
    isError: true,
    content: [{ type: 'text', text }],
    structuredContent: {
      error: { code, message, recovery },
    },
  };
}

function rawDisabledError(): KnowleryError {
  return new KnowleryError(
    'raw_disabled',
    'Raw sources are not served over MCP in this knowledge base.',
    'Answer from the wiki, or ask the user to set mcp.raw to true in .knowlery/config.json.',
  );
}

function deadlineError(forRaw: boolean): KnowleryError {
  const recovery = forRaw
    ? 'Retry the call, or for a large raw source run knowlery extract on the command line first.'
    : 'Retry the call.';
  return new KnowleryError('deadline', 'The request exceeded the time limit.', recovery);
}

async function withDeadline<T>(ms: number, forRaw: boolean, work: () => Promise<T>): Promise<T> {
  if (ms <= 0) throw deadlineError(forRaw);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { reject(deadlineError(forRaw)); }, ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Typed facade over `server.registerTool` to avoid deep zod-compat generic
 * instantiation while keeping strict input validation and typed handlers.
 */
function defineTool<Shape extends z.ZodRawShape>(
  server: McpServer,
  name: string,
  config: {
    description: string;
    inputSchema: Shape;
    annotations: { readOnlyHint: boolean; openWorldHint: boolean };
  },
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<ToolResult>,
): void {
  const facade = server as unknown as {
    registerTool: (n: string, c: unknown, cb: unknown) => void;
  };
  facade.registerTool(
    name,
    {
      description: config.description,
      inputSchema: z.strictObject(config.inputSchema),
      annotations: config.annotations,
    },
    handler,
  );
}

function formatReadMcpNext(result: ReadResult): string {
  if (!result.next) return '';
  const payload: Record<string, unknown> = {
    path: result.path,
    select: result.next.select,
  };
  if (result.kind === 'cited') {
    payload.from = result.next.from;
  }
  payload.offset = result.next.offset;
  payload.expected_version = result.next.expected_version;
  return `next: ${JSON.stringify(payload)}`;
}

function formatSearchMcpNext(result: SearchResult, limit: number | undefined): string {
  if (!result.next) return '';
  const payload: Record<string, unknown> = {
    query: result.query,
    scope: result.scope,
  };
  if (limit !== undefined) payload.limit = limit;
  payload.offset = result.next.offset;
  payload.snapshot = result.next.snapshot;
  return `next: ${JSON.stringify(payload)}`;
}

function stripReadBody(result: ReadResult): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    if (key !== 'text') rest[key] = value;
  }
  return rest;
}

export function buildMcpServer(options: McpServerOptions): McpServer {
  const server = new McpServer(
    { name: 'knowlery', version: KIT_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const extractionOptions = options.extractionOptions ?? {};

  async function resolveContext(): Promise<{ found: ResolvedMcpRoot; config: Config }> {
    const found = await findMcpRoot(options.dir, options.envDir, options.cwd);
    const config = await readConfig(found.root);
    return { found, config };
  }

  defineTool(server, 'search', {
    description: SEARCH_DESCRIPTION,
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      query: z.string().min(1).describe('Search query'),
      scope: z.enum(['wiki', 'raw']).default('wiki').describe('Search scope: wiki (default) or raw'),
      limit: z.number().int().min(1).max(25).optional().describe('Maximum hits to return (1 to 25, default 10)'),
      offset: z.number().int().min(0).optional().describe('Copied from the next: line of the previous result'),
      snapshot: z.string().optional().describe('Copied from the next: line of the previous result'),
    },
  }, async (args) => {
    const scope = args.scope ?? 'wiki';
    try {
      return await withDeadline(deadlineMs, scope === 'raw', async () => {
        const { found, config } = await resolveContext();
        if (scope === 'raw' && !config.mcp.raw) throw rawDisabledError();
        const { result } = await runSearch(
          found.root,
          config,
          {
            query: args.query,
            scope,
            limit: args.limit,
            offset: args.offset,
            snapshot: args.snapshot,
          },
          extractionOptions,
        );
        const text = formatSearchText(result, {
          includeVersion: true,
          formatNext: (r) => formatSearchMcpNext(r, args.limit),
        });
        let toolResult: ToolResult = {
          content: [{ type: 'text', text }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
        if (measureToolResultBytes(toolResult) > SEARCH_STRUCTURED_LIMIT) {
          const omitted: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(result)) {
            if (key !== 'hits') omitted[key] = value;
          }
          omitted.hits_omitted = true;
          toolResult = {
            content: [{ type: 'text', text }],
            structuredContent: omitted,
          };
        }
        if (measureToolResultBytes(toolResult) > RESULT_SIZE_LIMIT) {
          throw new KnowleryError(
            'limit_reached',
            'Search result exceeded the 32 KiB MCP response limit.',
            'Retry search with a smaller limit.',
          );
        }
        return toolResult;
      });
    } catch (error) {
      return formatErrorResult(error);
    }
  });

  defineTool(server, 'read', {
    description: READ_DESCRIPTION,
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {
      path: z.string().min(1).describe('Path relative to the knowledge base root'),
      select: z.string().optional().describe('Selector for the page section, raw locator, outline, or cited:<key>'),
      from: z.string().optional().describe('The wiki page that cites the source, with select: cited:<key>'),
      offset: z.number().int().min(0).optional().describe('Copied from the next: line of the previous result'),
      expected_version: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional().describe('Copied from the next: line of the previous result'),
    },
  }, async (args) => {
    try {
      return await withDeadline(deadlineMs, true, async () => {
        const { found, config } = await resolveContext();
        const resolved = await resolveInside(found.root, args.path);
        const rel = relativePath(found.root, resolved);
        if (!config.mcp.raw && !isWikiRelPath(rel)) {
          throw rawDisabledError();
        }
        const { result } = await runRead(
          found.root,
          config,
          {
            path: args.path,
            select: args.select,
            from: args.from,
            offset: args.offset,
            expectedVersion: args.expected_version,
          },
          extractionOptions,
        );
        const text = formatReadText(result, {
          formatNext: formatReadMcpNext,
        });
        const toolResult: ToolResult = {
          content: [{ type: 'text', text }],
          structuredContent: stripReadBody(result),
        };
        if (measureToolResultBytes(toolResult) > RESULT_SIZE_LIMIT) {
          throw new KnowleryError(
            'limit_reached',
            'Read result exceeded the 32 KiB MCP response limit.',
            'Read a smaller part, such as a single section of a page or a narrower locator from the outline.',
          );
        }
        return toolResult;
      });
    } catch (error) {
      return formatErrorResult(error);
    }
  });

  defineTool(server, 'health', {
    description: HEALTH_DESCRIPTION,
    annotations: READ_ONLY_ANNOTATIONS,
    inputSchema: {},
  }, async () => {
    try {
      return await withDeadline(deadlineMs, false, async () => {
        const { found, config } = await resolveContext();
        const { result, text: cliText } = await runHealth(found.root, config, extractionOptions);
        const firstLine = `root: ${found.root}  (${formatRootSource(found.source)})`;
        const text = `${firstLine}\n${cliText}`;
        const toolResult: ToolResult = {
          content: [{ type: 'text', text }],
          structuredContent: {
            ...result,
            root: found.root,
            root_from: found.source,
          },
        };
        if (measureToolResultBytes(toolResult) > RESULT_SIZE_LIMIT) {
          throw new KnowleryError(
            'limit_reached',
            'Health result exceeded the 32 KiB MCP response limit.',
            'Check the knowledge base configuration and retry.',
          );
        }
        return toolResult;
      });
    } catch (error) {
      return formatErrorResult(error);
    }
  });

  return server;
}
