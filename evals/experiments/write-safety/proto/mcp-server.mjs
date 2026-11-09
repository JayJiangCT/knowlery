#!/usr/bin/env node
// THROWAWAY PROTOTYPE for experiment WS-001: minimal stdio MCP server (newline-delimited JSON-RPC 2.0)
// exposing `validate` and `append_history`. Vault: $KNOWLERY_VAULT. Process evidence log: $WS001_MCP_LOG.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { validate, appendHistory } from './knowlery-proto.mjs';

const VAULT = process.env.KNOWLERY_VAULT ?? 'vault';
const LOG = process.env.WS001_MCP_LOG;
const log = (s) => { if (LOG) appendFileSync(LOG, `${new Date().toISOString()} ${s}\n`); };

// Evidence for T2b: our own ancestry chain (pid, ppid, command) up to launchd.
function ancestry() {
  const chain = [];
  let pid = String(process.pid);
  for (let i = 0; i < 12 && pid && pid !== '0'; i++) {
    let row;
    try { row = execFileSync('ps', ['-o', 'pid=,ppid=,command=', '-p', pid], { encoding: 'utf8' }).trim(); } catch { break; }
    chain.push(row);
    pid = row.split(/\s+/)[1];
  }
  return chain;
}
if (LOG) {
  log(`mcp-server start pid=${process.pid} ppid=${process.ppid} cwd=${process.cwd()} vault=${VAULT}`);
  for (const row of ancestry()) log(`ancestry: ${row}`);
}

const TOOLS = [
  { name: 'validate', description: 'Read-only. Compare Knowledge files in the vault to the trusted baseline manifest; report clean | external_change | protected_change | baseline_unavailable | invalid_structure per file.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'append_history', description: 'Controlled write: append one line to ## History of the Knowledge page <slug>, write log.md, update the manifest. Refuses if the page is not clean against the baseline.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' }, line: { type: 'string' } }, required: ['slug', 'line'], additionalProperties: false } },
];

function callTool(name, args) {
  if (name === 'validate') return validate(VAULT);
  if (name === 'append_history') return appendHistory(VAULT, args.slug, args.line, 'process:knowlery-proto-mcp');
  throw new Error(`unknown tool ${name}`);
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
createInterface({ input: process.stdin }).on('line', (raw) => {
  if (!raw.trim()) return;
  let req;
  try { req = JSON.parse(raw); } catch { return; }
  const { id, method, params } = req;
  if (id === undefined) return; // notification
  if (method === 'initialize') {
    return send({ jsonrpc: '2.0', id, result: { protocolVersion: params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'knowlery-proto', version: '0.0.0-ws001' } } });
  }
  if (method === 'tools/list') return send({ jsonrpc: '2.0', id, result: { tools: TOOLS } });
  if (method === 'tools/call') {
    try {
      const out = callTool(params.name, params.arguments ?? {});
      log(`tools/call ${params.name} ok ${JSON.stringify(params.arguments ?? {})}`);
      return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] } });
    } catch (e) {
      log(`tools/call ${params.name} error ${e.message}`);
      return send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'error: ' + e.message }], isError: true } });
    }
  }
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } });
});
