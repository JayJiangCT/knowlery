import { invalidInvocation } from '../core/errors';

export const USAGE = `Usage: knowlery [--dir ROOT] [--json] <command> [arguments]

Commands:
  inventory [--scope PATH] [--limit N] [--offset N] [--snapshot S]
  inventory --paths P…
  --version
  --help

Global flags --dir and --json may appear anywhere.`;

export interface ParsedArgs {
  command: 'inventory' | 'version' | 'help';
  dir: string;
  json: boolean;
  scope?: string;
  limit?: number;
  offset?: number;
  snapshot?: string;
  paths?: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { command: 'help', dir: '.', json: false };
  let command: string | undefined;
  let help = false;
  let version = false;
  const value = (index: number, flag: string): string => {
    const result = argv[index];
    if (!result || result.startsWith('-')) invalidInvocation(`Missing or bad value for ${flag}.`);
    return result;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--dir': parsed.dir = value(++i, arg); break;
      case '--json': parsed.json = true; break;
      case '--help': help = true; break;
      case '--version': version = true; break;
      case '--scope': parsed.scope = value(++i, arg); break;
      case '--snapshot': parsed.snapshot = value(++i, arg); break;
      case '--limit':
      case '--offset': {
        const text = value(++i, arg);
        const number = Number(text);
        if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < (arg === '--limit' ? 1 : 0)) {
          invalidInvocation(`Bad value for ${arg}: ${text}`);
        }
        if (arg === '--limit') parsed.limit = number;
        else parsed.offset = number;
        break;
      }
      case '--paths': {
        const paths: string[] = [];
        while (i + 1 < argv.length && !argv[i + 1].startsWith('-')) paths.push(argv[++i]);
        if (paths.length === 0) invalidInvocation('Missing value for --paths.');
        parsed.paths = [...(parsed.paths ?? []), ...paths];
        break;
      }
      default:
        if (arg.startsWith('-')) invalidInvocation(`Unknown flag: ${arg}`);
        if (command !== undefined) invalidInvocation(`Unexpected argument: ${arg}`);
        if (arg !== 'inventory') invalidInvocation(`Unknown command: ${arg}`);
        command = arg;
    }
  }
  const inventoryOptions = parsed.scope !== undefined || parsed.limit !== undefined || parsed.offset !== undefined || parsed.snapshot !== undefined;
  if (parsed.paths && inventoryOptions) invalidInvocation('--paths cannot be combined with --scope, --limit, --offset or --snapshot.');
  if (!command && (inventoryOptions || parsed.paths)) invalidInvocation('Inventory options require the inventory command.');
  if (help) parsed.command = 'help';
  else if (version) parsed.command = 'version';
  else if (command) parsed.command = 'inventory';
  else invalidInvocation(`No command supplied.\n\n${USAGE}`);
  return parsed;
}
