import { App, Platform as ObsidianPlatform } from 'obsidian';
import { dirname, join } from 'path';
import type {
  InstallExecutionState,
  InstallItemId,
  OptionalInstallSelection,
  Platform,
} from '../types';
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

  if (platform === 'claude-code') {
    return installClaudeCodeCli();
  }

  return installOpenCodeCli(nodePath);
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

  const helpText = await runCommand(resolveNodeSiblingCommand(node.path, 'npx'), ['--yes', 'skills', '--help'], 60000);
  const summary = firstLine(helpText.stdout) || firstLine(helpText.stderr);

  return summary
    ? `Skills tooling ready (${summary}).`
    : 'Skills tooling ready.';
}

async function installClaudeCodeCli(): Promise<string> {
  if (ObsidianPlatform.isWin) {
    return installClaudeCodeOnWindows();
  }

  await runShellCommand('curl -fsSL https://claude.ai/install.sh | bash', 180000);
  const installed = await verifyCommandInShell('claude');
  return formatInstalledDetail('Claude Code', installed.version, installed.path);
}

async function installClaudeCodeOnWindows(): Promise<string> {
  // Anthropic publishes Claude Code via winget (Anthropic.ClaudeCode); winget is more
  // reliable than `irm | iex` on Windows 11 (avoids SmartScreen / proxy / TLS issues),
  // so try it first and fall back to the documented PowerShell script.
  let primaryError: string | null = null;
  if (await commandExistsInPowerShell('winget')) {
    try {
      await runCommand(
        'winget',
        [
          'install',
          '--id',
          'Anthropic.ClaudeCode',
          '--silent',
          '--accept-source-agreements',
          '--accept-package-agreements',
        ],
        300000,
      );
    } catch (error) {
      primaryError = formatError(error);
    }
  } else {
    primaryError = 'winget not available';
  }

  if (primaryError) {
    try {
      await runPowerShellCommand('irm https://claude.ai/install.ps1 | iex', 180000);
    } catch (psError) {
      throw new Error(
        `winget install failed (${primaryError}); fallback PowerShell script also failed (${formatError(psError)}).`,
      );
    }
  }

  const installed = await verifyClaudeCodeOnWindows();
  return formatInstalledDetail('Claude Code', installed.version, installed.path);
}

async function verifyClaudeCodeOnWindows(): Promise<{ path: string; version: string | null }> {
  // Both winget and the official irm script land claude.exe at %USERPROFILE%\.local\bin
  // (anthropics/claude-code issues #11571, #27634, #27867). PATH may not refresh in this
  // process after install, so check the known location first before falling back to PATH.
  const userProfile = process.env.USERPROFILE ?? '';
  if (userProfile) {
    const candidate = join(userProfile, '.local', 'bin', 'claude.exe');
    try {
      const versionResult = await runCommand(candidate, ['--version'], 30000);
      return {
        path: candidate,
        version: firstLine(versionResult.stdout) || null,
      };
    } catch {
      // ignore and fall back to PATH-based lookup
    }
  }
  return verifyCommandInPowerShell('claude');
}

async function commandExistsInPowerShell(name: string): Promise<boolean> {
  try {
    await runPowerShellCommand(
      `$null = Get-Command ${name} -ErrorAction Stop`,
      15000,
    );
    return true;
  } catch {
    return false;
  }
}

