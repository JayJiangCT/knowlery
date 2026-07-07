import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * Remote bundle sources (spec 0.9 f1): the bytes-arrival step, and only that.
 * Downloads a zip to a temp file so the caller can run the identical local install
 * pipeline on it. Pure node — shared by the CLI shell and the (desktop-only)
 * plugin modal. Auth is never handled here: public URLs fetch anonymously, private
 * GitHub sources delegate to the user's own `gh` login (plan: Knowlery never
 * manages credentials; `gh` is an accelerator, never a prerequisite).
 */

export interface RemoteFetchResult {
  status: number;
  ok: boolean;
  body: NodeJS.ReadableStream | ReadableStream<Uint8Array> | null;
}

export interface RemoteSourceOptions {
  /**
   * Transport, supplied by the shell: the CLI passes node fetch, the plugin
   * passes Obsidian's requestUrl (which bypasses renderer CORS). The core
   * deliberately has no default — neither transport is correct for both shells.
   */
  fetchImpl: (url: string) => Promise<RemoteFetchResult>;
  /** sha256 of the artifact, `sha256-<hex>` or bare hex; checked before anything parses the bytes. */
  verify?: string;
  log?: (line: string) => void;
  /** Injectable `gh` runner for tests; defaults to spawning `gh` from PATH. */
  ghRunner?: (args: string[]) => Promise<{ ok: boolean; error?: string }>;
}

export class RemoteSourceError extends Error {}

export function isRemoteSource(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

interface GithubReleaseAsset {
  owner: string;
  repo: string;
  tag: string;
  file: string;
}

/** GitHub release-asset URL shape — the only shape the `gh` tier applies to. */
export function parseGithubReleaseAssetUrl(url: string): GithubReleaseAsset | null {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/([^/?#]+)$/i.exec(url);
  if (!match) return null;
  return { owner: match[1], repo: match[2], tag: match[3], file: decodeURIComponent(match[4]) };
}

export interface DownloadedBundle {
  /** Absolute path of the downloaded zip inside the temp dir. */
  zipPath: string;
  /** Removes the temp dir; call in a finally. */
  cleanup: () => Promise<void>;
}

export async function downloadRemoteBundle(url: string, options: RemoteSourceOptions): Promise<DownloadedBundle> {
  const log = options.log ?? (() => {});
  const parsed = parseUrl(url);
  if (parsed.username || parsed.password) {
    throw new RemoteSourceError(
      'URLs with embedded credentials are not supported. Knowlery never handles auth secrets — '
      + 'for private GitHub sources, log in with `gh auth login` and retry.',
    );
  }
  if (parsed.protocol === 'http:') {
    log('Warning: plain http — the transfer is not encrypted. Fine on a trusted LAN; pair with --verify when in doubt.');
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'knowlery-remote-'));
  const cleanup = async () => {
    await rm(tempDir, { recursive: true, force: true });
  };

  try {
    const zipPath = join(tempDir, remoteFileName(parsed));
    await fetchToFile(url, zipPath, options, log);
    await verifyIfRequested(zipPath, options.verify);
    return { zipPath, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

function parseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new RemoteSourceError(`Not a valid URL: ${url}`);
  }
}

function remoteFileName(parsed: URL): string {
  const last = parsed.pathname.split('/').filter(Boolean).pop() ?? 'bundle.zip';
  const safe = decodeURIComponent(last).replace(/[^A-Za-z0-9._-]/g, '_');
  return safe || 'bundle.zip';
}

async function fetchToFile(
  url: string,
  destination: string,
  options: RemoteSourceOptions,
  log: (line: string) => void,
): Promise<void> {
  let response: RemoteFetchResult;
  try {
    response = await options.fetchImpl(url);
  } catch (error) {
    throw new RemoteSourceError(`Could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (response.ok && response.body) {
    await writeBody(response.body, destination);
    return;
  }

  // GitHub answers 404 for unauthorized private assets (it never reveals
  // existence). Only that exact shape earns the gh tier (spec §4.2).
  const asset = parseGithubReleaseAssetUrl(url);
  if (asset && (response.status === 404 || response.status === 403)) {
    await downloadViaGh(asset, destination, options, log);
    return;
  }

  throw new RemoteSourceError(`Download failed: HTTP ${response.status} from ${url}`);
}

async function downloadViaGh(
  asset: GithubReleaseAsset,
  destination: string,
  options: RemoteSourceOptions,
  log: (line: string) => void,
): Promise<void> {
  const ghRunner = options.ghRunner ?? defaultGhRunner;
  const result = await ghRunner([
    'release', 'download', asset.tag,
    '--repo', `${asset.owner}/${asset.repo}`,
    '--pattern', asset.file,
    '--dir', join(destination, '..'),
  ]);
  if (!result.ok) {
    throw new RemoteSourceError(
      'Anonymous download was refused (the source is private or does not exist), and the gh CLI '
      + `could not retrieve it${result.error ? ` (${result.error.trim()})` : ''}.\n`
      + 'Without gh, use your browser instead — your logged-in session is the credential:\n'
      + `  1. Open https://github.com/${asset.owner}/${asset.repo}/releases/tag/${asset.tag}\n`
      + `  2. Download ${asset.file}\n`
      + '  3. knowlery bundle install <downloaded-file>\n'
      + 'To automate next time: install gh (https://cli.github.com) and run `gh auth login`.',
    );
  }
  // gh writes the asset under its own name; normalize to the expected destination.
  const dir = join(destination, '..');
  const files = await readdir(dir);
  if (!files.includes(asset.file)) {
    throw new RemoteSourceError(`gh reported success but ${asset.file} was not downloaded.`);
  }
  if (join(dir, asset.file) !== destination) {
    const { rename } = await import('node:fs/promises');
    await rename(join(dir, asset.file), destination);
  }
  log('Anonymous fetch was refused — retrieved via your gh login instead.');
}

async function defaultGhRunner(args: string[]): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    execFile('gh', args, { timeout: 120_000 }, (error, _stdout, stderr) => {
      if (!error) resolve({ ok: true });
      else if ((error as NodeJS.ErrnoException).code === 'ENOENT') resolve({ ok: false, error: 'gh is not installed' });
      else resolve({ ok: false, error: stderr || error.message });
    });
  });
}

async function writeBody(
  body: NodeJS.ReadableStream | ReadableStream<Uint8Array>,
  destination: string,
): Promise<void> {
  const source = typeof (body as ReadableStream<Uint8Array>).getReader === 'function'
    ? Readable.fromWeb(body as import('node:stream/web').ReadableStream<Uint8Array>)
    : (body as NodeJS.ReadableStream);
  await pipeline(source, createWriteStream(destination));
}

/** Also used directly for local files — --verify composes with forwarded zips. */
export async function verifyFileIntegrity(zipPath: string, verify?: string): Promise<void> {
  return verifyIfRequested(zipPath, verify);
}

async function verifyIfRequested(zipPath: string, verify?: string): Promise<void> {
  if (!verify) return;
  const expected = verify.replace(/^sha256-/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expected)) {
    throw new RemoteSourceError(`--verify expects a sha256 hex digest (64 hex chars), got: ${verify}`);
  }
  const actual = createHash('sha256').update(await readFile(zipPath)).digest('hex');
  if (actual !== expected) {
    throw new RemoteSourceError(
      `Integrity check failed — the downloaded bytes do not match --verify.\n  expected sha256-${expected}\n  actual   sha256-${actual}\nNothing was installed.`,
    );
  }
}
