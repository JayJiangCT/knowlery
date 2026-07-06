import { Notice, Platform } from 'obsidian';
import type { SkillInfo } from '../types';
import { execFile } from 'child_process';

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
  if (Platform.isMobile) {
    new Notice('Running skills from the dashboard is only available on desktop.');
    return;
  }

  const safeName = skill.name.replace(/[^a-zA-Z0-9\s\-_]/g, '');
  if (!safeName) { new Notice('Invalid skill name.'); return; }
  execFile(cli, ['/' + safeName], (error) => {
    if (error) {
      new Notice(`Failed to run skill: ${error.message}`);
    } else {
      new Notice(`Skill "${skill.name}" sent to ${cli}`);
    }
  });
}
