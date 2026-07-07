import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type { RiskHint } from '../../types';
import type { ScopeItem } from './export-scope';

/**
 * Publish target operations (spec 0.9 f2). The target-independent stages —
 * review gate, second gate, compile+zip, audience statement — never see GitHub;
 * everything gh-shaped is isolated here behind an injectable runner, and a future
 * hosted platform slots in as a second target without touching the gates
 * (plan: Beyond 0.9).
 */

export class PublishError extends Error {}

export interface GhResult {
  ok: boolean;
  stdout: string;
  error?: string;
}

/** Injectable for tests; defaults to spawning `gh` from PATH. */
export type GhRunner = (args: string[]) => Promise<GhResult>;

export function defaultGhRunner(args: string[]): Promise<GhResult> {
  return new Promise((resolve) => {
    execFile('gh', args, { timeout: 300_000 }, (error, stdout, stderr) => {
      if (!error) resolve({ ok: true, stdout });
      else if ((error as NodeJS.ErrnoException).code === 'ENOENT') resolve({ ok: false, stdout: '', error: 'gh-not-installed' });
      else resolve({ ok: false, stdout, error: stderr || error.message });
    });
  });
}

// --- The second gate (spec §4.3): pure evaluation, rendered by each shell. ---

export interface SecondGateItem {
  id: string;
  title: string;
  hints: RiskHint[];
}

/** Approved items carrying risk hints — the set a public publish must re-acknowledge. */
export function collectSecondGateItems(items: ScopeItem[], risks: RiskHint[]): SecondGateItem[] {
  const byItem = new Map<string, RiskHint[]>();
  for (const risk of risks) {
    if (!byItem.has(risk.itemId)) byItem.set(risk.itemId, []);
    byItem.get(risk.itemId)!.push(risk);
  }
  return items
    .filter((item) => item.status === 'approved' && byItem.has(item.id))
    .map((item) => ({ id: item.id, title: item.title, hints: byItem.get(item.id)! }));
}

export const IRREVERSIBILITY_STATEMENT =
  'A public release is permanent: caches, mirrors, and crawlers retain it even if deleted.';

// --- GitHub target operations. ---

export interface RepoInfo {
  exists: boolean;
  visibility: 'private' | 'public';
  ownerType: 'user' | 'organization';
}

export async function checkGhReady(gh: GhRunner): Promise<{ ready: boolean; reason?: 'gh-not-installed' | 'not-authenticated' }> {
  const auth = await gh(['auth', 'status']);
  if (auth.ok) return { ready: true };
  if (auth.error === 'gh-not-installed') return { ready: false, reason: 'gh-not-installed' };
  return { ready: false, reason: 'not-authenticated' };
}

export async function inspectRepo(gh: GhRunner, repo: string): Promise<RepoInfo | null> {
  const result = await gh(['repo', 'view', repo, '--json', 'visibility,owner']);
  if (!result.ok) return null;
  try {
    const parsed = JSON.parse(result.stdout) as { visibility?: string; owner?: { type?: string } };
    return {
      exists: true,
      visibility: parsed.visibility?.toLowerCase() === 'public' ? 'public' : 'private',
      ownerType: parsed.owner?.type?.toLowerCase() === 'organization' ? 'organization' : 'user',
    };
  } catch {
    return null;
  }
}

export async function createPrivateRepo(gh: GhRunner, repo: string): Promise<void> {
  // --public never flows into repo creation: a public *repo* is a bigger
  // decision than a public *release* and is left to the owner on GitHub (§4.1.4).
  const result = await gh(['repo', 'create', repo, '--private']);
  if (!result.ok) throw new PublishError(`Could not create ${repo}: ${result.error ?? 'unknown gh error'}`);
}

export async function releaseTagExists(gh: GhRunner, repo: string, tag: string): Promise<boolean> {
  const result = await gh(['release', 'view', tag, '--repo', repo]);
  return result.ok;
}

export interface ReleaseInput {
  repo: string;
  tag: string;
  title: string;
  notes: string;
  assetPath: string;
  replaceExisting: boolean;
}

export async function createRelease(gh: GhRunner, input: ReleaseInput): Promise<void> {
  if (input.replaceExisting) {
    // --force semantics: replace the asset on the existing release.
    const upload = await gh(['release', 'upload', input.tag, input.assetPath, '--repo', input.repo, '--clobber']);
    if (!upload.ok) throw new PublishError(`Could not replace the release asset: ${upload.error ?? 'unknown gh error'}`);
    return;
  }
  const result = await gh([
    'release', 'create', input.tag, input.assetPath,
    '--repo', input.repo, '--title', input.title, '--notes', input.notes,
  ]);
  if (!result.ok) throw new PublishError(`Could not create the release: ${result.error ?? 'unknown gh error'}`);
}

// --- Target-independent output builders. ---

export async function sha256OfFile(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

export function releaseTag(bundleId: string, version: string): string {
  // Multi-bundle shelves need the id prefix (§4.1.6).
  return `${bundleId}-v${version}`;
}

export function assetUrl(repo: string, tag: string, fileName: string): string {
  return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(fileName)}`;
}

export function buildReleaseNotes(input: { title: string; version: string; conceptCount: number; sha256: string; url: string }): string {
  return [
    `${input.title} v${input.version} — a Knowlery knowledge bundle (${input.conceptCount} concept(s)).`,
    '',
    'Install:',
    '```',
    `knowlery bundle install ${input.url} --verify sha256-${input.sha256}`,
    '```',
  ].join('\n');
}

/** "Who can install this" — the grant-access step made explicit (§4.1.7). */
export function buildAudienceStatement(repo: string, info: RepoInfo): string[] {
  if (info.visibility === 'public') {
    return ['Who can install: anyone with the link.'];
  }
  if (info.ownerType === 'organization') {
    const org = repo.split('/')[0];
    return [
      `Who can install: members with read access to ${repo} (private).`,
      `Grant access: ${org} members with base Read permission already have it;`,
      `              invite others at https://github.com/${repo}/settings/access`,
    ];
  }
  return [
    `Who can install: only you and collaborators of ${repo} (private).`,
    `Grant access: invite people at https://github.com/${repo}/settings/access`,
  ];
}

/** The no-gh degradation (§4.5): every value precomputed, copy-ready. */
export function buildManualChecklist(input: {
  reason: 'gh-not-installed' | 'not-authenticated';
  zipPath: string;
  repo: string;
  repoExists: boolean;
  tag: string;
  sha256: string;
}): string {
  const lines = [
    input.reason === 'gh-not-installed'
      ? 'Publishing works best with GitHub\'s CLI — one command to install: https://cli.github.com (then `gh auth login`).'
      : 'gh is installed but not logged in — run `gh auth login`.',
    '',
    'Until then, here is the manual path (about a minute):',
    `  1. Your bundle is ready at: ${input.zipPath}`,
  ];
  if (input.repoExists) {
    lines.push(`  2. Open: https://github.com/${input.repo}/releases/new`);
  } else {
    lines.push(`  2. Create the repo (keep it PRIVATE): https://github.com/new — name it ${input.repo.split('/')[1] ?? input.repo}`);
    lines.push(`     then open: https://github.com/${input.repo}/releases/new`);
  }
  lines.push(
    `  3. Tag: ${input.tag}`,
    '  4. Drag the zip into the assets area and publish.',
    `  5. Share the asset link together with its checksum: sha256-${input.sha256}`,
  );
  return lines.join('\n');
}
