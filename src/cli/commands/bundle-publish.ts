import { join } from 'node:path';
import type { VaultFs } from '../../core/vault-fs';
import type { PublishConfig } from '../../types';
import { readExportScope, writeBundleMeta } from '../../core/okf/export-scope';
import { scanRisks } from '../../core/okf/risk-scan';
import { zipBundleDirectory } from '../../core/okf/zip';
import {
  IRREVERSIBILITY_STATEMENT,
  PublishError,
  assetUrl,
  buildAudienceStatement,
  buildManualChecklist,
  buildReleaseNotes,
  checkGhReady,
  collectSecondGateItems,
  createPrivateRepo,
  createRelease,
  defaultGhRunner,
  inspectRepo,
  releaseTag,
  releaseTagExists,
  sha256OfFile,
  type GhRunner,
} from '../../core/okf/publish';
import { compileScope, persistScope, printChecklist, resolveScope } from './bundle-export';
import { CliError, type Prompt } from './shared';

const PUBLISH_USAGE =
  'Usage: knowlery bundle publish <seed-concept-id> [--dir <vault>] [--repo <owner/name>] [--public] [--acknowledge-risks] [--force]';

export interface PublishCommandOptions {
  seed?: string;
  root: string;
  repo?: string;
  public?: boolean;
  acknowledgeRisks?: boolean;
  force?: boolean;
  json?: boolean;
  prompt: Prompt;
  log: (line: string) => void;
  /** Injectable for tests. */
  gh?: GhRunner;
}

/**
 * `knowlery bundle publish` (spec 0.9 f2): one deliberate command from reviewed
 * scope to a shareable URL. The review gate is identical to export's; public
 * targets add the second gate; everything GitHub-shaped is behind the gh runner.
 */
export async function runBundlePublish(fs: VaultFs, options: PublishCommandOptions): Promise<void> {
  if (!options.seed) {
    throw new CliError(`Missing seed concept id.\n${PUBLISH_USAGE}`, 2);
  }
  const gh = options.gh ?? defaultGhRunner;

  // 1. The review gate — identical to export (spec §4.1.1).
  const scope = await resolveScope(fs, options.seed, {});
  await persistScope(fs, scope);
  const unreviewed = scope.closure.items.filter((item) => item.status === 'unreviewed');
  if (unreviewed.length > 0) {
    printChecklist(scope, { json: options.json, log: options.log, jsonStatus: 'review-required' });
    if (!options.json) {
      options.log('');
      options.log(`Review before publishing: knowlery bundle review ${options.seed} --approve <id>... [--flag <id>...]`);
    }
    throw new CliError(`${unreviewed.length} item(s) unreviewed — nothing was published.`, 1);
  }

  // 2. Compile + zip, re-using the last export version (spec §4.1.2).
  const persisted = (await readExportScope(fs)).bundles[scope.bundleId];
  const version = persisted?.lastVersion ?? '0.1.0';
  const result = await compileScope(scope, version);
  await writeBundleMeta(fs, scope.bundleId, { lastVersion: version });
  const zipPath = await zipBundleDirectory(join(options.root, result.targetDir));
  const sha256 = await sha256OfFile(zipPath);

  // 3. Target resolution (spec §4.1.3).
  const repo = options.repo ?? persisted?.publish?.repo ?? await promptForRepo(options);
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new CliError(`--repo expects owner/name, got: ${repo}`);
  }
  const wantPublic = options.public === true;
  const tag = releaseTag(scope.bundleId, version);

  // 4. Preflight: gh, then repo (spec §4.1.4).
  const ready = await checkGhReady(gh);
  if (!ready.ready) {
    // Without gh we cannot know whether the repo exists; the checklist covers creation.
    options.log(buildManualChecklist({
      reason: ready.reason ?? 'gh-not-installed',
      zipPath,
      repo,
      repoExists: false,
      tag,
      sha256,
    }));
    throw new CliError('Nothing was published — gh is unavailable (manual path above).', 1);
  }

  let repoInfo = await inspectRepo(gh, repo);
  if (!repoInfo) {
    const answer = options.prompt
      ? (await options.prompt(`${repo} does not exist. Create it as a PRIVATE repo now? [y/N] `)).trim().toLowerCase()
      : 'y'; // non-TTY: an explicit --repo is the confirmation; creation is private regardless
    if (answer !== 'y' && answer !== 'yes') {
      throw new CliError('Publish cancelled — no repository.', 1);
    }
    await wrapPublishError(() => createPrivateRepo(gh, repo));
    repoInfo = (await inspectRepo(gh, repo)) ?? { exists: true, visibility: 'private', ownerType: 'user' };
    options.log(`Created ${repo} (private).`);
  }

  // 5. The second gate — public targets only (spec §4.3).
  if (wantPublic) {
    await runSecondGate(scope, options);
  }

  // 6. Release (spec §4.1.6).
  if (await releaseTagExists(gh, repo, tag)) {
    if (!options.force) {
      throw new CliError(
        `${tag} is already published to ${repo}. Bump the version at export (--bundle-version), or pass --force to replace the asset.`,
      );
    }
    await wrapPublishError(() => createRelease(gh, { repo, tag, title: '', notes: '', assetPath: zipPath, replaceExisting: true }));
  } else {
    const fileName = zipPath.split('/').pop() ?? 'bundle.zip';
    const url = assetUrl(repo, tag, fileName);
    await wrapPublishError(() => createRelease(gh, {
      repo,
      tag,
      title: `${scope.title} v${version}`,
      notes: buildReleaseNotes({ title: scope.title, version, conceptCount: result.conceptCount, sha256, url }),
      assetPath: zipPath,
      replaceExisting: false,
    }));
  }

  // Persist the target for next time (spec §4.2).
  await writeBundleMeta(fs, scope.bundleId, {
    publish: { repo, visibility: repoInfo.visibility } satisfies PublishConfig,
  });

  // 7. Audience statement (spec §4.1.7).
  const fileName = zipPath.split('/').pop() ?? 'bundle.zip';
  const url = assetUrl(repo, tag, fileName);
  if (options.json) {
    options.log(JSON.stringify({
      status: 'published',
      bundleId: scope.bundleId,
      version,
      repo,
      tag,
      url,
      sha256: `sha256-${sha256}`,
      visibility: repoInfo.visibility,
      audience: buildAudienceStatement(repo, repoInfo),
    }, null, 2));
    return;
  }
  options.log(`Published ${scope.bundleId} v${version} to ${repo} (${repoInfo.visibility}).`);
  for (const line of buildAudienceStatement(repo, repoInfo)) options.log(`  ${line}`);
  options.log(`  Share:  knowlery bundle install ${url} --verify sha256-${sha256}`);
}

