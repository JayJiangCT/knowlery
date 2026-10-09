import {
  CONFIG_PATH,
  ReferenceDirError,
  addReferenceDir,
  readConfig,
  removeReferenceDir,
} from '../../core/reference-config';
import type { VaultFs } from '../../core/vault-fs';
import { CliError } from './shared';

const REFERENCE_USAGE = [
  'Usage:',
  '  knowlery reference list [--dir <path> | --kb <name>] [--json]',
  '  knowlery reference add <dir>      # mark a vault directory as read-only reference material',
  '  knowlery reference remove <dir>',
  '',
  'Reference directories stay fully queryable but are never listed as uncooked notes —',
  `the Library/ treatment, for directories you name. Stored in ${CONFIG_PATH}.`,
].join('\n');

export interface ReferenceCommandOptions {
  sub?: string;
  dir?: string;
  json?: boolean;
  log: (line: string) => void;
}

/** `knowlery reference`: edit the workspace's reference directories (spec: reference dirs). */
export async function runReferenceCommand(fs: VaultFs, options: ReferenceCommandOptions): Promise<void> {
  try {
    switch (options.sub) {
      case 'list':
        await list(fs, options);
        break;
      case 'add':
        await add(fs, options);
        break;
      case 'remove':
        await remove(fs, options);
        break;
      default:
        throw new CliError(
          options.sub ? `Unknown reference subcommand: ${options.sub}\n\n${REFERENCE_USAGE}` : REFERENCE_USAGE,
          2,
        );
    }
  } catch (error) {
    if (error instanceof ReferenceDirError) throw new CliError(error.message);
    throw error;
  }
}

async function list(fs: VaultFs, options: ReferenceCommandOptions): Promise<void> {
  if (options.dir !== undefined) {
    throw new CliError(`reference list takes no arguments, got: ${options.dir}\n\n${REFERENCE_USAGE}`, 2);
  }
  const config = await readConfig(fs);
  if (options.json) {
    options.log(JSON.stringify({ referenceDirs: config.referenceDirs }, null, 2));
    return;
  }
  if (config.referenceDirs.length === 0) {
    options.log('No reference directories. Add one: knowlery reference add <dir>');
    return;
  }
  for (const dir of config.referenceDirs) options.log(`${dir}/`);
}

async function add(fs: VaultFs, options: ReferenceCommandOptions): Promise<void> {
  if (!options.dir) throw new CliError(`Missing directory.\n\n${REFERENCE_USAGE}`, 2);
  // The only command here that creates .knowlery/ — refuse to do so outside a workspace.
  if (!(await fs.exists('KNOWLEDGE.md')) && !(await fs.exists('.knowlery/manifest.json'))) {
    throw new CliError('Not an initialized Knowlery workspace (no KNOWLEDGE.md or .knowlery/manifest.json). Run `knowlery init` first, or pass --dir/--kb.');
  }
  const result = await addReferenceDir(fs, options.dir);
  options.log(
    result.added
      ? `Marked ${result.dir}/ as reference material — queryable, never listed as uncooked.`
      : `${result.dir}/ is already covered by a reference directory.`,
  );
}

async function remove(fs: VaultFs, options: ReferenceCommandOptions): Promise<void> {
  if (!options.dir) throw new CliError(`Missing directory.\n\n${REFERENCE_USAGE}`, 2);
  const result = await removeReferenceDir(fs, options.dir);
  options.log(
    result.removed
      ? `Removed ${result.dir}/ from reference directories — its notes count as uncooked again.`
      : `${result.dir}/ is not a reference directory.`,
  );
}
