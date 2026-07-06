import type { VaultFs } from '../../core/vault-fs';
import { isVaultInitialized } from '../../core/setup-executor';
import { readBundleEntries } from '../../core/okf/zip';
import { previewInstall } from '../../core/okf/install-scan';
import { installBundle, InstallBlockedError } from '../../core/okf/install';
import { uninstallBundle } from '../../core/okf/uninstall';
import { readInstalledBundles } from '../../core/okf/registry';
import { runBundleExport, runBundleReview } from './bundle-export';
import { CliError } from './shared';

const BUNDLE_USAGE = [
  'Usage:',
  '  knowlery bundle install <zip-or-folder> [--dir <vault>] [--force] [--skip-conformance]',
  '  knowlery bundle list      [--dir <vault>] [--json]',
  '  knowlery bundle uninstall <bundle-id> [--dir <vault>]',
  '  knowlery bundle export <seed-concept-id> [--dir <vault>] [--hops <n>] [--zip] [--json]',
  '  knowlery bundle review <seed-concept-id> [--dir <vault>] [--list] [--json]',
  '                         [--approve <id>...] [--flag <id>...]',
].join('\n');

export interface BundleCommandOptions {
  sub?: string;
  /** Source path (install), bundle id (uninstall), or seed concept id (export/review). */
  arg?: string;
  /** Absolute vault root — export needs it for zip paths. */
  root: string;
  force?: boolean;
  skipConformance?: boolean;
  json?: boolean;
  hops?: number;
  zip?: boolean;
  creator?: string;
  bundleVersion?: string;
  list?: boolean;
  approve?: string[];
  flag?: string[];
  log: (line: string) => void;
}

/**
 * `knowlery bundle` (spec 0.7 f4): the receiving side of OKF for the CLI shell.
 * Same inverted core the plugin's install modal uses — every 0.5.0 safety property
 * (path-safety assertions, version gate, conformance gate) applies unchanged.
 */
export async function runBundleCommand(fs: VaultFs, options: BundleCommandOptions): Promise<void> {
  if (!(await isVaultInitialized(fs))) {
    throw new CliError('Not a Knowlery workspace (no KNOWLEDGE.md or .knowlery/manifest.json). Run `knowlery init` first.');
  }

  switch (options.sub) {
    case 'install':
      await install(fs, options);
      break;
    case 'list':
      await list(fs, options);
      break;
    case 'uninstall':
      await uninstall(fs, options);
      break;
    case 'export':
      await runBundleExport(fs, {
        seed: options.arg,
        root: options.root,
        hops: options.hops,
        zip: options.zip,
        json: options.json,
        creator: options.creator,
        bundleVersion: options.bundleVersion,
        log: options.log,
      });
      break;
    case 'review':
      await runBundleReview(fs, {
        seed: options.arg,
        root: options.root,
        hops: options.hops,
        json: options.json,
        creator: options.creator,
        list: options.list,
        approve: options.approve ?? [],
        flag: options.flag ?? [],
        log: options.log,
      });
      break;
    default:
      throw new CliError(
        options.sub ? `Unknown bundle subcommand: ${options.sub}\n\n${BUNDLE_USAGE}` : BUNDLE_USAGE,
        2,
      );
  }
}

async function install(fs: VaultFs, options: BundleCommandOptions): Promise<void> {
  if (!options.arg) {
    throw new CliError(`Missing bundle source.\n\n${BUNDLE_USAGE}`, 2);
  }

  let entries;
  try {
    entries = await readBundleEntries(options.arg);
  } catch (error) {
    throw new CliError(`Could not read bundle source ${options.arg}: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Preview for the summary line; installBundle re-runs the same preview internally.
  let manifestTitle = '';
  let conceptCount = 0;
  try {
    const preview = previewInstall(entries);
    manifestTitle = preview.manifest.title;
    conceptCount = preview.manifest.conceptCount;
  } catch (error) {
    throw new CliError(`Not a valid knowledge bundle: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const result = await installBundle(fs, entries, {
      source: options.arg,
      force: options.force,
      skipConformanceGate: options.skipConformance,
    });
    options.log(`Installed ${result.id} v${result.version} — "${manifestTitle}" (${conceptCount} concept(s))`);
    options.log(`  Library path: ${result.libraryPath}`);
    options.log(`  Conformance:  ${result.conformance}${result.conformanceErrorCount > 0 ? ` (${result.conformanceErrorCount} error(s) acknowledged)` : ''}`);
  } catch (error) {
    if (error instanceof InstallBlockedError) {
      const hint = error.reason === 'blocked-version'
        ? 'Pass --force to reinstall over the existing version.'
        : 'Pass --skip-conformance to acknowledge the failures and install anyway.';
      throw new CliError(`${error.message}\n${hint}`);
    }
    throw error;
  }
}

async function list(fs: VaultFs, options: BundleCommandOptions): Promise<void> {
  const registry = await readInstalledBundles(fs);
  const entries = Object.entries(registry.bundles);

  if (options.json) {
    options.log(JSON.stringify(registry, null, 2));
    return;
  }
  if (entries.length === 0) {
    options.log('No bundles installed.');
    return;
  }
  for (const [id, entry] of entries) {
    options.log(`${id} v${entry.version} — "${entry.title}"`);
    options.log(`  installed ${entry.installedAt.slice(0, 10)} · conformance ${entry.conformance} · ${entry.libraryPath}`);
  }
}

async function uninstall(fs: VaultFs, options: BundleCommandOptions): Promise<void> {
  if (!options.arg) {
    throw new CliError(`Missing bundle id.\n\n${BUNDLE_USAGE}`, 2);
  }
  const registry = await readInstalledBundles(fs);
  if (!registry.bundles[options.arg]) {
    const installed = Object.keys(registry.bundles);
    throw new CliError(
      `No installed bundle named "${options.arg}".${installed.length > 0 ? ` Installed: ${installed.join(', ')}` : ' Nothing is installed.'}`,
    );
  }
  await uninstallBundle(fs, options.arg);
  options.log(`Uninstalled ${options.arg} (Library/${options.arg}/ removed).`);
}
