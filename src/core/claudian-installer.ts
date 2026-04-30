import { App, Platform, normalizePath, requestUrl } from 'obsidian';

const CLAUDIAN_PLUGIN_ID = 'claudian';
const CLAUDIAN_PLUGIN_DIR = '.obsidian/plugins/claudian';
const COMMUNITY_PLUGINS_PATH = '.obsidian/community-plugins.json';
const GITHUB_RELEASE_URL = 'https://api.github.com/repos/YishenTu/claudian/releases/latest';
const REQUIRED_ASSETS = ['main.js', 'manifest.json', 'styles.css'] as const;

type ClaudianAssetName = (typeof REQUIRED_ASSETS)[number];

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubReleasePayload {
  tag_name?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

interface AppPluginsLike {
  enabledPlugins?: Set<string> | string[];
  enablePluginAndSave?: (pluginId: string) => Promise<void>;
  loadManifests?: () => Promise<void>;
  loadPlugin?: (pluginId: string) => Promise<void>;
}

type CommunityPluginsReadResult =
  | { ok: true; pluginIds: string[] }
  | { ok: false; detail: string };

export interface ClaudianInstallResult {
  installed: boolean;
  enabled: boolean;
  version: string;
  installPath: string;
  releaseUrl: string;
  installDetail: string;
  enabledDetail: string;
}

export async function installClaudian(app: App): Promise<ClaudianInstallResult> {
  if (Platform.isMobile) {
    throw new Error('Claudian installation is only available on desktop.');
  }

  const release = await fetchLatestRelease();
  const assets = resolveRequiredAssets(release.assets ?? []);

  await ensureAdapterDir(app, '.obsidian');
  await ensureAdapterDir(app, '.obsidian/plugins');
  await ensureAdapterDir(app, CLAUDIAN_PLUGIN_DIR);

  for (const assetName of REQUIRED_ASSETS) {
    const asset = assets[assetName];
    const response = await requestUrl(asset.browser_download_url);
    const targetPath = normalizePath(`${CLAUDIAN_PLUGIN_DIR}/${assetName}`);
    await app.vault.adapter.write(targetPath, response.text);
  }

  const enableResult = await enableClaudian(app);
  const version = release.tag_name?.trim() || 'latest';
  const releaseUrl = release.html_url?.trim() || 'https://github.com/YishenTu/claudian/releases/latest';

  return {
    installed: true,
    enabled: enableResult.enabled,
    version,
    installPath: CLAUDIAN_PLUGIN_DIR,
    releaseUrl,
    installDetail: `Installed Claudian ${version} to ${CLAUDIAN_PLUGIN_DIR}.`,
    enabledDetail: enableResult.detail,
  };
}

async function fetchLatestRelease(): Promise<GitHubReleasePayload> {
  const response = await requestUrl({
    url: GITHUB_RELEASE_URL,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.json || typeof response.json !== 'object') {
    throw new Error('GitHub release response was not valid JSON.');
  }

  return response.json as GitHubReleasePayload;
}

function resolveRequiredAssets(
  assets: GitHubReleaseAsset[],
): Record<ClaudianAssetName, GitHubReleaseAsset> {
  const resolved = {} as Record<ClaudianAssetName, GitHubReleaseAsset>;

  for (const assetName of REQUIRED_ASSETS) {
    const asset = assets.find((candidate) => candidate.name === assetName);
    if (!asset?.browser_download_url) {
      throw new Error(`Latest Claudian release is missing ${assetName}.`);
    }
    resolved[assetName] = asset;
  }

  return resolved;
}

async function ensureAdapterDir(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (await app.vault.adapter.exists(normalized)) {
    return;
  }

  try {
    await app.vault.adapter.mkdir(normalized);
  } catch {
    if (!(await app.vault.adapter.exists(normalized))) {
      throw new Error(`Failed to create directory: ${normalized}`);
    }
  }
}

async function enableClaudian(app: App): Promise<{ enabled: boolean; detail: string }> {
  const plugins = (app as App & { plugins?: AppPluginsLike }).plugins;

  if (!plugins) {
    return {
      enabled: false,
      detail: 'Plugin files were installed, but Obsidian plugin APIs were unavailable for auto-enable.',
    };
  }

  try {
    await plugins.loadManifests?.();
  } catch {
    // Keep going; some app versions do not expose this method reliably.
  }

  if (typeof plugins.enablePluginAndSave === 'function') {
    try {
      await plugins.enablePluginAndSave(CLAUDIAN_PLUGIN_ID);
      if (isPluginEnabled(app, CLAUDIAN_PLUGIN_ID)) {
        return { enabled: true, detail: 'Claudian was enabled automatically.' };
      }
      return {
        enabled: false,
        detail: 'Claudian files were installed, but Obsidian did not confirm the plugin as enabled.',
      };
    } catch (error) {
      const fallback = await writeCommunityPluginState(app, plugins);
      return {
        enabled: fallback.enabled,
        detail: `${formatError(error)} ${fallback.detail}`.trim(),
      };
    }
  }

  return writeCommunityPluginState(app, plugins);
}

async function writeCommunityPluginState(
  app: App,
  plugins: AppPluginsLike,
): Promise<{ enabled: boolean; detail: string }> {
  const communityPlugins = await readCommunityPlugins(app);
  if (!communityPlugins.ok) {
    return {
      enabled: false,
      detail: communityPlugins.detail,
    };
  }

  const pluginIds = communityPlugins.pluginIds;
  if (!pluginIds.includes(CLAUDIAN_PLUGIN_ID)) {
    pluginIds.push(CLAUDIAN_PLUGIN_ID);
    await app.vault.adapter.write(
      normalizePath(COMMUNITY_PLUGINS_PATH),
      JSON.stringify(pluginIds, null, 2),
    );
  }

  try {
    await plugins.loadManifests?.();
    await plugins.loadPlugin?.(CLAUDIAN_PLUGIN_ID);
    mutateEnabledPlugins(plugins, CLAUDIAN_PLUGIN_ID);
  } catch {
    // Persisted enablement is still useful even if hot-loading fails.
  }

  if (isPluginEnabled(app, CLAUDIAN_PLUGIN_ID)) {
    return {
      enabled: true,
      detail: 'Claudian was enabled by updating community-plugins.json.',
    };
  }

  return {
    enabled: false,
    detail: 'Claudian was added to community-plugins.json. Reload Obsidian if it does not appear immediately.',
  };
}

async function readCommunityPlugins(app: App): Promise<CommunityPluginsReadResult> {
  const path = normalizePath(COMMUNITY_PLUGINS_PATH);
  if (!(await app.vault.adapter.exists(path))) {
    return { ok: true, pluginIds: [] };
  }

  try {
    const content = await app.vault.adapter.read(path);
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        detail: 'Claudian files were installed, but Knowlery could not safely update community-plugins.json because it was not an array.',
      };
    }

    const pluginIds = parsed.filter((value): value is string => typeof value === 'string');
    if (pluginIds.length !== parsed.length) {
      return {
        ok: false,
        detail: 'Claudian files were installed, but Knowlery could not safely update community-plugins.json because it contains non-string entries.',
      };
    }

    return { ok: true, pluginIds };
  } catch {
    return {
      ok: false,
      detail: 'Claudian files were installed, but Knowlery could not safely read community-plugins.json to persist enablement.',
    };
  }
}

function mutateEnabledPlugins(plugins: AppPluginsLike, pluginId: string): void {
  const enabledPlugins = plugins.enabledPlugins;

  if (enabledPlugins instanceof Set) {
    enabledPlugins.add(pluginId);
    return;
  }

  if (Array.isArray(enabledPlugins) && !enabledPlugins.includes(pluginId)) {
    enabledPlugins.push(pluginId);
  }
}

function isPluginEnabled(app: App, pluginId: string): boolean {
  const enabledPlugins = (app as App & { plugins?: AppPluginsLike }).plugins?.enabledPlugins;

  if (enabledPlugins instanceof Set) {
    return enabledPlugins.has(pluginId);
  }

  if (Array.isArray(enabledPlugins)) {
    return enabledPlugins.includes(pluginId);
  }

  return false;
}

function formatError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message ? `${message}.` : 'Auto-enable failed.';
}
