import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { sendPromptToClaudian } from '../core/claudian-bridge';
import { withActivityLedgerReminder } from '../core/agent-request';

export async function sendPromptToAgent(app: App, prompt: string): Promise<void> {
  const wrapped = withActivityLedgerReminder(prompt);
  const sent = await sendPromptToClaudian(app, wrapped);
  if (sent) {
    new Notice('Request sent to claudian.');
    return;
  }
  try {
    await navigator.clipboard.writeText(wrapped);
    new Notice('Agent request copied.');
  } catch {
    new Notice('Could not copy agent request.');
  }
}

export async function copyPrompt(prompt: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(withActivityLedgerReminder(prompt));
    new Notice('Agent request copied.');
  } catch {
    new Notice('Could not copy agent request.');
  }
}
