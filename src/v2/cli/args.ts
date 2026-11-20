import { invalidInvocation } from '../core/errors';

export const USAGE = `Usage: knowlery [--dir ROOT] [--json] <command> [arguments]

Commands:
  inventory [--scope PATH] [--limit N] [--offset N] [--snapshot S]
  inventory --paths P…
  extract PATH | extract --all
  read PATH [--select S] [--from PAGE] [--offset N] [--expected-version HASH]
  validate [--scope PATH] [--limit N] [--offset N] [--snapshot S]
  --version
  --help

Global flags --dir and --json may appear anywhere.`;

export interface ParsedArgs {
  command: 'inventory' | 'extract' | 'read' | 'validate' | 'version' | 'help';
  dir: string;
  json: boolean;
  scope?: string;
  limit?: number;
  offset?: number;
  snapshot?: string;
  paths?: string[];
  path?: string;
  all?: boolean;
  select?: string;
  from?: string;
  expectedVersion?: string;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { command: 'help', dir: '.', json: false };
  let command: 'inventory' | 'extract' | 'read' | 'validate' | undefined;
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
      case '--all': parsed.all = true; break;
      case '--help': help = true; break;
      case '--version': version = true; break;
      case '--scope': parsed.scope = value(++i, arg); break;
      case '--snapshot': parsed.snapshot = value(++i, arg); break;
      case '--select': parsed.select = value(++i, arg); break;
      case '--from': parsed.from = value(++i, arg); break;
      case '--expected-version': {
        const hash = value(++i, arg);
        if (!/^sha256:[a-f0-9]{64}$/.test(hash)) invalidInvocation(`Bad value for ${arg}: ${hash}`);
        parsed.expectedVersion = hash;
        break;
      }
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
        if ((command === 'extract' || command === 'read') && parsed.path === undefined) { parsed.path = arg; break; }
        if (command !== undefined) invalidInvocation(`Unexpected argument: ${arg}`);
        if (arg !== 'inventory' && arg !== 'extract' && arg !== 'read' && arg !== 'validate') invalidInvocation(`Unknown command: ${arg}`);
        command = arg;
    }
  }
  const listOptions = parsed.scope !== undefined || parsed.limit !== undefined || parsed.snapshot !== undefined;
  const readOnlyOptions = parsed.select !== undefined || parsed.from !== undefined || parsed.expectedVersion !== undefined;
  if (parsed.paths && (listOptions || parsed.offset !== undefined)) invalidInvocation('--paths cannot be combined with --scope, --limit, --offset or --snapshot.');
  if (command !== 'inventory' && parsed.paths) invalidInvocation('--paths requires the inventory command.');
  if (command !== 'inventory' && command !== 'validate' && listOptions) invalidInvocation('--scope, --limit and --snapshot require the inventory or validate command.');
  if (command !== 'inventory' && command !== 'read' && command !== 'validate' && parsed.offset !== undefined) invalidInvocation('--offset requires the inventory, read or validate command.');
  if (command !== 'read' && readOnlyOptions) invalidInvocation('Read options require the read command.');
  if (command !== 'extract' && parsed.all) invalidInvocation('--all requires the extract command.');
  if (command === 'extract' && !help && !version && Boolean(parsed.path) === Boolean(parsed.all)) invalidInvocation('Use extract PATH or extract --all, but not both.');
  if (command === 'read' && !help && !version && parsed.path === undefined) invalidInvocation('Missing PATH for read.');
  if (help) parsed.command = 'help';
  else if (version) parsed.command = 'version';
  else if (command) parsed.command = command;
  else invalidInvocation(`No command supplied.\n\n${USAGE}`);
  return parsed;
}
