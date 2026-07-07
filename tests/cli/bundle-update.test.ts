import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/commands/init';
import { runBundleUpdate, runCheckUpdates } from '../../src/cli/commands/bundle-update';
import { CliError } from '../../src/cli/commands/shared';
import { nodeVaultFs } from '../../src/platform/node-fs';
import { loggingVaultFs } from '../../src/core/vault-fs';
import { installBundle } from '../../src/core/okf/install';
import { upstreamFor } from '../../src/core/okf/upstream';
import type { UpstreamDeps } from '../../src/core/okf/upstream';
import type { BundleSourceEntry } from '../../src/core/okf/install-scan';

const silent = () => {};

/**
 * Spec 0.9 f3, §5: the update-loop safety properties over scripted transports —
 * no network, no gh. Staged-replacement clauses live in okf-install.test.ts's
 * domain but are asserted here where the update path exercises them.
 */

function bundleEntries(id: string, version: string, body = 'Body.'): BundleSourceEntry[] {
  return [
    {
      path: 'knowlery-bundle.json',
      content: JSON.stringify({
        schemaVersion: 1, okfVersion: '0.1', id, title: 'Pack',
        version, creator: { name: 'Jay', url: '' },
        releasedAt: '2026-07-07T00:00:00.000Z', entrypoint: 'index.md',
        contentHash: `sha256-${version}`, license: 'personal', knowleryVersion: '0.8.0', conceptCount: 1,
      }),
    },
    { path: 'index.md', content: '---\nokf_version: "0.1"\n---\n\n# Pack\n' },
    {
      path: 'concepts/thing.md',
      content: `---\ntype: Concept\ntitle: Thing\ndescription: A thing\ndomain: x\ntimestamp: 2026-07-01T00:00:00.000Z\n---\n\n${body}`,
    },
  ];
}

const SOURCE_URL = 'https://github.com/team/shelf/releases/download/jay.pack-v1.0.0/pack.zip';

/** Scripted upstream deps: GitHub API answers from a fixture release list. */
function scriptedDeps(releases: Array<{ tag: string; asset?: string }>, options: { status?: number; ghAnswer?: 'missing' | Array<{ tag: string; asset?: string }> } = {}): UpstreamDeps {
  const toRecords = (list: Array<{ tag: string; asset?: string }>) => list.map((release) => ({
    tag_name: release.tag,
    assets: [{ name: 'pack.zip', browser_download_url: release.asset ?? `https://github.com/team/shelf/releases/download/${release.tag}/pack.zip` }],
  }));
  return {
    fetchText: async () => options.status
      ? { status: options.status, ok: false, text: '' }
      : { status: 200, ok: true, text: JSON.stringify(toRecords(releases)) },
    ghApi: async () => {
      if (options.ghAnswer === 'missing') return { ok: false, stdout: '', error: 'gh-not-installed' };
      if (Array.isArray(options.ghAnswer)) return { ok: true, stdout: JSON.stringify(toRecords(options.ghAnswer)) };
      return { ok: false, stdout: '', error: 'boom' };
    },
  };
}

