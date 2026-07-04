import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { runInit } from '../../src/cli/commands/init';
import { runBundleCommand } from '../../src/cli/commands/bundle';
import { CliError } from '../../src/cli/commands/shared';
import { nodeVaultFs } from '../../src/platform/node-fs';

const silent = () => {};

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    okfVersion: '0.1',
    id: 'jay.drone-delivery',
    title: 'Drone Delivery',
    version: '0.1.0',
    creator: { name: 'Jay', url: '' },
    releasedAt: '2026-07-02T00:00:00.000Z',
    entrypoint: 'index.md',
    contentHash: 'sha256-abc',
    license: 'personal',
    knowleryVersion: '0.5.0',
    conceptCount: 1,
    ...overrides,
  };
}

const GOOD_FILES: Record<string, string> = {
  'knowlery-bundle.json': JSON.stringify(manifest()),
  'index.md': '---\nokf_version: "0.1"\n---\n\n# Drone Delivery\n',
  'concepts/foo.md':
    '---\ntype: Concept\ntitle: Foo\ndescription: A thing\ndomain: delivery\ntimestamp: 2026-07-01T00:00:00.000Z\n---\n\nBody.',
};

async function withWorkspace<T>(run: (root: string, workDir: string) => Promise<T>): Promise<T> {
  const workDir = await mkdtemp(join(tmpdir(), 'knowlery-bundle-'));
  const root = join(workDir, 'kb');
  try {
    await runInit(nodeVaultFs(root), { platform: 'claude-code', name: 'KB', prompt: null, log: silent });
    return await run(root, workDir);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function writeBundleFolder(workDir: string, files: Record<string, string> = GOOD_FILES): Promise<string> {
  const bundleDir = join(workDir, 'bundle-src');
  for (const [path, content] of Object.entries(files)) {
    const full = join(bundleDir, path);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, content);
  }
  return bundleDir;
}

describe('knowlery bundle install (spec 0.7 f4, §5.1-2)', () => {
  it('installs from a folder: Library populated, registry written, KNOWLEDGE.md block added', async () => {
    await withWorkspace(async (root, workDir) => {
      const fs = nodeVaultFs(root);
      const source = await writeBundleFolder(workDir);

      const lines: string[] = [];
      await runBundleCommand(fs, { sub: 'install', arg: source, log: (l) => lines.push(l) });
      expect(lines.join('\n')).toContain('Installed jay.drone-delivery v0.1.0');

      await stat(join(root, 'Library/jay.drone-delivery/concepts/foo.md'));
      const registry = JSON.parse(await readFile(join(root, '.knowlery/bundles.json'), 'utf8'));
      expect(registry.bundles['jay.drone-delivery'].conformance).toBe('passed');
      expect(await readFile(join(root, 'KNOWLEDGE.md'), 'utf8')).toContain('KNOWLERY:INSTALLED_BUNDLES:BEGIN');
    });
  });

  it('installs from a zip', async () => {
    await withWorkspace(async (root, workDir) => {
      const zip = new JSZip();
      for (const [path, content] of Object.entries(GOOD_FILES)) zip.file(path, content);
      const zipPath = join(workDir, 'bundle.zip');
      await writeFile(zipPath, await zip.generateAsync({ type: 'nodebuffer' }));

      await runBundleCommand(nodeVaultFs(root), { sub: 'install', arg: zipPath, log: silent });
      await stat(join(root, 'Library/jay.drone-delivery/index.md'));
    });
  });

  it('blocks a same-version reinstall without --force and hints at the flag', async () => {
    await withWorkspace(async (root, workDir) => {
      const fs = nodeVaultFs(root);
      const source = await writeBundleFolder(workDir);
      await runBundleCommand(fs, { sub: 'install', arg: source, log: silent });

      const error = await runBundleCommand(fs, { sub: 'install', arg: source, log: silent })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('--force');

      await expect(
        runBundleCommand(fs, { sub: 'install', arg: source, force: true, log: silent }),
      ).resolves.toBeUndefined();
    });
  });

  it('gates on conformance failures unless --skip-conformance, recording skipped', async () => {
    await withWorkspace(async (root, workDir) => {
      const fs = nodeVaultFs(root);
      const source = await writeBundleFolder(workDir, {
        ...GOOD_FILES,
        'concepts/bad.md': 'no frontmatter at all',
      });

      const error = await runBundleCommand(fs, { sub: 'install', arg: source, log: silent })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('--skip-conformance');

      await runBundleCommand(fs, { sub: 'install', arg: source, skipConformance: true, log: silent });
      const registry = JSON.parse(await readFile(join(root, '.knowlery/bundles.json'), 'utf8'));
      expect(registry.bundles['jay.drone-delivery'].conformance).toBe('skipped');
    });
  });
});

describe('knowlery bundle list / uninstall (spec 0.7 f4, §5.1/§5.3)', () => {
  it('lists installed bundles and uninstalls cleanly', async () => {
    await withWorkspace(async (root, workDir) => {
      const fs = nodeVaultFs(root);
      await runBundleCommand(fs, { sub: 'install', arg: await writeBundleFolder(workDir), log: silent });

      const listLines: string[] = [];
      await runBundleCommand(fs, { sub: 'list', log: (l) => listLines.push(l) });
      expect(listLines.join('\n')).toContain('jay.drone-delivery v0.1.0');

      const jsonLines: string[] = [];
      await runBundleCommand(fs, { sub: 'list', json: true, log: (l) => jsonLines.push(l) });
      expect(JSON.parse(jsonLines.join('\n')).bundles['jay.drone-delivery'].title).toBe('Drone Delivery');

      await runBundleCommand(fs, { sub: 'uninstall', arg: 'jay.drone-delivery', log: silent });
      await expect(stat(join(root, 'Library/jay.drone-delivery'))).rejects.toThrow();
      expect(await readFile(join(root, 'KNOWLEDGE.md'), 'utf8')).not.toContain('KNOWLERY:INSTALLED_BUNDLES:BEGIN');

      const emptyLines: string[] = [];
      await runBundleCommand(fs, { sub: 'list', log: (l) => emptyLines.push(l) });
      expect(emptyLines.join('\n')).toContain('No bundles installed.');
    });
  });

  it('rejects an unknown bundle id with an explicit message', async () => {
    await withWorkspace(async (root) => {
      const error = await runBundleCommand(nodeVaultFs(root), { sub: 'uninstall', arg: 'nope', log: silent })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('No installed bundle named "nope"');
    });
  });
});

describe('knowlery bundle gates (spec 0.7 f4, §5.4)', () => {
  it('requires an initialized workspace', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'knowlery-bundle-uninit-'));
    try {
      const error = await runBundleCommand(nodeVaultFs(join(workDir, 'empty')), { sub: 'list', log: silent })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).message).toContain('knowlery init');
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('rejects unknown subcommands and missing arguments with usage', async () => {
    await withWorkspace(async (root) => {
      const fs = nodeVaultFs(root);
      const unknown = await runBundleCommand(fs, { sub: 'frobnicate', log: silent }).catch((e: unknown) => e);
      expect((unknown as CliError).exitCode).toBe(2);

      const missing = await runBundleCommand(fs, { sub: 'install', log: silent }).catch((e: unknown) => e);
      expect((missing as CliError).exitCode).toBe(2);
      expect((missing as CliError).message).toContain('Missing bundle source');
    });
  });
});