async function runSecondGate(
  scope: Awaited<ReturnType<typeof resolveScope>>,
  options: PublishCommandOptions,
): Promise<void> {
  const risks = scanRisks({ pages: scope.closure.pages, rawDependencies: scope.closure.rawDependencies });
  const gateItems = collectSecondGateItems(scope.closure.items, risks);

  options.log('');
  options.log(`Publishing PUBLICLY. ${IRREVERSIBILITY_STATEMENT}`);

  if (gateItems.length === 0) {
    if (options.acknowledgeRisks || !options.prompt) return; // --public itself is the deliberate act (§4.3.3)
    const answer = (await options.prompt('Publish publicly? [y/N] ')).trim().toLowerCase();
    if (answer !== 'y' && answer !== 'yes') throw new CliError('Publish cancelled.', 1);
    return;
  }

  options.log(`These ${gateItems.length} approved item(s) carry risk hints and are about to become permanently public:`);
  for (const item of gateItems) {
    options.log(`  ${item.id} — ${item.title}`);
    for (const hint of item.hints) options.log(`    !! ${hint.kind}: ${hint.evidence}`);
  }

  if (options.acknowledgeRisks) {
    options.log(`Acknowledged via --acknowledge-risks: ${gateItems.map((item) => item.id).join(', ')}`);
    return;
  }
  if (!options.prompt) {
    throw new CliError(
      'Public publish with risk-hinted items needs explicit consent: review the list above with the user, then pass --acknowledge-risks.',
      1,
    );
  }
  const answer = (await options.prompt("Type 'publish' to confirm exposing these items publicly: ")).trim();
  if (answer !== 'publish') throw new CliError('Publish cancelled — risk items not acknowledged.', 1);
}

async function promptForRepo(options: PublishCommandOptions): Promise<string> {
  if (!options.prompt) {
    throw new CliError(
      `No publish target configured for this bundle. Pass --repo <owner/name> (it will be remembered).\n${PUBLISH_USAGE}`,
    );
  }
  const answer = (await options.prompt('Publish to which GitHub repo (owner/name)? ')).trim();
  if (!answer) throw new CliError('Publish cancelled — no repository given.', 1);
  return answer;
}

async function wrapPublishError<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PublishError) throw new CliError(error.message);
    throw error;
  }
}
