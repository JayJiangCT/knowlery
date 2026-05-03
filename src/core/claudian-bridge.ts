import type { App } from 'obsidian';

const CLAUDIAN_VIEW_TYPE = 'claudian-view';
const CLAUDIAN_OPEN_COMMAND = 'claudian:open-view';
const CLAUDIAN_PLUGIN_ID = 'claudian';
const CLAUDIAN_READY_TIMEOUT_MS = 5000;

interface ClaudianInputController {
  sendMessage?: (options?: { content?: string }) => Promise<void> | void;
}

interface ClaudianTab {
  controllers?: {
    inputController?: ClaudianInputController;
  };
}

interface ClaudianTabManager {
  getActiveTab?: () => ClaudianTab | null;
}

interface ClaudianView {
  getActiveTab?: () => ClaudianTab | null;
  getTabManager?: () => ClaudianTabManager | null;
}

interface ClaudianPlugin {
  activateView?: () => Promise<void> | void;
  getView?: () => ClaudianView | null;
}

export async function sendPromptToClaudian(app: App, prompt: string): Promise<boolean> {
  const view = await ensureClaudianView(app);
  if (!view) return false;

  // Claudian does not expose a public bridge yet; keep this guarded for the PoC.
  const tab = await waitForActiveTab(view);
  const sendMessage = tab?.controllers?.inputController?.sendMessage;
  if (!sendMessage) return false;

  const leaf = app.workspace.getLeavesOfType(CLAUDIAN_VIEW_TYPE)[0];
  if (leaf) await app.workspace.revealLeaf(leaf);
  await sendMessage.call(tab.controllers?.inputController, { content: prompt });
  return true;
}

async function ensureClaudianView(app: App): Promise<ClaudianView | null> {
  const plugin = getClaudianPlugin(app);
  const existingView = plugin?.getView?.();
  if (existingView) return existingView;

  await plugin?.activateView?.();
  const pluginOpenedView = await waitForPluginView(plugin);
  if (pluginOpenedView) return pluginOpenedView;

  const leaf = await ensureClaudianLeaf(app);
  if (!leaf) return null;

  return leaf.view as unknown as ClaudianView;
}

async function waitForPluginView(plugin: ClaudianPlugin | null): Promise<ClaudianView | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < CLAUDIAN_READY_TIMEOUT_MS) {
    const view = plugin?.getView?.();
    if (view) return view;
    await sleep(50);
  }
  return null;
}

function getClaudianPlugin(app: App): ClaudianPlugin | null {
  const plugins = (app as App & {
    plugins?: {
      plugins?: Record<string, unknown>;
    };
  }).plugins?.plugins;

  return (plugins?.[CLAUDIAN_PLUGIN_ID] as ClaudianPlugin | undefined) ?? null;
}

async function ensureClaudianLeaf(app: App) {
  const existing = app.workspace.getLeavesOfType(CLAUDIAN_VIEW_TYPE)[0];
  if (existing) return existing;

  await executeOpenCommand(app);
  const leaf = await waitForLeaf(app);
  if (!leaf) return null;

  await app.workspace.revealLeaf(leaf);
  return leaf;
}

async function executeOpenCommand(app: App): Promise<void> {
  const commands = (app as App & {
    commands?: {
      executeCommandById?: (id: string) => unknown;
    };
  }).commands;
  await commands?.executeCommandById?.(CLAUDIAN_OPEN_COMMAND);
}

async function waitForLeaf(app: App) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < CLAUDIAN_READY_TIMEOUT_MS) {
    const leaf = app.workspace.getLeavesOfType(CLAUDIAN_VIEW_TYPE)[0];
    if (leaf) return leaf;
    await sleep(50);
  }
  return null;
}

async function waitForActiveTab(view: ClaudianView): Promise<ClaudianTab | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < CLAUDIAN_READY_TIMEOUT_MS) {
    const tab = view.getActiveTab?.() ?? view.getTabManager?.()?.getActiveTab?.() ?? null;
    if (tab?.controllers?.inputController?.sendMessage) return tab;
    await sleep(50);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
