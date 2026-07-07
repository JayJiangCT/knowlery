import type { VaultFs } from '../../core/vault-fs';
import { isVaultInitialized } from '../../core/setup-executor';
import { readBundleEntries } from '../../core/okf/zip';
import { previewInstall } from '../../core/okf/install-scan';
import { installBundle, InstallBlockedError } from '../../core/okf/install';
import { uninstallBundle } from '../../core/okf/uninstall';
import { readInstalledBundles } from '../../core/okf/registry';
import { RemoteSourceError, downloadRemoteBundle, isRemoteSource, verifyFileIntegrity } from '../../core/okf/remote-source';
import { nodeFetch } from '../../platform/node-fetch';
import { runBundleExport, runBundleReview } from './bundle-export';
import { runBundlePublish } from './bundle-publish';
import { runBundleUpdate, runCheckUpdates } from './bundle-update';
import { CliError } from './shared';

const BUNDLE_USAGE = [
  'Usage:',
  '  knowlery bundle install <zip-or-folder-or-url> [--dir <vault>] [--verify <sha256>] [--force] [--skip-conformance]',
  '  knowlery bundle list      [--dir <vault>] [--json]',
  '  knowlery bundle uninstall <bundle-id> [--dir <vault>]',
  '  knowlery bundle export <seed-concept-id> [--dir <vault>] [--hops <n>] [--zip] [--json]',
  '  knowlery bundle publish <seed-concept-id> [--dir <vault>] [--repo <owner/name>] [--public]',
  '                          [--acknowledge-risks] [--force]',
  '  knowlery bundle check-updates [--dir <vault>] [--json]',
  '  knowlery bundle update <bundle-id> | --all  [--dir <vault>] [--force]',
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
  /** sha256 integrity check for remote installs (spec 0.9 f1, §4.3). */
  verify?: string;
  json?: boolean;
  hops?: number;
  zip?: boolean;
  creator?: string;
  bundleVersion?: string;
  list?: boolean;
  approve?: string[];
  flag?: string[];
  repo?: string;
  all?: boolean;
  public?: boolean;
  acknowledgeRisks?: boolean;
  prompt?: import('./shared').Prompt;
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
    case 'check-updates':
      await runCheckUpdates(fs, { json: options.json, log: options.log });
      break;
    case 'update':
      await runBundleUpdate(fs, {
        target: options.arg,
        all: options.all,
        force: options.force,
        json: options.json,
        root: options.root,
        log: options.log,
        install: (url) => install(fs, { ...options, arg: url, verify: undefined }),
      });
      break;
    case 'publish':
      await runBundlePublish(fs, {
        seed: options.arg,
        root: options.root,
        repo: options.repo,
        public: options.public,
        acknowledgeRisks: options.acknowledgeRisks,
        force: options.force,
        json: options.json,
        prompt: options.prompt ?? null,
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

  // Remote sources (spec 0.9 f1): download first, then the identical local
  // pipeline runs on the temp file. The registry records the original URL —
  // the seam F3's update checking reads.
  if (isRemoteSource(options.arg)) {
    const downloaded = await downloadRemote(options.arg, options);
    try {
      await installFrom(fs, downloaded.zipPath, options.arg, options);
    } finally {
      await downloaded.cleanup();
    }
    return;
  }

  if (options.verify) {
    // --verify composes with local files too (useful for forwarded zips).
    try {
      await verifyFileIntegrity(options.arg, options.verify);
    } catch (error) {
      if (error instanceof RemoteSourceError) throw new CliError(error.message);
      throw error;
    }
  }
  await installFrom(fs, options.arg, options.arg, options);
}

async function downloadRemote(url: string, options: BundleCommandOptions) {
  try {
    return await downloadRemoteBundle(url, { fetchImpl: nodeFetch, verify: options.verify, log: options.log });
  } catch (error) {
    if (error instanceof RemoteSourceError) throw new CliError(error.message);
    throw error;
  }
}

async function installFrom(fs: VaultFs, sourcePath: string, recordedSource: string, options: BundleCommandOptions): Promise<void> {
  let entries;
  try {
    entries = await readBundleEntries(sourcePath);
  } catch (error) {
    throw new CliError(`Could not read bundle source ${recordedSource}: ${error instanceof Error ? error.message : String(error)}`);
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
      source: recordedSource,
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
    const provenance = isRemoteSource(entry.source) ? ` · from ${sourceDomain(entry.source)}` : '';
    options.log(`  installed ${entry.installedAt.slice(0, 10)} · conformance ${entry.conformance} · ${entry.libraryPath}${provenance}`);
  }
}

function sourceDomain(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'remote';
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
