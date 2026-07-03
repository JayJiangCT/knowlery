import { basename, dirname, join, relative, sep } from 'path';
import { readdir, readFile, stat, writeFile } from 'fs/promises';
import JSZip from 'jszip';

export async function zipBundleDirectory(targetDir: string): Promise<string> {
  const zip = new JSZip();
  const rootName = basename(targetDir.replace(/\/$/, ''));
  await addDirectory(zip.folder(rootName)!, targetDir);
  const content = await zip.generateAsync({ type: 'nodebuffer' });
  const zipPath = join(dirname(targetDir), `${rootName}.zip`);
  await writeFile(zipPath, content);
  return zipPath;
}

async function addDirectory(zip: JSZip, dir: string): Promise<void> {
  const entries = await readdir(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      await addDirectory(zip.folder(entry)!, fullPath);
    } else {
      zip.file(entry, await readFile(fullPath));
    }
  }
}

export interface BundleSourceEntry {
  path: string;
  content: string;
}

export async function readBundleEntries(sourcePath: string): Promise<BundleSourceEntry[]> {
  const info = await stat(sourcePath);
  if (info.isDirectory()) return readDirectoryEntries(sourcePath, sourcePath);
  return readZipEntries(sourcePath);
}

async function readDirectoryEntries(root: string, dir: string): Promise<BundleSourceEntry[]> {
  const entries: BundleSourceEntry[] = [];
  for (const name of await readdir(dir)) {
    const fullPath = join(dir, name);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      entries.push(...(await readDirectoryEntries(root, fullPath)));
    } else {
      entries.push({
        path: relative(root, fullPath).split(sep).join('/'),
        content: await readFile(fullPath, 'utf8'),
      });
    }
  }
  return entries;
}

async function readZipEntries(zipPath: string): Promise<BundleSourceEntry[]> {
  const buffer = await readFile(zipPath);
  const zip = await JSZip.loadAsync(buffer);
  const fileEntries: Array<[string, JSZip.JSZipObject]> = [];
  zip.forEach((relativePath, file) => {
    if (!file.dir) fileEntries.push([relativePath, file]);
  });

  const entries: BundleSourceEntry[] = [];
  for (const [relativePath, file] of fileEntries) {
    entries.push({ path: relativePath, content: await file.async('string') });
  }

  // zipBundleDirectory (above) always wraps the bundle in one top-level
  // folder named after the target dir. Strip it so paths are bundle-root
  // relative — but only when every entry shares the same first segment,
  // so a zip made without that wrapper (contents zipped directly) still
  // reads correctly.
  const topLevelSegments = new Set(entries.map((entry) => entry.path.split('/')[0]));
  if (topLevelSegments.size === 1) {
    const prefix = `${[...topLevelSegments][0]}/`;
    return entries.map((entry) => ({ ...entry, path: entry.path.slice(prefix.length) }));
  }
  return entries;
}
