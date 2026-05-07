import { mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import esbuild from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outdir = join(root, '.tmp-tests');
const outfile = join(outdir, 'command-runner.test.mjs');

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'tests/command-runner.test.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
});

await import(pathToFileURL(outfile).href);
await rm(outdir, { recursive: true, force: true });
