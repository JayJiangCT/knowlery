import {
  KbRegistryError,
  addKb,
  listKbs,
  registryPath,
  removeKb,
} from '../../core/kb-registry';
import { CliError } from './shared';

const KB_USAGE = [
  'Usage:',
  '  knowlery kb add <name> [path]     # register a knowledge base (path defaults to the current directory)',
  '  knowlery kb list [--json]',
  '  knowlery kb remove <name>         # registry-only; never touches the KB\'s files',
].join('\n');

export interface KbCommandOptions {
  sub?: string;
  name?: string;
  path?: string;
  json?: boolean;
  log: (line: string) => void;
}

/** `knowlery kb` (spec 1.0 f1): the global address book of named knowledge bases. */
export async function runKbCommand(options: KbCommandOptions): Promise<void> {
  try {
    switch (options.sub) {
      case 'add':
        await add(options);
        break;
      case 'list':
        await list(options);
        break;
      case 'remove':
        await remove(options);
        break;
      default:
        throw new CliError(options.sub ? `Unknown kb subcommand: ${options.sub}\n\n${KB_USAGE}` : KB_USAGE, 2);
    }
  } catch (error) {
    if (error instanceof KbRegistryError) throw new CliError(error.message);
    throw error;
  }
}

async function add(options: KbCommandOptions): Promise<void> {
  if (!options.name) throw new CliError(`Missing KB name.\n\n${KB_USAGE}`, 2);
  const result = await addKb(options.name, options.path ?? process.cwd());
  options.log(`Registered ${options.name} → ${result.path}`);
  if (result.alsoRegisteredAs.length > 0) {
    options.log(`  Note: this path is also registered as: ${result.alsoRegisteredAs.join(', ')}`);
  }
}

async function list(options: KbCommandOptions): Promise<void> {
  if (options.name !== undefined) {
    throw new CliError(`kb list takes no arguments, got: ${options.name}\n\n${KB_USAGE}`, 2);
  }
  const listings = await listKbs();
  if (options.json) {
    options.log(JSON.stringify({ registry: registryPath(), kbs: listings }, null, 2));
    return;
  }
  if (listings.length === 0) {
    options.log('No knowledge bases registered. Add one: knowlery kb add <name> <path>');
    return;
  }
  for (const kb of listings) {
    const marker = kb.state === 'ok' ? '' : `  [${kb.state}]`;
    options.log(`${kb.name}  ${kb.path}${marker}`);
  }
}

async function remove(options: KbCommandOptions): Promise<void> {
  if (!options.name) throw new CliError(`Missing KB name.\n\n${KB_USAGE}`, 2);
  if (options.path !== undefined) {
    throw new CliError(`kb remove takes exactly one argument, got extra: ${options.path}\n\n${KB_USAGE}`, 2);
  }
  const removed = await removeKb(options.name);
  if (!removed) throw new CliError(`No KB registered as "${options.name}".`);
  options.log(`Removed ${options.name} from the registry (its files are untouched).`);
}
