import { get as httpsGet } from 'node:https';
import { get as httpGet } from 'node:http';
import type { RemoteFetchResult } from '../core/okf/remote-source';

/**
 * The CLI shell's transport for remote bundle sources (spec 0.9 f1): plain
 * node http(s) with manual redirect following (GitHub release assets 302 to
 * storage). The plugin shell supplies Obsidian's requestUrl instead.
 */
export function nodeFetch(url: string, redirectsLeft = 5): Promise<RemoteFetchResult> {
  return new Promise((resolve, reject) => {
    const impl = url.startsWith('https:') ? httpsGet : httpGet;
    const request = impl(url, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
        response.resume();
        resolve(nodeFetch(new URL(location, url).toString(), redirectsLeft - 1));
        return;
      }
      resolve({ status, ok: status >= 200 && status < 300, body: response });
    });
    request.on('error', reject);
  });
}
