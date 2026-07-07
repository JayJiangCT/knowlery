import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { nodeVaultFs } from '../platform/node-fs';
import { CliError, type Prompt } from './commands/shared';
import { runInit } from './commands/init';
import { runSync } from './commands/sync';
import { runHealth } from './commands/health';
import { runFederatedQueryCommand, runQueryCommand } from './commands/query';
import { runKbCommand } from './commands/kb';
import { KbRegistryError, resolveKb } from '../core/kb-registry';
import { runStaleCommand } from './commands/stale';
import { runBundleCommand } from './commands/bundle';

/**
 * The `knowlery` CLI shell (spec 0.7 f2). Thin argv/prompt/output layer over the
 * F1-inverted core — no lifecycle logic lives here.
 */

// EPIPE handling (spec 0.8 f3, §4.4): agents pipe output into head/grep/pagers and
// close the pipe early — that is a normal end of conversation, not an error. Stream
// errors arrive asynchronously, so this one listener (installed before anything
// writes) is the single correct place; per-write handling would be scattered and racy.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(0);
    throw error;
  });
}

declare const KNOWLERY_VERSION: string; // injected by esbuild at build time

const USAGE = `knowlery — knowledge base lifecycle for agent clients

Usage:
  knowlery init   [--dir <path>] [--platform claude-code|opencode] [--name <kb name>] [--force]
  knowlery kb add <name> [path] | kb list [--json] | kb remove <name>
  knowlery sync   [--dir <path>]
  knowlery health [--dir <path>] [--json]
  knowlery query  "<question>" [--dir <path> | --kb <name> | --kb '*'] [--k <n>] [--json]
  knowlery stale  [--dir <path>] [--json]
  knowlery bundle install <zip-or-folder-or-url> [--dir <path>] [--verify <sha256>]
                          [--force] [--skip-conformance]
  knowlery bundle list      [--dir <path>] [--json]
  knowlery bundle uninstall <bundle-id> [--dir <path>]
  knowlery bundle export <seed-concept-id> [--dir <path>] [--hops <n>] [--zip] [--json]
  knowlery bundle review <seed-concept-id> [--dir <path>] [--list] [--json]
                         [--approve <id>...] [--flag <id>...]
  knowlery bundle publish <seed-concept-id> [--dir <path>] [--repo <owner/name>]
                          [--public] [--acknowledge-risks] [--force]
  knowlery bundle check-updates [--dir <path>] [--json]
  knowlery bundle update <bundle-id> | --all  [--dir <path>] [--force]
  knowlery --version | --help

The same workspace format as the Knowlery Obsidian plugin — a folder initialized here
opens in Obsidian with zero migration, and the plugin adds the review UI on top.`;

interface ParsedArgs {
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
  acknowledgeRisks: boolean;
  approve: string[];
  flag: string[];
  version: boolean;
  help: boolean;
}

/** How many positionals (after the command) each command accepts. */
const POSITIONAL_LIMITS: Record<string, number> = {
  init: 0,
  kb: 3,
  sync: 0,
  health: 0,
  query: 1,
  stale: 0,
  bundle: 2,
};

function parseArgs(argv: string[]): ParsedArgs {
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

function makePrompt(): Prompt {
  if (!process.stdin.isTTY) return null;
  return async (question: string) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await rl.question(question);
    } finally {
      rl.close();
    }
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const log = (line: string) => process.stdout.write(`${line}\n`);

  if (args.version) {
    log(typeof KNOWLERY_VERSION === 'string' ? KNOWLERY_VERSION : 'dev');
    return;
  }
  if (args.help || !args.command) {
    log(USAGE);
    if (!args.command && !args.help) process.exitCode = 2;
    return;
  }

  const limit = POSITIONAL_LIMITS[args.command] ?? 0;
  if (args.positionals.length > limit) {
    throw new CliError(`Unexpected argument: ${args.positionals[limit]}\n\n${USAGE}`, 2);
  }

  // --kb resolution (spec 1.0 f1, §4.3): additive sugar ending at path
  // resolution; --dir untouched; both at once is ambiguous.
  if (args.kb !== undefined && args.dirExplicit) {
    throw new CliError('Pass either --kb or --dir, not both.', 2);
  }
  if (args.kb !== undefined && args.command === 'init') {
    throw new CliError('init does not take --kb (the name does not exist yet). Initialize with --dir, then: knowlery kb add <name> <path>.', 2);
  }
  if (args.kb !== undefined && args.command === 'kb') {
    throw new CliError('kb commands manage the registry itself and do not take --kb.', 2);
  }
  const federated = args.kb === '*';
  let resolvedDir = args.dir;
  if (args.kb !== undefined && !federated) {
    try {
      resolvedDir = await resolveKb(args.kb);
    } catch (error) {
      if (error instanceof KbRegistryError) throw new CliError(error.message);
      throw error;
    }
  }
  if (federated && args.command !== 'query') {
    throw new CliError(`--kb '*' (federated) is supported for query only.`, 2);
  }

  const root = resolve(resolvedDir);
  const fs = nodeVaultFs(root);

  switch (args.command) {
    case 'kb':
      await runKbCommand({
        sub: args.positionals[0],
        name: args.positionals[1],
        path: args.positionals[2] !== undefined ? resolve(args.positionals[2]) : undefined,
        json: args.json,
        log,
      });
      break;
    case 'init':
      await runInit(fs, {
        platform: args.platform,
        name: args.name,
        force: args.force,
        prompt: makePrompt(),
        log,
      });
      break;
    case 'sync':
      await runSync(fs, {
        toolVersion: typeof KNOWLERY_VERSION === 'string' ? KNOWLERY_VERSION : undefined,
        log,
      });
      break;
    case 'health':
      await runHealth(fs, { root, json: args.json, log });
      break;
    case 'query':
      if (federated) {
        await runFederatedQueryCommand({ question: args.positionals[0], k: args.k, json: args.json, log });
      } else {
        runQueryCommand(root, { question: args.positionals[0], k: args.k, json: args.json, log });
      }
      break;
    case 'stale':
      runStaleCommand(root, { json: args.json, log });
      break;
    case 'bundle':
      await runBundleCommand(fs, {
        sub: args.positionals[0],
        // install's source path resolves against the caller's cwd, not --dir;
        // URLs pass through untouched (spec 0.9 f1).
        arg: args.positionals[0] === 'install' && args.positionals[1] !== undefined && !/^https?:\/\//i.test(args.positionals[1])
          ? resolve(args.positionals[1])
          : args.positionals[1],
        root,
        force: args.force,
        skipConformance: args.skipConformance,
        verify: args.verify,
        json: args.json,
        hops: args.hops,
        zip: args.zip,
        creator: args.creator,
        bundleVersion: args.bundleVersion,
        list: args.list,
        approve: args.approve,
        flag: args.flag,
        repo: args.repo,
        all: args.all,
        public: args.public,
        acknowledgeRisks: args.acknowledgeRisks,
        prompt: makePrompt(),
        log,
      });
      break;
    default:
      throw new CliError(`Unknown command: ${args.command}\n\n${USAGE}`, 2);
  }
}

main().catch((error: unknown) => {
  if (error instanceof CliError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = error.exitCode;
    return;
  }
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
