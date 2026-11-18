import { readConfig } from '../core/config';
import { exitCode, KnowleryError } from '../core/errors';
import { resolveRoot } from '../core/paths';
import { KF_VERSION, KIT_VERSION } from '../version';
import { parseArgs, USAGE } from './args';
import { runInventory } from './commands/inventory';

export interface CliIO {
  stdout(text: string): void;
  stderr(text: string): void;
  cwd: string;
}

export async function runCli(argv: string[], io: CliIO): Promise<number> {
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
      case 'inventory': {
        const root = await resolveRoot(args.dir, io.cwd);
        const config = await readConfig(root);
        const { result, text } = await runInventory(root, config, args);
        success('inventory', result, text);
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
