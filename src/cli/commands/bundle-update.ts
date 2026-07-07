import type { VaultFs } from '../../core/vault-fs';
import { readInstalledBundles } from '../../core/okf/registry';
import type { UpstreamDeps } from '../../core/okf/upstream';
import { collectUpdateStatuses, modifiedFiles, updateStatusFor, type UpdateStatus } from '../../core/okf/update-check';
import { nodeFetch } from '../../platform/node-fetch';
import { CliError } from './shared';
import type { BundleCommandOptions } from './bundle';

/**
 * `knowlery bundle check-updates` / `update` (spec 0.9 f3): the pull-based
 * subscription loop. check-updates is strictly read-only; update rides the F1
 * remote-install pipeline (same gates) with the staged replacement guaranteeing
 * the old version survives any failure.
 */

const defaultDeps: UpstreamDeps = {
  fetchText: async (url) => {
    const response = await nodeFetch(url);
    let text = '';
    if (response.body) {
      const chunks: Buffer[] = [];
      for await (const chunk of response.body as AsyncIterable<Buffer>) chunks.push(Buffer.from(chunk));
      text = Buffer.concat(chunks).toString('utf8');
    }
    return { status: response.status, ok: response.ok, text };
  },
};

export interface UpdateCheckOptions extends Pick<BundleCommandOptions, 'json' | 'log'> {
  deps?: UpstreamDeps;
}

export async function runCheckUpdates(fs: VaultFs, options: UpdateCheckOptions): Promise<void> {
  const statuses = await collectUpdateStatuses(fs, options.deps ?? defaultDeps);

  if (options.json) {
    options.log(JSON.stringify({ bundles: statuses }, null, 2));
    return;
  }
  if (statuses.length === 0) {
    options.log('No bundles installed.');
    return;
  }
  for (const status of statuses) {
    options.log(formatStatus(status));
  }
  const available = statuses.filter((status) => status.kind === 'available');
  options.log('');
  options.log(available.length > 0
    ? `${available.length} update(s) available — install with: knowlery bundle update <id> (or --all)`
    : 'Everything checkable is up to date.');
}

function formatStatus(status: UpdateStatus): string {
  switch (status.kind) {
    case 'available': return `${status.id}  v${status.installed} → v${status.latest} available`;
    case 'current': return `${status.id}  v${status.installed} — up to date`;
    case 'unchecked': return `${status.id}  v${status.installed} — unchecked (${status.reason})`;
    case 'skipped': return `${status.id}  v${status.installed} — skipped (${status.reason})`;
    case 'unreachable': return `${status.id}  v${status.installed} — unreachable (${status.reason})`;
  }
}

export interface UpdateRunOptions extends Pick<BundleCommandOptions, 'json' | 'log' | 'force' | 'root'> {
  target?: string;
  all?: boolean;
  deps?: UpstreamDeps;
  /** The install step, injectable for tests; defaults to the F1 remote-install path. */
  install?: (url: string) => Promise<void>;
}

export async function runBundleUpdate(fs: VaultFs, options: UpdateRunOptions): Promise<void> {
  if (!options.target && !options.all) {
    throw new CliError('Usage: knowlery bundle update <bundle-id> | --all  [--dir <vault>] [--force]', 2);
  }
  const registry = await readInstalledBundles(fs);
  const ids = options.all ? Object.keys(registry.bundles) : [options.target!];
  if (!options.all && !registry.bundles[options.target!]) {
    const installed = Object.keys(registry.bundles);
    throw new CliError(
      `No installed bundle named "${options.target}".${installed.length > 0 ? ` Installed: ${installed.join(', ')}` : ' Nothing is installed.'}`,
    );
  }

  const deps = options.deps ?? defaultDeps;
  let failures = 0;
  for (const id of ids) {
    const entry = registry.bundles[id];
    const status = await updateStatusFor(id, entry, deps);
    if (status.kind !== 'available') {
      options.log(formatStatus(status));
      if (status.kind === 'skipped' && !options.all) {
        throw new CliError(
          'This bundle\'s source is private — install gh (https://cli.github.com) and `gh auth login`, '
          + 'or download the new release in your browser and `knowlery bundle install <file>`.',
        );
      }
      continue;
    }

    // Local-modification protection (spec §4.3.3): the Library copy must still
    // match what install wrote, or the update would silently destroy edits.
    const changed = await modifiedFiles(fs, entry);
    if (changed.length > 0 && !options.force) {
      options.log(`${id}: ${changed.length} file(s) changed since install:`);
      for (const file of changed) options.log(`  ${file}`);
      throw new CliError(
        `${id} was modified locally — updating would overwrite these edits. `
        + 'Move your notes into your own pages (installed knowledge is referenced, not edited), or pass --force to overwrite.',
      );
    }

    options.log(`${id}: updating v${status.installed} → v${status.latest}…`);
    if (!options.install) throw new CliError('internal: update requires an install step');
    try {
      await options.install(status.url);
    } catch (error) {
      failures += 1;
      options.log(`${id}: update failed — the installed v${status.installed} is untouched. (${error instanceof Error ? error.message : String(error)})`);
      if (!options.all) throw error;
    }
  }
  if (failures > 0) throw new CliError(`${failures} update(s) failed.`, 1);
}
