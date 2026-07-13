import type { App } from 'obsidian';
import { Notice } from 'obsidian';
import { sendPromptToClaudian } from '../core/claudian-bridge';
import { withActivityLedgerReminder } from '../core/agent-request';
import { t } from '../i18n';

export async function sendPromptToAgent(app: App, prompt: string): Promise<void> {
  const wrapped = withActivityLedgerReminder(prompt);
  const sent = await sendPromptToClaudian(app, wrapped);
  if (sent) {
    new Notice(t('request.sent'));
    return;
  }
  try {
    await navigator.clipboard.writeText(wrapped);
    new Notice(t('request.copied'));
  } catch {
    new Notice(t('request.copyFailed'));
  }
}

export async function copyPrompt(prompt: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(withActivityLedgerReminder(prompt));
    new Notice(t('request.copied'));
  } catch {
    new Notice(t('request.copyFailed'));
  }
}
