import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdtemp, readdir, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { runInit } from '../../src/cli/commands/init';
import { runBundleCommand } from '../../src/cli/commands/bundle';
import { CliError } from '../../src/cli/commands/shared';
import { nodeVaultFs } from '../../src/platform/node-fs';
import {
  RemoteSourceError,
  downloadRemoteBundle,
  parseGithubReleaseAssetUrl,
} from '../../src/core/okf/remote-source';
import { resetGhBinaryCache } from '../../src/core/okf/gh-binary';

const silent = () => {};

/**
 * Spec 0.9 f1, §5: the remote-install safety properties, on a loopback HTTP server
 * (no network in CI). The gh tier is covered both with injected runners (scoping)
 * and a real stub executable on PATH (the default runner's spawn path).
 */

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    okfVersion: '0.1',
    id: 'jay.remote-pack',
    title: 'Remote Pack',
    version: '1.0.0',
    creator: { name: 'Jay', url: '' },
    releasedAt: '2026-07-07T00:00:00.000Z',
    entrypoint: 'index.md',
    contentHash: 'sha256-remote',
    license: 'personal',
    knowleryVersion: '0.8.0',
    conceptCount: 1,
    ...overrides,
  };
}

const GOOD_FILES: Record<string, string> = {
  'knowlery-bundle.json': JSON.stringify(manifest()),
  'index.md': '---\nokf_version: "0.1"\n---\n\n# Remote Pack\n',
  'concepts/thing.md':
    '---\ntype: Concept\ntitle: Thing\ndescription: A remote thing\ndomain: remote\ntimestamp: 2026-07-01T00:00:00.000Z\n---\n\nBody.',
};

async function buildZip(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'nodebuffer' });
}

let server: Server;
let baseUrl: string;
let goodZip: Buffer;

