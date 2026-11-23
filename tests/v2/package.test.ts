import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { buildPackage, PackageBuildError } from '../../src/v2/package/build';
import { SKILLS } from '../../src/v2/skills';
import { KIT_VERSION } from '../../src/v2/version';

const execFileAsync = promisify(execFile);

const EXPECTED_FILES = [
  'LICENSE',
  'README.md',
  'knowlery.mjs',
  'package.json',
  'skills/knowlery-answer/SKILL.md',
  'skills/knowlery-compile/SKILL.md',
  'skills/knowlery-maintain/SKILL.md',
];

async function listFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(rel: string): Promise<void> {
    const full = rel ? join(dir, rel) : dir;
    const info = await lstat(full);
    if (info.isDirectory()) {
      for (const name of (await readdir(full)).sort()) {
        await walk(rel ? `${rel}/${name}` : name);
      }
    } else {
      out.push(rel);
    }
  }
  await walk('');
  return out.sort();
}

describe('v2 release package build', () => {
  let workDir: string;
  let outDir: string;
  let rootPkgBefore: Buffer;

  beforeAll(async () => {
    rootPkgBefore = await readFile(join(process.cwd(), 'package.json'));
    workDir = await realpath(await mkdtemp(join(tmpdir(), 'knowlery-v2-pkg-')));
    outDir = join(workDir, 'out');
    await buildPackage(outDir);
  });

  afterAll(async () => {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('writes the exact seven files, matching package.json, LICENSE, and README', async () => {
    expect(await listFiles(outDir)).toEqual(EXPECTED_FILES);

    const rootPkg = JSON.parse(rootPkgBefore.toString('utf8')) as {
      dependencies: Record<string, string>;
    };
    const expectedPdfjs = rootPkg.dependencies['pdfjs-dist'];
    const rawPkg = await readFile(join(outDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(rawPkg) as Record<string, unknown>;

    expect(pkg).toEqual({
      name: 'knowlery',
      version: KIT_VERSION,
      description: 'Turns a folder of files into a Markdown wiki that AI agents compile, maintain and answer from.',
      license: 'MIT',
      author: 'Jay Jiang',
      repository: { type: 'git', url: 'git+https://github.com/JayJiangCT/knowlery.git' },
      bin: { knowlery: 'knowlery.mjs' },
      files: ['knowlery.mjs', 'skills', 'README.md', 'LICENSE'],
      engines: { node: '>=20' },
      dependencies: { 'pdfjs-dist': expectedPdfjs },
      publishConfig: { tag: 'next' },
      pi: { skills: ['./skills'] },
    });
    expect(pkg.version).toBe('2.0.0');
    expect(Object.prototype.hasOwnProperty.call(pkg, 'keywords')).toBe(false);
    expect(rawPkg).toBe(`${JSON.stringify(pkg, null, 2)}\n`);

    const rootLicense = await readFile(join(process.cwd(), 'LICENSE'));
    expect(await readFile(join(outDir, 'LICENSE'))).toEqual(rootLicense);

    const readme = await readFile(join(outDir, 'README.md'), 'utf8');
    expect(readme).toContain(`pi install npm:knowlery@${KIT_VERSION}`);
  });

  it('copies each SKILL.md byte for byte with no extra skill folders', async () => {
    const skillFolders = (await readdir(join(outDir, 'skills'))).sort();
    expect(skillFolders).toEqual(SKILLS.map((s) => s.name).sort());
    for (const skill of SKILLS) {
      const content = await readFile(join(outDir, 'skills', skill.name, 'SKILL.md'), 'utf8');
      expect(content).toBe(skill.text);
    }
  });

  it('produces a standalone knowlery.mjs that runs --version, init, and inventory', async () => {
    const cliPath = join(outDir, 'knowlery.mjs');

    const versionRun = await execFileAsync(process.execPath, [cliPath, '--version'], {
      cwd: workDir,
      timeout: 15000,
    });
    expect(versionRun.stdout).toBe('knowlery 2.0.0 (kf 2.0)\n');
    expect(versionRun.stderr).toBe('');

    const kbDir = join(workDir, 'kb');
    await mkdir(join(kbDir, 'Notes'), { recursive: true });
    await writeFile(join(kbDir, 'Notes/note.md'), '# Note\n\nHello.\n', 'utf8');

    const initRun = await execFileAsync(process.execPath, [cliPath, '--dir', kbDir, 'init'], {
      cwd: workDir,
      timeout: 15000,
    });
    expect(initRun.stderr).toBe('');

    const invRun = await execFileAsync(process.execPath, [cliPath, '--dir', kbDir, 'inventory', '--json'], {
      cwd: workDir,
      timeout: 15000,
    });
    expect(invRun.stderr).toBe('');
    const inv = JSON.parse(invRun.stdout) as { ok: boolean; items: Array<{ path: string }> };
    expect(inv.ok).toBe(true);
    expect(inv.items.map((item) => item.path)).toContain('Notes/note.md');
  });

  it('refuses a non-empty output directory and leaves existing files untouched', async () => {
    const occupiedDir = join(workDir, 'occupied');
    await mkdir(occupiedDir, { recursive: true });
    const sentinelPath = join(occupiedDir, 'keep.txt');
    const sentinelBytes = Buffer.from('do not touch\n');
    await writeFile(sentinelPath, sentinelBytes);

    await expect(buildPackage(occupiedDir)).rejects.toThrow(PackageBuildError);
    expect(await readFile(sentinelPath)).toEqual(sentinelBytes);
    expect(await readdir(occupiedDir)).toEqual(['keep.txt']);
  });

  it('leaves the root package.json byte-identical after building', async () => {
    const rootPkgAfter = await readFile(join(process.cwd(), 'package.json'));
    expect(rootPkgAfter).toEqual(rootPkgBefore);
  });
});
