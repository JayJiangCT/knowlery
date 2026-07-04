import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { nodeVaultFs } from '../platform/node-fs';
import { CliError, type Prompt } from './commands/shared';
import { runInit } from './commands/init';
import { runSync } from './commands/sync';
import { runHealth } from './commands/health';
import { runQueryCommand } from './commands/query';
import { runStaleCommand } from './commands/stale';
import { runBundleCommand } from './commands/bundle';

/**
 * The `knowlery` CLI shell (spec 0.7 f2). Thin argv/prompt/output layer over the
 * F1-inverted core — no lifecycle logic lives here.
 */

declare const KNOWLERY_VERSION: string; // injected by esbuild at build time

const USAGE = `knowlery — knowledge base lifecycle for agent clients

Usage:
  knowlery init   [--dir <path>] [--platform claude-code|opencode] [--name <kb name>] [--force]
  knowlery sync   [--dir <path>]
  knowlery health [--dir <path>] [--json]
  knowlery query  "<question>" [--dir <path>] [--k <n>] [--json]
  knowlery stale  [--dir <path>] [--json]
  knowlery bundle install <zip-or-folder> [--dir <path>] [--force] [--skip-conformance]
  knowlery bundle list      [--dir <path>] [--json]
  knowlery bundle uninstall <bundle-id> [--dir <path>]
  knowlery --version | --help

The same workspace format as the Knowlery Obsidian plugin — a folder initialized here
opens in Obsidian with zero migration, and the plugin adds the review UI on top.`;

interface ParsedArgs {
  command: string | undefined;
  /** Positionals after the command: query's question, or bundle's subcommand + argument. */
  positionals: string[];
  dir: string;
  platform?: string;
  name?: string;
  k?: number;
  force: boolean;
  skipConformance: boolean;
  json: boolean;
  version: boolean;
  help: boolean;
}

/** How many positionals (after the command) each command accepts. */
const POSITIONAL_LIMITS: Record<string, number> = {
  init: 0,
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
    force: false,
    skipConformance: false,
    json: false,
    version: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dir') parsed.dir = argv[++i] ?? '.';
    else if (arg === '--platform') parsed.platform = argv[++i];
    else if (arg === '--name') parsed.name = argv[++i];
    else if (arg === '--k') {
      const value = parseInt(argv[++i] ?? '', 10);
      if (Number.isFinite(value) && value > 0) parsed.k = value;
    }
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

  const root = resolve(args.dir);
  const fs = nodeVaultFs(root);

  switch (args.command) {
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
      await runSync(fs, { log });
      break;
    case 'health':
      await runHealth(fs, { root, json: args.json, log });
      break;
    case 'query':
      runQueryCommand(root, { question: args.positionals[0], k: args.k, json: args.json, log });
      break;
    case 'stale':
      runStaleCommand(root, { json: args.json, log });
      break;
    case 'bundle':
      await runBundleCommand(fs, {
        sub: args.positionals[0],
        // install's source path resolves against the caller's cwd, not --dir.
        arg: args.positionals[0] === 'install' && args.positionals[1] !== undefined
          ? resolve(args.positionals[1])
          : args.positionals[1],
        force: args.force,
        skipConformance: args.skipConformance,
        json: args.json,
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
