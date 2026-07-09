import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildMcpServer, type McpAccess } from './server';

/**
 * Remote mode, self-hosted (spec 1.0 f4): the same handler core behind
 * Streamable HTTP + bearer token. The stateless lifecycle is per-request and
 * that is implementation contract (spec §4.5): the node:http server is
 * long-lived, but each incoming MCP request constructs a fresh
 * McpServer + transport pair and closes both when the response closes —
 * reusing one pair across requests causes message-ID collisions.
 */

export interface McpHttpOptions {
  port: number;
  host: string;
  /** Held in memory for the process lifetime; never logged, echoed, or stored. */
  token: string;
  access: McpAccess;
  toolVersion?: string;
}

/** Constant-time bearer check: hashing first makes length mismatch constant-time too. */
export function tokenMatches(expected: string, header: string | undefined): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const presented = header.slice('Bearer '.length);
  const a = createHash('sha256').update(expected).digest();
  const b = createHash('sha256').update(presented).digest();
  return timingSafeEqual(a, b);
}

function unauthorized(res: ServerResponse): void {
  res.writeHead(401, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': 'Bearer realm="knowlery-mcp"',
  });
  res.end(JSON.stringify({
    jsonrpc: '2.0',
    error: { code: -32001, message: 'Unauthorized: missing or invalid bearer token.' },
    id: null,
  }));
}

export function startMcpHttpServer(options: McpHttpOptions): Promise<Server> {
  // Fail closed: buildMcpServer's access default is all-enabled (correct for
  // stdio, where the caller owns the machine) — the remote shell must invert
  // that, so an unset flag here means the write is absent, never present.
  const normalized: McpHttpOptions = {
    ...options,
    access: {
      capture: options.access.capture ?? false,
      sync: options.access.sync ?? false,
      init: options.access.init ?? false,
      // No flag exists: register_kb is local-stdio-only (spec 1.1 f1, §4.4) —
      // the registry is machine-global state, not one KB's.
      register: false,
    },
  };
  const httpServer = createServer((req, res) => {
    void handleRequest(normalized, req, res).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error.' },
          id: null,
        }));
      }
    });
  });
  return new Promise((resolvePromise, rejectPromise) => {
    httpServer.once('error', rejectPromise);
    httpServer.listen(options.port, options.host, () => resolvePromise(httpServer));
  });
}

async function handleRequest(options: McpHttpOptions, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  if (url.pathname !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. The MCP endpoint is /mcp.' }));
    return;
  }
  if (!tokenMatches(options.token, req.headers.authorization)) {
    unauthorized(res);
    return;
  }

  // Fresh pair per request (spec §4.5, the stateless contract), closed with
  // the response. Handler registration is schema objects + closures; every
  // tool call is a live scan anyway, so this costs nothing that matters.
  const server = buildMcpServer({ toolVersion: options.toolVersion, access: options.access });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
}