async function withInstalled<T>(run: (root: string) => Promise<T>): Promise<T> {
  const workDir = await mkdtemp(join(tmpdir(), 'knowlery-update-'));
  const root = join(workDir, 'kb');
  try {
    const fs = nodeVaultFs(root);
    await runInit(fs, { platform: 'claude-code', name: 'KB', prompt: null, log: silent });
    await installBundle(fs, bundleEntries('jay.pack', '1.0.0'), { source: SOURCE_URL, skipConformanceGate: true });
    return await run(root);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

describe('check-updates (spec 0.9 f3, §5)', () => {
  it('§5.1 is read-only across all outcome kinds and exits normally', async () => {
    await withInstalled(async (root) => {
      const inner = nodeVaultFs(root);
      // Also register a non-GitHub source for the unchecked outcome.
      await installBundle(inner, bundleEntries('plain.pack', '1.0.0'), { source: '/tmp/local.zip', skipConformanceGate: true });
      const { fs, writes } = loggingVaultFs(inner);

      for (const deps of [
        scriptedDeps([{ tag: 'jay.pack-v2.0.0' }]),                    // available
        scriptedDeps([{ tag: 'jay.pack-v1.0.0' }]),                    // current
        scriptedDeps([], { status: 404, ghAnswer: 'missing' }),        // skipped (private, no gh)
        scriptedDeps([], { status: 500 }),                             // unreachable
      ]) {
        await runCheckUpdates(fs, { log: silent, deps });
      }
      expect(writes).toEqual([]);
    });
  });

  it('§5.2 tag filtering: other bundles on the shelf never count', async () => {
    await withInstalled(async (root) => {
      const deps = scriptedDeps([
        { tag: 'other.bundle-v9.9.9' },
        { tag: 'jay.pack-v1.3.0' },
        { tag: 'jay.pack-v1.2.0' },
      ]);
      const lines: string[] = [];
      await runCheckUpdates(nodeVaultFs(root), { log: (line) => lines.push(line), deps });
      const text = lines.join('\n');
      expect(text).toContain('jay.pack  v1.0.0 → v1.3.0 available');
      expect(text).not.toContain('9.9.9');
    });
  });

  it('§5.8 numeric comparison: 1.10.0 beats 1.9.0', async () => {
    await withInstalled(async (root) => {
      const deps = scriptedDeps([{ tag: 'jay.pack-v1.9.0' }, { tag: 'jay.pack-v1.10.0' }]);
      const lines: string[] = [];
      await runCheckUpdates(nodeVaultFs(root), { log: (line) => lines.push(line), deps });
      expect(lines.join('\n')).toContain('→ v1.10.0 available');
    });
  });

  it('non-GitHub sources report unchecked, not an error', async () => {
    await withInstalled(async (root) => {
      const fs = nodeVaultFs(root);
      await installBundle(fs, bundleEntries('plain.pack', '1.0.0'), { source: '/tmp/local.zip', skipConformanceGate: true });
      const lines: string[] = [];
      await runCheckUpdates(fs, { log: (line) => lines.push(line), deps: scriptedDeps([{ tag: 'jay.pack-v1.0.0' }]) });
      expect(lines.join('\n')).toContain('plain.pack  v1.0.0 — unchecked (no version protocol for this source)');
    });
  });
});

describe('update (spec 0.9 f3, §5)', () => {
  it('§5.4 up-to-date bundle installs nothing', async () => {
    await withInstalled(async (root) => {
      const install = vi.fn();
      const lines: string[] = [];
      await runBundleUpdate(nodeVaultFs(root), {
        target: 'jay.pack', root, log: (line) => lines.push(line),
        deps: scriptedDeps([{ tag: 'jay.pack-v1.0.0' }]), install,
      });
      expect(install).not.toHaveBeenCalled();
      expect(lines.join('\n')).toContain('up to date');
    });
  });

  it('§5.3 local edits refuse without --force, naming the file with its change kind', async () => {
    await withInstalled(async (root) => {
      const fs = nodeVaultFs(root);
      await fs.write('Library/jay.pack/concepts/thing.md', 'edited body');
      await fs.write('Library/jay.pack/concepts/mine.md', '---\ntitle: Mine\n---\n\nMy note.');
      const install = vi.fn();
      const lines: string[] = [];
      const error = await runBundleUpdate(fs, {
        target: 'jay.pack', root, log: (line) => lines.push(line),
        deps: scriptedDeps([{ tag: 'jay.pack-v2.0.0' }]), install,
      }).then(() => null, (thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('modified locally');
      const text = lines.join('\n');
      expect(text).toContain('Library/jay.pack/concepts/thing.md (edited)');
      expect(text).toContain('Library/jay.pack/concepts/mine.md (added)');
      expect(install).not.toHaveBeenCalled();
      expect(await fs.read('Library/jay.pack/concepts/thing.md')).toBe('edited body');
    });
  });

  it('§5.5 a successful update rewrites version, source, and content', async () => {
    await withInstalled(async (root) => {
      const fs = nodeVaultFs(root);
      const newUrl = 'https://github.com/team/shelf/releases/download/jay.pack-v2.0.0/pack.zip';
      const install = vi.fn(async (url: string) => {
        await installBundle(fs, bundleEntries('jay.pack', '2.0.0', 'New body.'), { source: url });
      });
      await runBundleUpdate(fs, {
        target: 'jay.pack', root, log: silent,
        deps: scriptedDeps([{ tag: 'jay.pack-v2.0.0', asset: newUrl }]), install,
      });

      expect(install).toHaveBeenCalledWith(newUrl);
      const registry = JSON.parse(await fs.read('.knowlery/bundles.json')) as {
        bundles: Record<string, { version: string; source: string }>;
      };
      expect(registry.bundles['jay.pack'].version).toBe('2.0.0');
      expect(registry.bundles['jay.pack'].source).toBe(newUrl);
      expect(await fs.read('Library/jay.pack/concepts/thing.md')).toContain('New body.');
    });
  });

  it('§5.6 private source without gh: check reports skipped (exit 0), update fails with browser guidance', async () => {
    await withInstalled(async (root) => {
      const deps = scriptedDeps([], { status: 404, ghAnswer: 'missing' });
      const lines: string[] = [];
      await runCheckUpdates(nodeVaultFs(root), { log: (line) => lines.push(line), deps });
      expect(lines.join('\n')).toContain('skipped (private source — gh needed)');

      const error = await runBundleUpdate(nodeVaultFs(root), {
        target: 'jay.pack', root, log: silent, deps, install: vi.fn(),
      }).then(() => null, (thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('browser');
    });
  });

  it('§5.7 a failing install step leaves the installed version intact (staged replacement)', async () => {
    await withInstalled(async (root) => {
      const fs = nodeVaultFs(root);
      const before = await fs.read('Library/jay.pack/concepts/thing.md');
      // Realistic failure: the actual install pipeline, with a source whose
      // staging write blows up mid-way.
      const install = async () => {
        const failing = { ...fs, write: async (path: string, content: string) => {
          if (path.includes('concepts/thing.md')) throw new Error('disk full');
          return fs.write(path, content);
        } };
        await installBundle(failing, bundleEntries('jay.pack', '2.0.0', 'New body.'), { source: 'x' });
      };
      const error = await runBundleUpdate(fs, {
        target: 'jay.pack', root, log: silent,
        deps: scriptedDeps([{ tag: 'jay.pack-v2.0.0' }]), install,
      }).then(() => null, (thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(Error);
      expect(await fs.read('Library/jay.pack/concepts/thing.md')).toBe(before);
      expect(await fs.exists('Library/.staging-jay.pack')).toBe(false);
      const registry = JSON.parse(await fs.read('.knowlery/bundles.json')) as {
        bundles: Record<string, { version: string }>;
      };
      expect(registry.bundles['jay.pack'].version).toBe('1.0.0');
    });
  });
});

describe('staged replacement mid-swap (spec 0.9 f3, §5.7)', () => {
  it('a mid-swap failure preserves the named backup and says so', async () => {
    await withInstalled(async (root) => {
      const fs = nodeVaultFs(root);
      const before = await fs.read('Library/jay.pack/concepts/thing.md');
      let renames = 0;
      const failing = { ...fs, rename: async (oldPath: string, newPath: string) => {
        renames += 1;
        if (renames === 2) throw new Error('EACCES'); // staging -> live
        return fs.rename(oldPath, newPath);
      } };
      const error = await installBundle(failing, bundleEntries('jay.pack', '2.0.0', 'New body.'), { source: 'x' })
        .then(() => null, (thrown: unknown) => thrown);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('Library/.old-jay.pack');
      expect(await fs.exists('Library/.old-jay.pack/concepts/thing.md')).toBe(true);
      expect(await fs.read('Library/.old-jay.pack/concepts/thing.md')).toBe(before);
    });
  });
});

describe('upstream protocol (spec 0.9 f3, §4.1)', () => {
  it('resolves GitHub release-asset sources only', () => {
    const deps = scriptedDeps([]);
    expect(upstreamFor('x', SOURCE_URL, deps)).not.toBeNull();
    expect(upstreamFor('x', 'https://example.com/pack.zip', deps)).toBeNull();
    expect(upstreamFor('x', '/local/path.zip', deps)).toBeNull();
  });

  it('falls back to gh api when anonymous is refused and gh is available', async () => {
    const deps = scriptedDeps([], { status: 404, ghAnswer: [{ tag: 'jay.pack-v3.0.0' }] });
    const upstream = upstreamFor('jay.pack', SOURCE_URL, deps)!;
    const answer = await upstream.latest();
    expect(answer).toMatchObject({ kind: 'version', version: '3.0.0' });
  });
});
