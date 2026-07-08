import { readFile, realpath } from 'node:fs/promises';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildMcpServer, type McpAccess } from '../../core/mcp/server';
import { startMcpHttpServer } from '../../core/mcp/http-server';
import { CliError } from './shared';

/**
 * `knowlery mcp` (spec 1.0 f2): the third shell. stdio transport for local MCP
 * clients (Claude Desktop/Code, Cursor, gemini-cli); the handlers live in
 * core/mcp and know nothing about the transport.
 */
export async function runMcpCommand(toolVersion?: string): Promise<void> {
  const server = buildMcpServer({ toolVersion });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The server runs until the client closes stdin; resolve on close so the
  // process exits cleanly instead of hanging.
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
}

// ---------------------------------------------------------------------------
// `knowlery mcp serve` (spec 1.0 f4): remote mode, self-hosted.

export interface ServeArgs {
  port?: number;
  host?: string;
  allowCapture: boolean;
  allowSync: boolean;
  allowInit: boolean;
  kbRoot?: string;
  tokenFile?: string;
}

export interface ResolvedServeOptions {
  port: number;
  host: string;
  token: string;
  access: McpAccess;
  /** Canonicalized kb-root, when init is allowed. */
  kbRoot?: string;
}

const MIN_TOKEN_BYTES = 16;

/**
 * All startup refusals in one testable place (spec §5.2). Every refusal is
 * exit 2 — the operator must fix the invocation, nothing has started yet.
 */
export async function resolveServeOptions(
  args: ServeArgs,
  env: Record<string, string | undefined>,
): Promise<ResolvedServeOptions> {
  if (args.port === undefined) {
    throw new CliError('mcp serve requires --port <n> — there is no default port; choose one deliberately.', 2);
  }

  const envToken = env.KNOWLERY_MCP_TOKEN;
  if (envToken !== undefined && args.tokenFile !== undefined) {
    throw new CliError('Both KNOWLERY_MCP_TOKEN and --token-file are set — ambiguous; use exactly one.', 2);
  }
  let token: string | undefined = envToken;
  if (args.tokenFile !== undefined) {
    try {
      token = (await readFile(args.tokenFile, 'utf8')).trim();
    } catch {
      throw new CliError(`Cannot read token file: ${args.tokenFile}`, 2);
    }
  }
  if (token === undefined || token.trim() === '') {
    throw new CliError(
      'No token configured. Set KNOWLERY_MCP_TOKEN or pass --token-file <path> '
      + '(generate one: openssl rand -hex 32). The server refuses to start without auth.', 2,
    );
  }
  token = token.trim();
  if (Buffer.byteLength(token, 'utf8') < MIN_TOKEN_BYTES) {
    throw new CliError(`Token is shorter than ${MIN_TOKEN_BYTES} bytes — too guessable. Generate one: openssl rand -hex 32`, 2);
  }

  let kbRoot: string | undefined;
  if (args.allowInit) {
    if (args.kbRoot === undefined) {
      throw new CliError('--allow-init requires --kb-root <dir>: state where remote-born KBs may live before offering the tool.', 2);
    }
    try {
      kbRoot = await realpath(args.kbRoot);
    } catch {
      throw new CliError(`--kb-root does not exist: ${args.kbRoot}`, 2);
    }
  } else if (args.kbRoot !== undefined) {
    throw new CliError('--kb-root only makes sense with --allow-init.', 2);
  }

  return {
    port: args.port,
    host: args.host ?? '127.0.0.1',
    token,
    access: {
      capture: args.allowCapture,
      sync: args.allowSync,
      init: args.allowInit && kbRoot !== undefined ? { kbRoot } : false,
    },
    kbRoot,
  };
}

export async function runMcpServeCommand(
  args: ServeArgs,
  toolVersion: string | undefined,
  log: (line: string) => void,
): Promise<void> {
  const options = await resolveServeOptions(args, process.env);

  const writes = [
    options.access.capture ? 'capture' : null,
    options.access.sync ? 'sync' : null,
    options.access.init !== false ? 'init_kb' : null,
  ].filter((name): name is string => name !== null);

  const server = await startMcpHttpServer({
    port: options.port,
    host: options.host,
    token: options.token,
    access: options.access,
    toolVersion,
  });

  log(`knowlery mcp serving on http://${options.host}:${options.port}/mcp`);
  log(writes.length === 0 ? 'Access: reads only.' : `Access: reads + ${writes.join(', ')}.`);
  if (options.kbRoot !== undefined) log(`Remote init_kb confined to: ${options.kbRoot}`);
  if (options.host !== '127.0.0.1' && options.host !== 'localhost') {
    log(`Warning: binding to ${options.host} exposes the port directly — prefer 127.0.0.1 behind a tunnel (cloudflared, tailscale, ssh -L).`);
  }

  await new Promise<void>((resolve) => {
    const shutdown = () => server.close(() => resolve());
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
