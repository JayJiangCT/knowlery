import { execFile } from 'node:child_process';
import { compareVersions } from './registry';
import { parseGithubReleaseAssetUrl } from './remote-source';

/**
 * The upstream protocol (spec 0.9 f3, §4.1 — plan-binding): "latest published
 * version of this bundle at its source". GitHub Releases is the only v1
 * implementation; a future hosted platform slots in as a second one without
 * touching the subscription mechanics.
 */

export type UpstreamAnswer =
  | { kind: 'version'; version: string; url: string }
  | { kind: 'unreachable'; detail: string }
  | { kind: 'needs-auth' };

export interface Upstream {
  latest(): Promise<UpstreamAnswer>;
}

export interface UpstreamDeps {
  /** Shell-supplied transport for anonymous API calls (CLI: nodeFetch-based; plugin: requestUrl-based). */
  fetchText: (url: string) => Promise<{ status: number; ok: boolean; text: string }>;
  /** Injectable gh api runner; defaults to spawning `gh` from PATH. */
  ghApi?: (path: string) => Promise<{ ok: boolean; stdout: string; error?: string }>;
}

/** Resolve a recorded install source to its upstream, or null when the source carries no version protocol. */
export function upstreamFor(bundleId: string, sourceUrl: string, deps: UpstreamDeps): Upstream | null {
  const asset = parseGithubReleaseAssetUrl(sourceUrl);
  if (!asset) return null;
  return new GithubReleasesUpstream(bundleId, asset.owner, asset.repo, deps);
}

interface ReleaseRecord {
  tag_name?: string;
  assets?: Array<{ name?: string; browser_download_url?: string }>;
}

class GithubReleasesUpstream implements Upstream {
  constructor(
    private bundleId: string,
    private owner: string,
    private repo: string,
    private deps: UpstreamDeps,
  ) {}

  async latest(): Promise<UpstreamAnswer> {
    const releases = await this.listReleases();
    if (releases.kind !== 'releases') return releases;

    // Only this bundle's tags count — a multi-bundle shelf carries other
    // bundles' versions too (spec §4.1).
    const prefix = `${this.bundleId}-v`;
    let best: { version: string; url: string } | null = null;
    for (const release of releases.records) {
      const tag = release.tag_name ?? '';
      if (!tag.startsWith(prefix)) continue;
      const version = tag.slice(prefix.length);
      const zip = (release.assets ?? []).find((asset) => asset.name?.endsWith('.zip') && asset.browser_download_url);
      if (!zip?.browser_download_url) continue;
      if (!best || compareVersions(version, best.version) > 0) {
        best = { version, url: zip.browser_download_url };
      }
    }
    if (!best) return { kind: 'unreachable', detail: `no ${prefix}* releases found in ${this.owner}/${this.repo}` };
    return { kind: 'version', ...best };
  }

  private async listReleases(): Promise<{ kind: 'releases'; records: ReleaseRecord[] } | UpstreamAnswer> {
    const apiPath = `repos/${this.owner}/${this.repo}/releases?per_page=100`;

    // Tier 1: anonymous — public shelves never need gh (the F1 tiering).
    try {
      const response = await this.deps.fetchText(`https://api.github.com/${apiPath}`);
      if (response.ok) return { kind: 'releases', records: parseReleases(response.text) };
      if (response.status !== 404 && response.status !== 403) {
        return { kind: 'unreachable', detail: `GitHub API answered ${response.status}` };
      }
    } catch (error) {
      return { kind: 'unreachable', detail: error instanceof Error ? error.message : String(error) };
    }

    // Tier 2: the receiver's own gh login (404/403 = private or missing).
    const ghApi = this.deps.ghApi ?? defaultGhApi;
    const viaGh = await ghApi(apiPath);
    if (viaGh.ok) return { kind: 'releases', records: parseReleases(viaGh.stdout) };
    if (viaGh.error === 'gh-not-installed') return { kind: 'needs-auth' };
    return { kind: 'unreachable', detail: viaGh.error ?? 'gh api failed' };
  }
}

function parseReleases(text: string): ReleaseRecord[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as ReleaseRecord[]) : [];
  } catch {
    return [];
  }
}

function defaultGhApi(path: string): Promise<{ ok: boolean; stdout: string; error?: string }> {
  return new Promise((resolve) => {
    execFile('gh', ['api', path], { timeout: 60_000 }, (error, stdout, stderr) => {
      if (!error) resolve({ ok: true, stdout });
      else if ((error as NodeJS.ErrnoException).code === 'ENOENT') resolve({ ok: false, stdout: '', error: 'gh-not-installed' });
      else resolve({ ok: false, stdout, error: stderr || error.message });
    });
  });
}
