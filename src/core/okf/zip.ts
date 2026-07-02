import { basename, dirname, join } from 'path';
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
