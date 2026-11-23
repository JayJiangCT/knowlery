import esbuild from 'esbuild';
import { chmod, copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMissing } from '../core/paths';
import { SKILLS } from '../skills';
import { buildPackageManifest, buildReadme } from './manifest';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const CLI_BANNER = `#!/usr/bin/env node
import { createRequire as __createRequire } from 'node:module';
const require = __createRequire(import.meta.url);`;

export class PackageBuildError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 2) {
    super(message);
    this.name = 'PackageBuildError';
    this.exitCode = exitCode;
  }
}

async function ensureEmptyOutputDir(outDir: string): Promise<string> {
  const absOutDir = resolve(outDir);
  try {
    const info = await stat(absOutDir);
    if (!info.isDirectory()) {
      throw new PackageBuildError(`Output path exists and is not a directory: ${absOutDir}`);
    }
    const entries = await readdir(absOutDir);
    if (entries.length > 0) {
      throw new PackageBuildError(`Output directory is not empty: ${absOutDir}`);
    }
  } catch (error) {
    if (error instanceof PackageBuildError) throw error;
    if (!isMissing(error)) throw error;
    await mkdir(absOutDir, { recursive: true });
  }
  return absOutDir;
}

async function readPdfjsVersion(repoRoot: string): Promise<string> {
  const raw = await readFile(join(repoRoot, 'package.json'), 'utf8');
  const parsed = JSON.parse(raw) as { dependencies?: Record<string, unknown> };
  const version = parsed.dependencies?.['pdfjs-dist'];
  if (typeof version !== 'string' || version.length === 0) {
    throw new PackageBuildError('Could not read pdfjs-dist version from root package.json.', 1);
  }
  return version;
}

export async function buildPackage(outDir: string): Promise<void> {
  if (!outDir || outDir.trim().length === 0) {
    throw new PackageBuildError('Usage: npx tsx src/v2/package/build.ts <out-dir>');
  }

  const absOutDir = await ensureEmptyOutputDir(outDir);
  const pdfjsVersion = await readPdfjsVersion(REPO_ROOT);
  const manifest = buildPackageManifest(pdfjsVersion);

  const cliOutPath = join(absOutDir, 'knowlery.mjs');
  await esbuild.build({
    entryPoints: [join(REPO_ROOT, 'src/v2/cli/bin.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    minify: false,
    outfile: cliOutPath,
    absWorkingDir: REPO_ROOT,
    external: ['pdfjs-dist', 'pdfjs-dist/*'],
    banner: { js: CLI_BANNER },
    logLevel: 'silent',
  });
  await chmod(cliOutPath, 0o755);

  await writeFile(join(absOutDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(join(absOutDir, 'README.md'), buildReadme(), 'utf8');
  await copyFile(join(REPO_ROOT, 'LICENSE'), join(absOutDir, 'LICENSE'));

  for (const skill of SKILLS) {
    const skillDir = join(absOutDir, 'skills', skill.name);
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, 'SKILL.md'), skill.text, 'utf8');
  }
}

async function runMain(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0] || args[0].startsWith('-')) {
    process.stderr.write('Usage: npx tsx src/v2/package/build.ts <out-dir>\n');
    process.exitCode = 2;
    return;
  }
  try {
    await buildPackage(args[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = error instanceof PackageBuildError ? error.exitCode : 1;
  }
}

const isEntry = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isEntry) {
  void runMain();
}
