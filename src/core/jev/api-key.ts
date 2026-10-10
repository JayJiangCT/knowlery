import type { VaultFs } from '../vault-fs';

/**
 * Where the Node shells (`knowlery stale`, `knowlery triage`, the MCP `stale` tool)
 * find a Jev key, in order:
 *
 * 1. `TYPESAFE_API_KEY` in the process environment.
 * 2. The Obsidian plugin's own settings file, `.obsidian/plugins/knowlery/data.json`.
 *
 * (2) is what makes "add the key once in plugin settings" enough for a user whose
 * workbench is an agent harness: the key is already on disk there in plain text, so
 * reading it adds no exposure, and nothing has to be configured twice. Vaults with a
 * non-default Obsidian config directory fall back to (1). The key is still never
 * written anywhere by Knowlery's Node shells.
 */

export const JEV_API_KEY_ENV = 'TYPESAFE_API_KEY';
// The Node shells have no Vault instance to ask for `configDir`; the default is the
// documented fallback and `resolveJevApiKey` accepts the real one when a caller has it.
// eslint-disable-next-line obsidianmd/hardcoded-config-path
export const DEFAULT_CONFIG_DIR = '.obsidian';
export const PLUGIN_DATA_PATH = `${DEFAULT_CONFIG_DIR}/plugins/knowlery/data.json`;

export function pluginDataPath(configDir: string = DEFAULT_CONFIG_DIR): string {
  return `${configDir}/plugins/knowlery/data.json`;
}

export type JevKeySource = 'env' | 'plugin';

export interface ResolvedJevKey {
  apiKey: string;
  source: JevKeySource;
}

export function jevApiKeyFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env[JEV_API_KEY_ENV]?.trim();
  return key ? key : undefined;
}

/** The plugin's saved key, or undefined when the file is missing, malformed, or has no key. */
export async function jevApiKeyFromPlugin(fs: VaultFs, configDir?: string): Promise<string | undefined> {
  const path = pluginDataPath(configDir);
  try {
    if (!(await fs.exists(path))) return undefined;
    const data = JSON.parse(await fs.read(path)) as { jevApiKey?: unknown };
    const key = typeof data.jevApiKey === 'string' ? data.jevApiKey.trim() : '';
    return key ? key : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveJevApiKey(
  fs: VaultFs,
  env: NodeJS.ProcessEnv = process.env,
  configDir?: string,
): Promise<ResolvedJevKey | null> {
  const fromEnv = jevApiKeyFromEnv(env);
  if (fromEnv) return { apiKey: fromEnv, source: 'env' };
  const fromPlugin = await jevApiKeyFromPlugin(fs, configDir);
  return fromPlugin ? { apiKey: fromPlugin, source: 'plugin' } : null;
}
