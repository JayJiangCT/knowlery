import { Notice } from 'obsidian';
import type { SkillInfo } from '../types';

export async function copySkillCommand(skill: SkillInfo): Promise<void> {
  const command = skill.detail?.example;
  if (!command) return;
  await navigator.clipboard.writeText(command);
  new Notice('Command copied to clipboard.');
}

export async function runSkillViaCli(
  skill: SkillInfo,
  cli: 'claude' | 'opencode',
): Promise<void> {
  const safeName = skill.name.replace(/[^a-zA-Z0-9\s\-_]/g, '');
  if (!safeName) { new Notice('Invalid skill name.'); return; }
  const { execFile } = require('child_process') as typeof import('child_process');
  execFile(cli, ['/' + safeName], (error) => {
    if (error) {
      new Notice(`Failed to run skill: ${error.message}`);
    } else {
      new Notice(`Skill "${skill.name}" sent to ${cli}`);
    }
  });
}
