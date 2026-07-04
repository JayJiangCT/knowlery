import type { VaultFs } from './vault-fs';
import { QUERY_SCRIPT } from '../assets/query-script.generated';

export const QUERY_SCRIPT_PATH = '.knowlery/bin/query.mjs';

/**
 * Writes the bundled deterministic retrieval script into the vault (spec f2, §5.3).
 * Idempotent: only rewrites when the embedded content differs, so version-sync on
 * plugin upgrade delivers updates without churning the file on every load.
 */
export async function syncQueryScript(fs: VaultFs): Promise<void> {
  if (!(await fs.exists('.knowlery'))) await fs.mkdir('.knowlery');
  if (!(await fs.exists('.knowlery/bin'))) await fs.mkdir('.knowlery/bin');
  const existing = (await fs.exists(QUERY_SCRIPT_PATH))
    ? await fs.read(QUERY_SCRIPT_PATH)
    : null;
  if (existing !== QUERY_SCRIPT) {
    await fs.write(QUERY_SCRIPT_PATH, QUERY_SCRIPT);
  }
}
