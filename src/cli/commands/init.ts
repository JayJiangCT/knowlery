import type { Platform } from '../../types';
import type { VaultFs } from '../../core/vault-fs';
import { executeSetup, getSetupSteps, isVaultInitialized } from '../../core/setup-executor';
import { CliError, isPlatform, type Prompt } from './shared';

export interface InitOptions {
  platform?: string;
  name?: string;
  force?: boolean;
  prompt: Prompt;
  log: (line: string) => void;
}

export async function runInit(fs: VaultFs, options: InitOptions): Promise<void> {
  if ((await isVaultInitialized(fs)) && !options.force) {
    throw new CliError(
      'This directory is already a Knowlery workspace. Run `knowlery sync` to update it, or pass --force to re-run the full setup (built-in skills and agent config are overwritten; your notes and custom skills are preserved).',
    );
  }

  const platform = await resolveInitPlatform(options);
  const name = await resolveKbName(options);

  const labels = new Map(getSetupSteps().map((step) => [step.step, step.label]));
  await executeSetup(fs, platform, name, (step) => {
    options.log(`  ${labels.get(step) ?? step}`);
  });
  options.log(`Initialized Knowlery workspace "${name}" for ${platform}.`);
  options.log('Open this folder in Obsidian any time — the plugin will recognize it as-is.');
}

async function resolveInitPlatform(options: InitOptions): Promise<Platform> {
  if (options.platform !== undefined) {
    if (!isPlatform(options.platform)) {
      throw new CliError(`Unknown platform "${options.platform}". Use claude-code or opencode.`);
    }
    return options.platform;
  }
  if (!options.prompt) {
    throw new CliError('Missing --platform (claude-code|opencode); required when stdin is not a terminal.');
  }
  const answer = (await options.prompt('Agent platform [claude-code/opencode] (claude-code): ')).trim();
  if (answer === '') return 'claude-code';
  if (!isPlatform(answer)) {
    throw new CliError(`Unknown platform "${answer}". Use claude-code or opencode.`);
  }
  return answer;
}

async function resolveKbName(options: InitOptions): Promise<string> {
  if (options.name !== undefined) {
    if (options.name.trim() === '') throw new CliError('--name must not be empty.');
    return options.name.trim();
  }
  if (!options.prompt) {
    throw new CliError('Missing --name <knowledge base name>; required when stdin is not a terminal.');
  }
  const answer = (await options.prompt('Knowledge base name (My Knowledge Base): ')).trim();
  return answer === '' ? 'My Knowledge Base' : answer;
}
