import { Platform } from 'obsidian';

export interface NodeDetectResult {
  detected: boolean;
  version: string | null;
  path: string | null;
}

export async function detectNode(customPath?: string): Promise<NodeDetectResult> {
  if (Platform.isMobile) {
    return { detected: false, version: null, path: null };
  }

  const { execFile } = await import('child_process');

  if (customPath) {
    const result = await tryNodeExecFile(execFile, customPath);
    if (result) return result;
  }

  // Use login shell to resolve node — GUI apps don't inherit the user's PATH
  const shellResult = await resolveNodeViaShell();
  if (shellResult) return shellResult;

  // Fallback: try common absolute paths
  const fallbackPaths = [
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
  ];
  for (const nodePath of fallbackPaths) {
    const result = await tryNodeExecFile(execFile, nodePath);
    if (result) return result;
  }

  if (Platform.isWin) {
    const localAppData = process.env.LOCALAPPDATA ?? '';
    const programFiles = process.env.ProgramFiles ?? '';
    const fallbackPaths = [
      `${programFiles}\\nodejs\\node.exe`,
      `${localAppData}\\Programs\\nodejs\\node.exe`,
    ].filter(Boolean);

    for (const nodePath of fallbackPaths) {
      const result = await tryNodeExecFile(execFile, nodePath);
      if (result) return result;
    }
  }

  return { detected: false, version: null, path: null };
}

function resolveNodeViaShell(): Promise<NodeDetectResult | null> {
  const { execFile } = require('child_process') as typeof import('child_process');
  const home = process.env.HOME || '';
  const shell = process.env.SHELL || '/bin/zsh';

  // Source shell config files explicitly rather than using -i (interactive mode
  // requires a terminal which isn't available in Electron's renderer process)
  const sourceCmd = shell.endsWith('zsh')
    ? `source "${home}/.zprofile" 2>/dev/null; source "${home}/.zshrc" 2>/dev/null;`
    : `source "${home}/.bash_profile" 2>/dev/null; source "${home}/.bashrc" 2>/dev/null;`;

  return new Promise(resolve => {
    execFile(
      shell,
      ['-c', `${sourceCmd} command -v node && node --version`],
      { timeout: 10000 },
      (error, stdout) => {
        if (error) {
          resolve(null);
          return;
        }
        const lines = stdout.trim().split('\n').filter(l => l.trim());
        if (lines.length >= 2 && lines[lines.length - 1].startsWith('v')) {
          resolve({
            detected: true,
            path: lines[lines.length - 2].trim(),
            version: lines[lines.length - 1].trim(),
          });
        } else {
          resolve(null);
        }
      },
    );
  });
}

function tryNodeExecFile(
  execFile: typeof import('child_process').execFile,
  nodePath: string,
): Promise<NodeDetectResult | null> {
  return new Promise(resolve => {
    execFile(nodePath, ['--version'], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }
      const version = stdout.trim();
      if (version.startsWith('v')) {
        resolve({ detected: true, version, path: nodePath });
      } else {
        resolve(null);
      }
    });
  });
}
