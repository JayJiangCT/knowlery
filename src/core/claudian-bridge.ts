import type { App } from 'obsidian';

const CLAUDIAN_VIEW_TYPE = 'claudian-view';

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
  getTabManager?: () => ClaudianTabManager | null;
}

export async function sendPromptToClaudian(app: App, prompt: string): Promise<boolean> {
  const leaf = app.workspace.getLeavesOfType(CLAUDIAN_VIEW_TYPE)[0];
  if (!leaf) return false;

  // Claudian does not expose a public bridge yet; keep this guarded for the PoC.
  const view = leaf.view as unknown as ClaudianView;
  const tab = view.getTabManager?.()?.getActiveTab?.();
  const sendMessage = tab?.controllers?.inputController?.sendMessage;
  if (!sendMessage) return false;

  await app.workspace.revealLeaf(leaf);
  await sendMessage.call(tab.controllers?.inputController, { content: prompt });
  return true;
}
