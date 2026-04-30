import { App, Platform as ObsidianPlatform } from 'obsidian';
import { dirname, join } from 'path';
import type {
  InstallExecutionState,
  InstallItemId,
  OptionalInstallSelection,
  Platform,
} from '../types';
import { detectCliToolByName } from './cli-detect';
import { installClaudian } from './claudian-installer';
import { detectNode } from './node-detect';

const INSTALL_ORDER: InstallItemId[] = ['platform-cli', 'claudian', 'skills-tooling'];

export interface OptionalInstallRunnerOptions {
  app: App;
  platform: Platform;
  selection: OptionalInstallSelection;
  nodePath?: string;
  onUpdate?: (state: InstallExecutionState) => void;
}

class InstallSkipError extends Error {}

export async function runOptionalInstalls(
  options: OptionalInstallRunnerOptions,
): Promise<InstallExecutionState[]> {
  const states = new Map<InstallItemId, InstallExecutionState>();

  for (const id of INSTALL_ORDER) {
    const selected = isSelected(options.selection, id);
    const state: InstallExecutionState = {
      id,
      status: selected ? 'queued' : 'not-selected',
      detail: selected ? 'Queued.' : 'Not selected.',
    };
    states.set(id, state);
    if (selected) {
      options.onUpdate?.(state);
    }
  }

  for (const id of INSTALL_ORDER) {
    if (!isSelected(options.selection, id)) {
      continue;
    }

    updateState(states, id, 'running', 'Running install...', options.onUpdate);

    try {
      const detail = await runInstall(id, options);
      updateState(states, id, 'done', detail, options.onUpdate);
    } catch (error) {
      if (error instanceof InstallSkipError) {
        updateState(states, id, 'skipped', error.message, options.onUpdate);
      } else {
        updateState(states, id, 'failed', formatError(error), options.onUpdate);
      }
    }
  }

  return INSTALL_ORDER.map((id) => states.get(id)!);
}

async function runInstall(
  id: InstallItemId,
  options: OptionalInstallRunnerOptions,
): Promise<string> {
  switch (id) {
    case 'platform-cli':
      return installPlatformCli(options.platform, options.nodePath);
    case 'claudian':
      return installClaudianPlugin(options.app);
    case 'skills-tooling':
      return installSkillsTooling(options.nodePath);
  }
}

async function installPlatformCli(platform: Platform, nodePath?: string): Promise<string> {
  if (ObsidianPlatform.isMobile) {
    throw new InstallSkipError('Platform CLI install is not available on mobile.');
  }

  const node = await detectNode(nodePath);
  if (!node.detected) {
    throw new InstallSkipError('Node.js is required to install the platform CLI.');
  }

  const target = platform === 'claude-code'
    ? { label: 'Claude Code', command: 'claude', packageName: '@anthropic-ai/claude-code' }
    : { label: 'OpenCode', command: 'opencode', packageName: 'opencode-ai' };

  await runCommand(resolveNodeSiblingCommand(node.path, 'npm'), ['install', '-g', target.packageName], 180000);

  const installed = await detectCliToolByName(target.command);
  if (!installed.installed) {
    throw new Error(`${target.label} install finished, but ${target.command} was not found on PATH.`);
  }

  return installed.version
    ? `${target.label} installed (${installed.version}).`
    : `${target.label} installed.`;
}

async function installClaudianPlugin(app: App): Promise<string> {
  if (ObsidianPlatform.isMobile) {
    throw new InstallSkipError('Claudian installation is only available on desktop.');
  }

  const result = await installClaudian(app);
  return `${result.installDetail} ${result.enabledDetail}`.trim();
}

async function installSkillsTooling(nodePath?: string): Promise<string> {
  if (ObsidianPlatform.isMobile) {
    throw new InstallSkipError('Skills tooling install is not available on mobile.');
  }

  const node = await detectNode(nodePath);
  if (!node.detected) {
    throw new InstallSkipError('Node.js is required to install skills tooling.');
  }

  await runCommand(resolveNodeSiblingCommand(node.path, 'npm'), ['install', '-g', 'skills'], 180000);
  const helpText = await runCommand(resolveNodeSiblingCommand(node.path, 'npx'), ['skills', '--help'], 30000);
  const summary = firstLine(helpText.stdout) || firstLine(helpText.stderr);

  return summary
    ? `Skills tooling ready (${summary}).`
    : 'Skills tooling ready.';
}

function isSelected(selection: OptionalInstallSelection, id: InstallItemId): boolean {
  switch (id) {
    case 'platform-cli':
      return selection.platformCli;
    case 'claudian':
      return selection.claudian;
    case 'skills-tooling':
      return selection.skillsTooling;
  }
}

function updateState(
  states: Map<InstallItemId, InstallExecutionState>,
  id: InstallItemId,
  status: InstallExecutionState['status'],
  detail: string,
  onUpdate?: (state: InstallExecutionState) => void,
): void {
  const nextState: InstallExecutionState = { id, status, detail };
  states.set(id, nextState);
  onUpdate?.(nextState);
}

function runCommand(
  command: string,
  args: string[],
  timeout: number,
): Promise<{ stdout: string; stderr: string }> {
  const { execFile } = require('child_process') as typeof import('child_process');

  if (ObsidianPlatform.isWin) {
    const executable = command === 'npm' || command === 'npx' ? `${command}.cmd` : command;
    return new Promise((resolve, reject) => {
      execFile(executable, args, { timeout }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  const home = process.env.HOME ?? '';
  const shell = process.env.SHELL ?? '/bin/zsh';
  const sourceCmd = shell.endsWith('zsh')
    ? `source "${home}/.zprofile" 2>/dev/null; source "${home}/.zshrc" 2>/dev/null;`
    : `source "${home}/.bash_profile" 2>/dev/null; source "${home}/.bashrc" 2>/dev/null;`;
  const argEnv = Object.fromEntries(
    args.map((arg, index) => [`KNOWLERY_INSTALL_ARG_${index}`, arg]),
  );
  const argRefs = args.map((_, index) => `"$KNOWLERY_INSTALL_ARG_${index}"`).join(' ');

  return new Promise((resolve, reject) => {
    execFile(
      shell,
      ['-c', `${sourceCmd} "$KNOWLERY_INSTALL_BIN" ${argRefs}`],
      {
        timeout,
        env: {
          ...process.env,
          KNOWLERY_INSTALL_BIN: command,
          ...argEnv,
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

function firstLine(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveNodeSiblingCommand(nodePath: string | null, binary: 'npm' | 'npx'): string {
  if (!nodePath) {
    return binary;
  }

  return ObsidianPlatform.isWin
    ? join(dirname(nodePath), `${binary}.cmd`)
    : join(dirname(nodePath), binary);
}
