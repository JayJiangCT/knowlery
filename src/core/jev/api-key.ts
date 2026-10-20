import type { VaultFs } from '../vault-fs';

/**
 * Where the Node shells (`knowlery stale`, `knowlery triage`, the MCP `stale` tool)
 * find a Jev key, in order:
 *
 * 1. `TYPESAFE_API_KEY` in the process environment.
 * 2. The Obsidian plugin's own settings file, `<configDir>/plugins/knowlery/data.json`.
 *
 * (2) is what makes "add the key once in plugin settings" enough for a user whose
 * workbench is an agent harness: the key is already on disk there in plain text, so
 * reading it adds no exposure, and nothing has to be configured twice. The key is
 * still never written anywhere by Knowlery's Node shells.
 */

export const JEV_API_KEY_ENV = 'TYPESAFE_API_KEY';
export const PLUGIN_DATA_SUFFIX = 'plugins/knowlery/data.json';

export function pluginDataPath(configDir: string): string {
  return `${configDir}/${PLUGIN_DATA_SUFFIX}`;
}

/**
 * The Node shells have no Vault instance to ask for `configDir`, and the folder name is
 * user-configurable, so they look for Knowlery's settings file under every hidden
 * top-level folder, in sorted order.
 */
async function candidateConfigDirs(fs: VaultFs): Promise<string[]> {
  try {
    const { folders } = await fs.list('');
    return folders.filter((folder) => folder.startsWith('.')).sort();
  } catch {
    return [];
  }
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

/**
 * The plugin's saved key, or undefined when no settings file is found or none holds a key.
 * Without `configDir`, the first hidden top-level folder whose settings file has a key wins.
 */
export async function jevApiKeyFromPlugin(fs: VaultFs, configDir?: string): Promise<string | undefined> {
  const dirs = configDir ? [configDir] : await candidateConfigDirs(fs);
  for (const dir of dirs) {
    const key = await keyFromSettingsFile(fs, pluginDataPath(dir));
    if (key) return key;
  }
  return undefined;
}

async function keyFromSettingsFile(fs: VaultFs, path: string): Promise<string | undefined> {
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
