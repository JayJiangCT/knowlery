import type { App } from 'obsidian';
import { QUERY_SCRIPT } from '../assets/query-script.generated';

export const QUERY_SCRIPT_PATH = '.knowlery/bin/query.mjs';

/**
 * Writes the bundled deterministic retrieval script into the vault (spec f2, §5.3).
 * Idempotent: only rewrites when the embedded content differs, so version-sync on
 * plugin upgrade delivers updates without churning the file on every load.
 */
export async function syncQueryScript(app: App): Promise<void> {
  const adapter = app.vault.adapter;
  if (!(await adapter.exists('.knowlery'))) await adapter.mkdir('.knowlery');
  if (!(await adapter.exists('.knowlery/bin'))) await adapter.mkdir('.knowlery/bin');
  const existing = (await adapter.exists(QUERY_SCRIPT_PATH))
    ? await adapter.read(QUERY_SCRIPT_PATH)
    : null;
  if (existing !== QUERY_SCRIPT) {
    await adapter.write(QUERY_SCRIPT_PATH, QUERY_SCRIPT);
  }
}
