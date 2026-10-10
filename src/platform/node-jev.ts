import { request as httpsRequest } from 'node:https';
import type { JevTransport } from '../core/jev/client';

/**
 * The Node shells' (CLI, MCP server) transport for Jev: plain node https POST,
 * mirroring node-fetch.ts for bundle sources. Non-2xx statuses are returned, not
 * thrown, so the client can classify them. The plugin shell uses requestUrl.
 */
export const nodeJevTransport: JevTransport = (url, headers, body) =>
  new Promise((resolve, reject) => {
    const request = httpsRequest(url, { method: 'POST', headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        resolve({ status: response.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') });
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end(body);
  });
