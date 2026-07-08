import { createInterface } from 'node:readline/promises';
import { resolve } from 'node:path';
import { nodeVaultFs } from '../platform/node-fs';
import { CliError, type Prompt } from './commands/shared';
import { USAGE, parseArgs, POSITIONAL_LIMITS } from './args';
import { runInit } from './commands/init';
import { runSync } from './commands/sync';
import { runHealth } from './commands/health';
import { runFederatedQueryCommand, runQueryCommand } from './commands/query';
import { runKbCommand } from './commands/kb';
import { runMcpCommand, runMcpServeCommand } from './commands/mcp';
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
    case 'mcp': {
      const toolVersion = typeof KNOWLERY_VERSION === 'string' ? KNOWLERY_VERSION : undefined;
      if (args.positionals[0] === 'serve') {
        await runMcpServeCommand({
          port: args.port,
          host: args.host,
          allowCapture: args.allowCapture,
          allowSync: args.allowSync,
          allowInit: args.allowInit,
          kbRoot: args.kbRoot,
          tokenFile: args.tokenFile,
        }, toolVersion, log);
      } else if (args.positionals.length > 0) {
        throw new CliError(`Unknown mcp subcommand: ${args.positionals[0]} (expected: serve)\n\n${USAGE}`, 2);
      } else {
        await runMcpCommand(toolVersion);
      }
      break;
    }
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