beforeAll(async () => {
  goodZip = await buildZip(GOOD_FILES);
  const invalidZip = await buildZip({ 'readme.txt': 'not a bundle' });
  server = createServer((req, res) => {
    if (req.url === '/pack.zip') {
      res.writeHead(200);
      res.end(goodZip);
    } else if (req.url === '/invalid.zip') {
      res.writeHead(200);
      res.end(invalidZip);
    } else if (req.url === '/redirect.zip') {
      // The public-GitHub shape: asset URLs 302 to storage before serving bytes.
      res.writeHead(302, { location: '/pack.zip' });
      res.end();
    } else if (req.url === '/drop.zip') {
      res.writeHead(200, { 'content-length': String(goodZip.length) });
      res.write(goodZip.subarray(0, 100));
      res.destroy();
    } else {
      res.writeHead(404);
      res.end('nope');
    }
  });
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(() => new Promise<void>((resolvePromise) => server.close(() => resolvePromise())));

async function withWorkspace<T>(run: (root: string) => Promise<T>): Promise<T> {
  const workDir = await mkdtemp(join(tmpdir(), 'knowlery-remote-test-'));
  const root = join(workDir, 'kb');
  try {
    await runInit(nodeVaultFs(root), { platform: 'claude-code', name: 'KB', prompt: null, log: silent });
    return await run(root);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function leftoverTempDirs(): Promise<string[]> {
  return (await readdir(tmpdir())).filter((name) => name.startsWith('knowlery-remote-') && !name.startsWith('knowlery-remote-test-'));
}

describe('remote install (spec 0.9 f1, §5)', () => {
  it('installs from a served URL; registry records the URL; list shows provenance (§5.6)', async () => {
    await withWorkspace(async (root) => {
      const fs = nodeVaultFs(root);
      const url = `${baseUrl}/pack.zip`;
      const lines: string[] = [];
      await runBundleCommand(fs, { sub: 'install', arg: url, root, log: (line) => lines.push(line) });
      expect(lines.join('\n')).toContain('Installed jay.remote-pack v1.0.0');

      const registry = JSON.parse(await fs.read('.knowlery/bundles.json')) as {
        bundles: Record<string, { source: string }>;
      };
      expect(registry.bundles['jay.remote-pack'].source).toBe(url);

      const listLines: string[] = [];
      await runBundleCommand(fs, { sub: 'list', root, log: (line) => listLines.push(line) });
      expect(listLines.join('\n')).toContain('from 127.0.0.1');
    });
  });

  it('follows redirects — the public-GitHub asset shape (302 to storage)', async () => {
    await withWorkspace(async (root) => {
      const fs = nodeVaultFs(root);
      await runBundleCommand(fs, { sub: 'install', arg: `${baseUrl}/redirect.zip`, root, log: silent });
      expect(await fs.exists('Library/jay.remote-pack/index.md')).toBe(true);
    });
  });

  it('same gates remote or local: an invalid bundle fails with the identical error shape (§5.1)', async () => {
    await withWorkspace(async (root) => {
      const fs = nodeVaultFs(root);
      const localPath = join(tmpdir(), `knowlery-remote-test-local-${Date.now()}.zip`);
      await writeFile(localPath, await buildZip({ 'readme.txt': 'not a bundle' }));
      try {
        const remoteError = await runBundleCommand(fs, { sub: 'install', arg: `${baseUrl}/invalid.zip`, root, log: silent })
          .then(() => null, (thrown: unknown) => thrown);
        const localError = await runBundleCommand(fs, { sub: 'install', arg: localPath, root, log: silent })
          .then(() => null, (thrown: unknown) => thrown);

        expect(remoteError).toBeInstanceOf(CliError);
        expect(localError).toBeInstanceOf(CliError);
        expect((remoteError as CliError).message).toContain('Not a valid knowledge bundle');
        expect((localError as CliError).message).toContain('Not a valid knowledge bundle');
        expect(await fs.exists('Library')).toBe(false);
      } finally {
        await rm(localPath, { force: true });
      }
    });
  });

  it('verify-before-parse: a wrong --verify aborts with both hashes and no vault write (§5.2)', async () => {
    await withWorkspace(async (root) => {
      const fs = nodeVaultFs(root);
      const wrong = 'a'.repeat(64);
      const error = await runBundleCommand(fs, {
        sub: 'install', arg: `${baseUrl}/pack.zip`, root, verify: `sha256-${wrong}`, log: silent,
      }).then(() => null, (thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('Integrity check failed');
      expect((error as CliError).message).toContain(`sha256-${wrong}`);
      const actual = createHash('sha256').update(goodZip).digest('hex');
      expect((error as CliError).message).toContain(`sha256-${actual}`);
      expect(await fs.exists('Library')).toBe(false);
      expect(await leftoverTempDirs()).toEqual([]);
    });
  });

  it('a correct --verify passes and installs', async () => {
    await withWorkspace(async (root) => {
      const fs = nodeVaultFs(root);
      const hash = createHash('sha256').update(goodZip).digest('hex');
      await runBundleCommand(fs, { sub: 'install', arg: `${baseUrl}/pack.zip`, root, verify: hash, log: silent });
      expect(await fs.exists('Library/jay.remote-pack/index.md')).toBe(true);
    });
  });

  it('no partial state after a mid-download failure (§5.3)', async () => {
    await withWorkspace(async (root) => {
      const fs = nodeVaultFs(root);
      const error = await runBundleCommand(fs, { sub: 'install', arg: `${baseUrl}/drop.zip`, root, log: silent })
        .then(() => null, (thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(CliError);
      expect(await fs.exists('Library')).toBe(false);
      expect(await leftoverTempDirs()).toEqual([]);
    });
  });

  it('plain http warns about plaintext transport (§5.4)', async () => {
    await withWorkspace(async (root) => {
      const fs = nodeVaultFs(root);
      const lines: string[] = [];
      await runBundleCommand(fs, { sub: 'install', arg: `${baseUrl}/pack.zip`, root, log: (line) => lines.push(line) });
      expect(lines.join('\n')).toContain('plain http');
    });
  });

  it('refuses URLs with embedded credentials', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, ok: true, body: null }));
    await expect(downloadRemoteBundle('https://user:pass@example.com/pack.zip', { fetchImpl }))
      .rejects.toThrow(/embedded credentials/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('gh tier scoping (spec 0.9 f1, §5.5)', () => {
  const GH_URL = 'https://github.com/team/kb-bundles/releases/download/v1.0.0/pack.zip';
  const refused = async () => ({ status: 404, ok: false, body: null });

  it('parses only the GitHub release-asset shape', () => {
    expect(parseGithubReleaseAssetUrl(GH_URL)).toEqual({
      owner: 'team', repo: 'kb-bundles', tag: 'v1.0.0', file: 'pack.zip',
    });
    expect(parseGithubReleaseAssetUrl('https://github.com/team/kb-bundles/archive/main.zip')).toBeNull();
    expect(parseGithubReleaseAssetUrl('https://example.com/releases/download/v1/x.zip')).toBeNull();
  });

  it('a refused GitHub fetch falls back to gh and reports it', async () => {
    const lines: string[] = [];
    const ghRunner = vi.fn(async (args: string[]) => {
      const dirIndex = args.indexOf('--dir');
      await writeFile(join(args[dirIndex + 1], 'pack.zip'), goodZip);
      return { ok: true };
    });
    const downloaded = await downloadRemoteBundle(GH_URL, { fetchImpl: refused, ghRunner, log: (line) => lines.push(line) });
    try {
      expect(ghRunner).toHaveBeenCalledOnce();
      expect(ghRunner.mock.calls[0][0]).toContain('--repo');
      expect(ghRunner.mock.calls[0][0]).toContain('team/kb-bundles');
      expect(await readFile(downloaded.zipPath)).toEqual(goodZip);
      expect(lines.join('\n')).toContain('retrieved via your gh login');
    } finally {
      await downloaded.cleanup();
    }
  });

  it('never runs gh for non-GitHub URLs — a 404 is just a 404', async () => {
    const ghRunner = vi.fn(async () => ({ ok: true }));
    await expect(downloadRemoteBundle('https://example.com/pack.zip', { fetchImpl: refused, ghRunner }))
      .rejects.toThrow(/HTTP 404/);
    expect(ghRunner).not.toHaveBeenCalled();
  });

  it('never runs gh when the anonymous fetch succeeded', async () => {
    const ghRunner = vi.fn(async () => ({ ok: true }));
    const fetchImpl = async () => ({
      status: 200, ok: true,
      body: (await import('node:stream')).Readable.from([goodZip]) as unknown as NodeJS.ReadableStream,
    });
    const downloaded = await downloadRemoteBundle(GH_URL, { fetchImpl, ghRunner });
    try {
      expect(ghRunner).not.toHaveBeenCalled();
    } finally {
      await downloaded.cleanup();
    }
  });

  it('absent gh yields the browser-download guidance', async () => {
    const ghRunner = async () => ({ ok: false, error: 'gh is not installed' });
    const error = await downloadRemoteBundle(GH_URL, { fetchImpl: refused, ghRunner })
      .then(() => null, (thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(RemoteSourceError);
    const message = (error as RemoteSourceError).message;
    expect(message).toContain('use your browser');
    expect(message).toContain('https://github.com/team/kb-bundles/releases/tag/v1.0.0');
    expect(message).toContain('gh auth login');
  });

  it('the default runner spawns a real gh from PATH (stub executable)', async () => {
    const stubDir = await mkdtemp(join(tmpdir(), 'knowlery-gh-stub-'));
    const stubPath = join(stubDir, 'gh');
    // The stub copies the fixture zip into the --dir argument, like gh would.
    const fixturePath = join(stubDir, 'fixture.zip');
    await writeFile(fixturePath, goodZip);
    await writeFile(stubPath, [
      '#!/usr/bin/env node',
      "const args = process.argv.slice(2);",
      // The binary resolver probes with --version before any real call.
      "if (args.includes('--version')) { console.log('gh version 0.0-stub'); process.exit(0); }",
      "const fs = require('fs');",
      "const dir = args[args.indexOf('--dir') + 1];",
      "const pattern = args[args.indexOf('--pattern') + 1];",
      `fs.copyFileSync(${JSON.stringify(fixturePath)}, require('path').join(dir, pattern));`,
    ].join('\n'));
    await chmod(stubPath, 0o755);

    const originalPath = process.env.PATH;
    process.env.PATH = `${stubDir}:${originalPath}`;
    resetGhBinaryCache();
    try {
      const downloaded = await downloadRemoteBundle(GH_URL, { fetchImpl: refused });
      try {
        expect(await readFile(downloaded.zipPath)).toEqual(goodZip);
      } finally {
        await downloaded.cleanup();
      }
    } finally {
      process.env.PATH = originalPath;
      resetGhBinaryCache();
      await rm(stubDir, { recursive: true, force: true });
    }
  });
});
