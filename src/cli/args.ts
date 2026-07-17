import { CliError } from './commands/shared';

/**
 * The CLI argument surface (spec 0.7 f2), extracted from main.ts so the 1.0
 * contract suite (spec 1.0 f5, §4.2.1) can drive the real parser without
 * executing the CLI entry point. Commands, arities, and flags are 1.0-frozen.
 */

export const USAGE = `knowlery — knowledge base lifecycle for agent clients

Usage:
  knowlery init   [--dir <path>] [--platform claude-code|opencode] [--name <kb name>] [--force]
  knowlery kb add <name> [path] | kb list [--json] | kb remove <name>
  knowlery mcp    # MCP server over stdio (tools/prompts/resources for local agents)
  knowlery mcp serve --port <n> [--host <addr>] [--allow-capture] [--allow-sync]
                     [--allow-init --kb-root <dir>] [--token-file <path>]
                     # remote mode: Streamable HTTP + bearer token (KNOWLERY_MCP_TOKEN)
  knowlery sync   [--dir <path>]
  knowlery health [--dir <path>] [--json]
  knowlery query  "<question>" [--dir <path> | --kb <name> | --kb '*'] [--k <n>] [--json]
  knowlery stale  [--dir <path>] [--json]
  knowlery index  [--dir <path> | --kb <name>] [--json]   # orientation map (live view)
  knowlery bundle install <zip-or-folder-or-url> [--dir <path>] [--verify <sha256>]
                          [--force] [--skip-conformance] [--acknowledge-risks]
  knowlery bundle list      [--dir <path>] [--json]
  knowlery bundle uninstall <bundle-id> [--dir <path>]
  knowlery bundle export <seed-concept-id> [--dir <path>] [--hops <n>] [--zip] [--json]
  knowlery bundle review <seed-concept-id> [--dir <path>] [--list] [--json]
                         [--approve <id>...] [--flag <id>...]
  knowlery bundle publish <seed-concept-id> [--dir <path>] [--repo <owner/name>]
                          [--public] [--acknowledge-risks] [--force]
  knowlery bundle check-updates [--dir <path>] [--json]
  knowlery bundle update <bundle-id> | --all  [--dir <path>] [--force] [--acknowledge-risks]
  knowlery --version | --help

The same workspace format as the Knowlery Obsidian plugin — a folder initialized here
opens in Obsidian with zero migration, and the plugin adds the review UI on top.`;

export interface ParsedArgs {
  command: string | undefined;
  /** Positionals after the command: query's question, or bundle's subcommand + argument. */
  positionals: string[];
  dir: string;
  dirExplicit: boolean;
  kb?: string;
  platform?: string;
  name?: string;
  k?: number;
  hops?: number;
  force: boolean;
  skipConformance: boolean;
  json: boolean;
  zip: boolean;
  list: boolean;
  creator?: string;
  bundleVersion?: string;
  verify?: string;
  repo?: string;
  all: boolean;
  public: boolean;
  port?: number;
  host?: string;
  allowCapture: boolean;
  allowSync: boolean;
  allowInit: boolean;
  kbRoot?: string;
  tokenFile?: string;
  acknowledgeRisks: boolean;
  approve: string[];
  flag: string[];
  version: boolean;
  help: boolean;
}

/** How many positionals (after the command) each command accepts. Exported for the 1.0 contract suite (spec 1.0 f5, §4.2.1). */
export const POSITIONAL_LIMITS: Record<string, number> = {
  init: 0,
  kb: 3,
  mcp: 1,
  sync: 0,
  health: 0,
  query: 1,
  stale: 0,
  index: 0,
  bundle: 2,
};

export function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: undefined,
    positionals: [],
    dir: '.',
    dirExplicit: false,
    force: false,
    skipConformance: false,
    json: false,
    zip: false,
    list: false,
    all: false,
    public: false,
    allowCapture: false,
    allowSync: false,
    allowInit: false,
    acknowledgeRisks: false,
    approve: [],
    flag: [],
    version: false,
    help: false,
  };
  const takeValues = (start: number): { values: string[]; next: number } => {
    const values: string[] = [];
    let i = start;
    while (i < argv.length && !argv[i].startsWith('-')) values.push(argv[i++]);
    return { values, next: i - 1 };
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dir') {
      parsed.dir = argv[++i] ?? '.';
      parsed.dirExplicit = true;
    }
    else if (arg === '--kb') parsed.kb = argv[++i];
    else if (arg === '--platform') parsed.platform = argv[++i];
    else if (arg === '--name') parsed.name = argv[++i];
    else if (arg === '--k') {
      const value = parseInt(argv[++i] ?? '', 10);
      if (Number.isFinite(value) && value > 0) parsed.k = value;
    }
    else if (arg === '--hops') {
      const value = parseInt(argv[++i] ?? '', 10);
      if (Number.isFinite(value) && value >= 0) parsed.hops = value;
    }
    else if (arg === '--creator') parsed.creator = argv[++i];
    else if (arg === '--bundle-version') parsed.bundleVersion = argv[++i];
    else if (arg === '--verify') parsed.verify = argv[++i];
    else if (arg === '--repo') parsed.repo = argv[++i];
    else if (arg === '--port') {
      const value = parseInt(argv[++i] ?? '', 10);
      if (Number.isFinite(value) && value > 0 && value < 65536) parsed.port = value;
    }
    else if (arg === '--host') parsed.host = argv[++i];
    else if (arg === '--allow-capture') parsed.allowCapture = true;
    else if (arg === '--allow-sync') parsed.allowSync = true;
    else if (arg === '--allow-init') parsed.allowInit = true;
    else if (arg === '--kb-root') parsed.kbRoot = argv[++i];
    else if (arg === '--token-file') parsed.tokenFile = argv[++i];
    else if (arg === '--public') parsed.public = true;
    else if (arg === '--all') parsed.all = true;
    else if (arg === '--acknowledge-risks') parsed.acknowledgeRisks = true;
    else if (arg === '--approve') {
      const { values, next } = takeValues(i + 1);
      parsed.approve.push(...values);
      i = next;
    }
    else if (arg === '--flag') {
      const { values, next } = takeValues(i + 1);
      parsed.flag.push(...values);
      i = next;
    }
    else if (arg === '--zip') parsed.zip = true;
    else if (arg === '--list') parsed.list = true;
    else if (arg === '--force') parsed.force = true;
    else if (arg === '--skip-conformance') parsed.skipConformance = true;
    else if (arg === '--json') parsed.json = true;
    else if (arg === '--version' || arg === '-v') parsed.version = true;
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg.startsWith('-')) throw new CliError(`Unknown flag: ${arg}\n\n${USAGE}`, 2);
    else if (!parsed.command) parsed.command = arg;
    else parsed.positionals.push(arg);
  }
  return parsed;
}

