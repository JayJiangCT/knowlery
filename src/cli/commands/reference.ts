import {
  CONFIG_PATH,
  ReferenceDirError,
  addDir,
  readConfig,
  removeDir,
  type DirListKind,
} from '../../core/reference-config';
import type { VaultFs } from '../../core/vault-fs';
import { CliError } from './shared';

interface DirListCommandSpec {
  kind: DirListKind;
  command: string;
  usage: string;
  added: (dir: string) => string;
  alreadyCovered: (dir: string) => string;
  removed: (dir: string) => string;
  notListed: (dir: string) => string;
  empty: string;
}

const REFERENCE: DirListCommandSpec = {
  kind: 'referenceDirs',
  command: 'reference',
  usage: [
    'Usage:',
    '  knowlery reference list [--dir <path> | --kb <name>] [--json]',
    '  knowlery reference add <dir>      # mark a vault directory as read-only reference material',
    '  knowlery reference remove <dir>',
    '',
    'Reference directories stay fully queryable but are never listed as uncooked notes —',
    `the Library/ treatment, for directories you name. Stored in ${CONFIG_PATH}.`,
  ].join('\n'),
  added: (dir) => `Marked ${dir}/ as reference material — queryable, never listed as uncooked.`,
  alreadyCovered: (dir) => `${dir}/ is already covered by a reference directory.`,
  removed: (dir) => `Removed ${dir}/ from reference directories — its notes count as uncooked again.`,
  notListed: (dir) => `${dir}/ is not a reference directory.`,
  empty: 'No reference directories. Add one: knowlery reference add <dir>',
};

const IGNORE: DirListCommandSpec = {
  kind: 'ignoreDirs',
  command: 'ignore',
  usage: [
    'Usage:',
    '  knowlery ignore list [--dir <path> | --kb <name>] [--json]',
    '  knowlery ignore add <dir>         # exclude a vault directory from scanning entirely',
    '  knowlery ignore remove <dir>',
    '',
    'Ignored directories are not scanned: invisible to query and to the staleness report.',
    'For imported knowledge you still want to search, use `knowlery reference` instead.',
    `node_modules, __pycache__ and build output beside a project manifest are ignored by default. Stored in ${CONFIG_PATH}.`,
  ].join('\n'),
  added: (dir) => `Ignoring ${dir}/ — not scanned, invisible to query and stale.`,
  alreadyCovered: (dir) => `${dir}/ is already covered by an ignored directory.`,
  removed: (dir) => `Stopped ignoring ${dir}/ — its notes are scanned again.`,
  notListed: (dir) => `${dir}/ is not an ignored directory.`,
  empty: 'No ignored directories beyond the built-in rules. Add one: knowlery ignore add <dir>',
};

export interface ReferenceCommandOptions {
  sub?: string;
  dir?: string;
  json?: boolean;
  log: (line: string) => void;
}

/** `knowlery reference`: edit the workspace's reference directories. */
export function runReferenceCommand(fs: VaultFs, options: ReferenceCommandOptions): Promise<void> {
  return runDirListCommand(fs, REFERENCE, options);
}

/** `knowlery ignore`: edit the workspace's ignored directories. */
export function runIgnoreCommand(fs: VaultFs, options: ReferenceCommandOptions): Promise<void> {
  return runDirListCommand(fs, IGNORE, options);
}

async function runDirListCommand(fs: VaultFs, spec: DirListCommandSpec, options: ReferenceCommandOptions): Promise<void> {
  try {
    switch (options.sub) {
      case 'list':
        await list(fs, spec, options);
        break;
      case 'add':
        await add(fs, spec, options);
        break;
      case 'remove':
        await remove(fs, spec, options);
        break;
      default:
        throw new CliError(
          options.sub ? `Unknown ${spec.command} subcommand: ${options.sub}\n\n${spec.usage}` : spec.usage,
          2,
        );
    }
  } catch (error) {
    if (error instanceof ReferenceDirError) throw new CliError(error.message);
    throw error;
  }
}

async function list(fs: VaultFs, spec: DirListCommandSpec, options: ReferenceCommandOptions): Promise<void> {
  if (options.dir !== undefined) {
    throw new CliError(`${spec.command} list takes no arguments, got: ${options.dir}\n\n${spec.usage}`, 2);
  }
  const dirs = (await readConfig(fs))[spec.kind];
  if (options.json) {
    options.log(JSON.stringify({ [spec.kind]: dirs }, null, 2));
    return;
  }
  if (dirs.length === 0) {
    options.log(spec.empty);
    return;
  }
  for (const dir of dirs) options.log(`${dir}/`);
}

async function add(fs: VaultFs, spec: DirListCommandSpec, options: ReferenceCommandOptions): Promise<void> {
  if (!options.dir) throw new CliError(`Missing directory.\n\n${spec.usage}`, 2);
  // The only commands here that create .knowlery/ — refuse to do so outside a workspace.
  if (!(await fs.exists('KNOWLEDGE.md')) && !(await fs.exists('.knowlery/manifest.json'))) {
    throw new CliError('Not an initialized Knowlery workspace (no KNOWLEDGE.md or .knowlery/manifest.json). Run `knowlery init` first, or pass --dir/--kb.');
  }
  const result = await addDir(fs, spec.kind, options.dir);
  options.log(result.changed ? spec.added(result.dir) : spec.alreadyCovered(result.dir));
}

async function remove(fs: VaultFs, spec: DirListCommandSpec, options: ReferenceCommandOptions): Promise<void> {
  if (!options.dir) throw new CliError(`Missing directory.\n\n${spec.usage}`, 2);
  const result = await removeDir(fs, spec.kind, options.dir);
  options.log(result.changed ? spec.removed(result.dir) : spec.notListed(result.dir));
}