async function installOpenCodeCli(nodePath?: string): Promise<string> {
  if (ObsidianPlatform.isWin) {
    const node = await detectNode(nodePath);
    if (!node.detected) {
      throw new InstallSkipError('Node.js is required to install OpenCode on Windows.');
    }

    const npmPath = resolveNodeSiblingCommand(node.path, 'npm');
    await runCommand(npmPath, ['install', '-g', 'opencode-ai'], 180000);
    const installed = await verifyNpmGlobalBinary(npmPath, 'opencode');
    return formatInstalledDetail('OpenCode', installed.version, installed.path);
  }

  if (ObsidianPlatform.isMacOS) {
    try {
      await runCommand('brew', ['install', 'anomalyco/tap/opencode'], 180000);
      const installed = await verifyHomebrewBinary('opencode');
      return formatInstalledDetail('OpenCode', installed.version, installed.path);
    } catch (error) {
      if (!isMissingBrewError(error)) {
        throw error;
      }
    }

    await runShellCommand('curl -fsSL https://opencode.ai/install | bash', 180000);
    const installed = await verifyCommandInShell('opencode');
    return formatInstalledDetail('OpenCode', installed.version, installed.path);
  }

  await runShellCommand('curl -fsSL https://opencode.ai/install | bash', 180000);
  const installed = await verifyCommandInShell('opencode');
  return formatInstalledDetail('OpenCode', installed.version, installed.path);
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
      const handler = (
        error: import('child_process').ExecFileException | null,
        stdout: string,
        stderr: string,
      ) => {
        if (error) {
          reject(new Error(stderr?.trim() || error.message));
          return;
        }
        resolve({ stdout, stderr });
      };

      if (isCmdScriptPath(executable)) {
        // Node 18.20.2+ refuses to spawn .cmd/.bat via execFile (CVE-2024-27980).
        // Invoke cmd.exe with a properly-quoted command line instead.
        const cmdLine = formatWindowsCmdLine(executable, args);
        execFile('cmd.exe', ['/d', '/s', '/c', cmdLine], { timeout }, handler);
      } else {
        execFile(executable, args, { timeout }, handler);
      }
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

function runShellCommand(script: string, timeout: number): Promise<{ stdout: string; stderr: string }> {
  const home = process.env.HOME ?? '';
  const shell = process.env.SHELL ?? '/bin/zsh';
  const sourceCmd = shell.endsWith('zsh')
    ? `source "${home}/.zprofile" 2>/dev/null; source "${home}/.zshrc" 2>/dev/null;`
    : `source "${home}/.bash_profile" 2>/dev/null; source "${home}/.bashrc" 2>/dev/null;`;

  return runCommand(shell, ['-c', `${sourceCmd} ${script}`], timeout);
}

function runPowerShellCommand(script: string, timeout: number): Promise<{ stdout: string; stderr: string }> {
  return runCommand('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], timeout);
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

async function verifyNpmGlobalBinary(
  npmPath: string,
  binaryName: string,
): Promise<{ path: string; version: string | null }> {
  const prefixResult = await runCommand(npmPath, ['prefix', '-g'], 30000);
  const prefix = firstLine(prefixResult.stdout);
  if (!prefix) {
    throw new Error(`Unable to determine npm global prefix for ${binaryName}.`);
  }

  const binaryPath = ObsidianPlatform.isWin
    ? join(prefix, `${binaryName}.cmd`)
    : join(prefix, 'bin', binaryName);
  const versionResult = await runCommand(binaryPath, ['--version'], 30000);

  return {
    path: binaryPath,
    version: firstLine(versionResult.stdout) || null,
  };
}

async function verifyHomebrewBinary(binaryName: string): Promise<{ path: string; version: string | null }> {
  const prefixResult = await runCommand('brew', ['--prefix', binaryName], 30000);
  const prefix = firstLine(prefixResult.stdout);
  if (!prefix) {
    throw new Error(`Unable to determine Homebrew prefix for ${binaryName}.`);
  }

  const binaryPath = join(prefix, 'bin', binaryName);
  const versionResult = await runCommand(binaryPath, ['--version'], 30000);

  return {
    path: binaryPath,
    version: firstLine(versionResult.stdout) || null,
  };
}

async function verifyCommandInShell(binaryName: string): Promise<{ path: string; version: string | null }> {
  const verification = await runShellCommand(`command -v ${binaryName} && ${binaryName} --version`, 30000);
  const lines = verification.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error(`${binaryName} was not found after installation.`);
  }

  return {
    path: lines[0],
    version: lines[1] ?? null,
  };
}

async function verifyCommandInPowerShell(binaryName: string): Promise<{ path: string; version: string | null }> {
  const verification = await runPowerShellCommand(
    `$cmd = Get-Command ${binaryName} -ErrorAction Stop; Write-Output $cmd.Source; & ${binaryName} --version`,
    30000,
  );
  const lines = verification.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error(`${binaryName} was not found after installation.`);
  }

  return {
    path: lines[0],
    version: lines[1] ?? null,
  };
}

function formatInstalledDetail(label: string, version: string | null, path: string): string {
  return version
    ? `${label} installed (${version}) at ${path}.`
    : `${label} installed at ${path}.`;
}

function isMissingBrewError(error: unknown): boolean {
  const message = formatError(error).toLowerCase();
  return message.includes('brew: command not found')
    || message.includes('brew: no such file or directory')
    || message.includes('enoent');
}

function isCmdScriptPath(path: string): boolean {
  return /\.(cmd|bat)$/i.test(path);
}

function formatWindowsCmdLine(command: string, args: string[]): string {
  return [command, ...args].map(quoteForWindowsCmd).join(' ');
}

function quoteForWindowsCmd(value: string): string {
  if (value === '') return '""';
  if (!/[\s"&<>|^()%!,;=]/.test(value)) return value;
  // Escape per CommandLineToArgvW rules: double trailing backslashes and
  // backslashes preceding embedded quotes, then escape the embedded quotes.
  const escaped = value
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\+)$/, '$1$1');
  return `"${escaped}"`;
}
