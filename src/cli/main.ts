import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { nodeVaultFs } from '../platform/node-fs';
import { CliError, type Prompt } from './commands/shared';
import { runInit } from './commands/init';
import { runSync } from './commands/sync';
import { runHealth } from './commands/health';

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
  knowlery --version | --help

The same workspace format as the Knowlery Obsidian plugin — a folder initialized here
opens in Obsidian with zero migration, and the plugin adds the review UI on top.`;

interface ParsedArgs {
  command: string | undefined;
  dir: string;
  platform?: string;
  name?: string;
  force: boolean;
  json: boolean;
  version: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: undefined,
    dir: '.',
    force: false,
    json: false,
    version: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dir') parsed.dir = argv[++i] ?? '.';
    else if (arg === '--platform') parsed.platform = argv[++i];
    else if (arg === '--name') parsed.name = argv[++i];
    else if (arg === '--force') parsed.force = true;
    else if (arg === '--json') parsed.json = true;
    else if (arg === '--version' || arg === '-v') parsed.version = true;
    else if (arg === '--help' || arg === '-h') parsed.help = true;
    else if (arg.startsWith('-')) throw new CliError(`Unknown flag: ${arg}\n\n${USAGE}`, 2);
    else if (!parsed.command) parsed.command = arg;
    else throw new CliError(`Unexpected argument: ${arg}\n\n${USAGE}`, 2);
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
