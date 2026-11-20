import { readConfig } from '../core/config';
import { exitCode, KnowleryError } from '../core/errors';
import type { ExtractionOptions } from '../core/extract';
import { resolveRoot } from '../core/paths';
import { KF_VERSION, KIT_VERSION } from '../version';
import { parseArgs, USAGE } from './args';
import { runInventory } from './commands/inventory';
import { runExtract } from './commands/extract';
import { runRead } from './commands/read';
import { runValidate } from './commands/validate';
import { runSearch } from './commands/search';
import { runIndexRebuild } from './commands/index';

export interface CliIO {
  stdout(text: string): void;
  stderr(text: string): void;
  cwd: string;
}

export async function runCli(argv: string[], io: CliIO, extractionOptions: Pick<ExtractionOptions, 'registry' | 'ceiling'> = {}): Promise<number> {
  const json = argv.includes('--json');
  const success = (command: string, result: object, text: string) => {
    io.stdout(json ? `${JSON.stringify({ contract: KF_VERSION, ok: true, command, ...result })}\n` : text);
  };
  try {
    const args = parseArgs(argv);
    switch (args.command) {
      case 'help':
        success('help', { usage: USAGE }, `${USAGE}\n`);
        break;
      case 'version':
        success('version', { kit: KIT_VERSION, kf: KF_VERSION }, `knowlery ${KIT_VERSION} (kf ${KF_VERSION})\n`);
        break;
      case 'inventory':
      case 'extract':
      case 'read':
      case 'validate':
      case 'search':
      case 'index': {
        const root = await resolveRoot(args.dir, io.cwd);
        const config = await readConfig(root);
        const { result, text } = args.command === 'extract'
          ? await runExtract(root, config, args, extractionOptions)
          : args.command === 'read'
            ? await runRead(root, config, args, extractionOptions)
            : args.command === 'validate'
              ? await runValidate(root, config, args, extractionOptions)
              : args.command === 'search'
                ? await runSearch(root, config, args, extractionOptions)
                : args.command === 'index'
                  ? await runIndexRebuild(root, config, extractionOptions)
                  : await runInventory(root, config, args);
        success(args.command, result, text);
        break;
      }
      default: {
        const unreachable: never = args.command;
        return unreachable;
      }
    }
    return 0;
  } catch (error) {
    const failure = error instanceof KnowleryError ? error : new KnowleryError('internal', error instanceof Error ? error.message : String(error), 'Check file permissions and retry.');
    const { code, message, recovery } = failure;
    if (json) io.stdout(`${JSON.stringify({ contract: KF_VERSION, ok: false, error: { code, message, recovery } })}\n`);
    else io.stderr(`error [${code}]: ${message}\nrecovery: ${recovery}\n`);
    return exitCode(code);
  }
}
