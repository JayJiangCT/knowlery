import { Platform } from 'obsidian';

export interface CliDetection {
  claudeCode: { installed: boolean; version?: string };
  opencode:   { installed: boolean; version?: string };
}

export interface CliToolResult {
  installed: boolean;
  version?: string;
}

export async function detectAgentCli(): Promise<CliDetection> {
  if (Platform.isMobile) {
    return {
      claudeCode: { installed: false },
      opencode: { installed: false },
    };
  }

  const [claudeResult, opencodeResult] = await Promise.all([
    detectCliTool('claude'),
    detectCliTool('opencode'),
  ]);

  return {
    claudeCode: claudeResult,
    opencode: opencodeResult,
  };
}

export async function detectCliToolByName(toolName: string): Promise<CliToolResult> {
  return detectCliTool(toolName);
}

function detectCliTool(toolName: string): Promise<CliToolResult> {
  if (Platform.isWin) {
    return detectCliToolWindows(toolName);
  }
  return detectCliToolUnix(toolName);
}

function detectCliToolUnix(toolName: string): Promise<CliToolResult> {
  const { execFile } = require('child_process') as typeof import('child_process');
  const safeName = toolName.replace(/[^a-zA-Z0-9\-_]/g, '');
  if (!safeName) return Promise.resolve({ installed: false });

  const home = process.env.HOME ?? '';
  const shell = process.env.SHELL ?? '/bin/zsh';

  // Source shell config to pick up user PATH (login-shell flag -l not available in Electron)
  const sourceCmd = shell.endsWith('zsh')
    ? `source "${home}/.zprofile" 2>/dev/null; source "${home}/.zshrc" 2>/dev/null;`
    : `source "${home}/.bash_profile" 2>/dev/null; source "${home}/.bashrc" 2>/dev/null;`;

  const cmd = `${sourceCmd} command -v "$KNOWLERY_CLI_TOOL" && "$KNOWLERY_CLI_TOOL" --version`;

  return new Promise(resolve => {
    execFile(
      shell,
      ['-c', cmd],
      { timeout: 10000, env: { ...process.env, KNOWLERY_CLI_TOOL: safeName } },
      (error, stdout) => {
        if (error) {
          resolve({ installed: false });
          return;
        }
        const lines = stdout.trim().split('\n').filter(l => l.trim());
        if (lines.length >= 2) {
          const version = lines[lines.length - 1].trim() || undefined;
          resolve({ installed: true, version });
        } else {
          resolve({ installed: false });
        }
      },
    );
  });
}

function detectCliToolWindows(toolName: string): Promise<CliToolResult> {
  const { execFile } = require('child_process') as typeof import('child_process');

  return new Promise(resolve => {
    execFile('where.exe', [toolName], { timeout: 5000 }, (whereError, whereStdout) => {
      if (whereError || !whereStdout.trim()) {
        resolve({ installed: false });
        return;
      }
      const binaryPath = whereStdout.trim().split('\n')[0].trim();
      const versionCallback = (
        versionError: import('child_process').ExecFileException | null,
        versionStdout: string,
      ) => {
        if (versionError) {
          // Binary found but --version failed — still consider it installed
          resolve({ installed: true });
          return;
        }
        const version = versionStdout.trim().split('\n')[0].trim() || undefined;
        resolve({ installed: true, version });
      };

      // CVE-2024-27980: Node refuses to spawn .cmd/.bat via execFile without shell:true.
      // Where.exe commonly returns .cmd shims for npm-installed CLIs (e.g. claude.cmd),
      // so route those through cmd.exe.
      if (/\.(cmd|bat)$/i.test(binaryPath)) {
        const cmdLine = formatWindowsCmdLine(binaryPath, ['--version']);
        execFile('cmd.exe', ['/d', '/s', '/c', cmdLine], { timeout: 5000 }, versionCallback);
      } else {
        execFile(binaryPath, ['--version'], { timeout: 5000 }, versionCallback);
      }
    });
  });
}

function formatWindowsCmdLine(command: string, args: string[]): string {
  return [command, ...args].map(quoteForWindowsCmd).join(' ');
}

function quoteForWindowsCmd(value: string): string {
  if (value === '') return '""';
  if (!/[\s"&<>|^()%!,;=]/.test(value)) return value;
  const escaped = value
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\+)$/, '$1$1');
  return `"${escaped}"`;
}
