import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildMcpServer } from '../../core/mcp/server';

/**
 * `knowlery mcp` (spec 1.0 f2): the third shell. stdio transport for local MCP
 * clients (Claude Desktop/Code, Cursor, gemini-cli); the handlers live in
 * core/mcp and know nothing about the transport.
 */
export async function runMcpCommand(): Promise<void> {
  const server = buildMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The server runs until the client closes stdin; resolve on close so the
  // process exits cleanly instead of hanging.
  await new Promise<void>((resolve) => {
    transport.onclose = () => resolve();
  });
}
