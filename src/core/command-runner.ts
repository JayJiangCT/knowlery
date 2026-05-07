export interface CommandInvocation {
  executable: string;
  args: string[];
}

export function buildWindowsCommandInvocation(command: string, args: string[]): CommandInvocation {
  if (!requiresCmdShell(command)) {
    return { executable: command, args };
  }

  const commandLine = [quoteForCmd(command), ...args.map(quoteForCmd)].join(' ');
  return {
    executable: 'cmd.exe',
    args: ['/d', '/s', '/c', `"${commandLine}"`],
  };
}

export function buildClaudeCodePowerShellInstallScript(): string {
  return [
    '[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12',
    'Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression',
  ].join('; ');
}

function requiresCmdShell(command: string): boolean {
  const normalized = command.toLowerCase();
  return normalized.endsWith('.cmd') || normalized.endsWith('.bat');
}

function quoteForCmd(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
