import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import JSZip from 'jszip';

/**
 * Packages the committed plugin tree as a release asset (spec 1.1 f3, §4.2).
 *
 * Archive root shape, fixed at spec review: the tree's *contents* are the zip
 * root — no wrapping plugin/ folder — so unzipping into any directory yields
 * a valid plugin dir that --plugin-dir-style installs can point at directly.
 * Unix permissions are preserved (the bin/knowlery executable bit survives).
 */
export async function zipPluginTree(treeDir: string, outFile: string): Promise<string[]> {
  const zip = new JSZip();
  const entries: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const rel = relative(treeDir, full);
        entries.push(rel);
        zip.file(rel, readFileSync(full), {
          unixPermissions: statSync(full).mode & 0o777,
        });
      }
    }
  };
  walk(treeDir);

  const buffer = await zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' });
  writeFileSync(outFile, buffer);
  return entries.sort();
}

if (process.argv[1]?.endsWith('zip-plugin.ts')) {
  const treeDir = process.argv[2] ?? join(__dirname, '..', 'plugin');
  const version = (JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as { version: string }).version;
  const outFile = process.argv[3] ?? join(__dirname, '..', `knowlery-plugin-${version}.zip`);
  void zipPluginTree(treeDir, outFile).then((entries) => {
    process.stdout.write(`${outFile}: ${entries.length} entries\n`);
  });
}
