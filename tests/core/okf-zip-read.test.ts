import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import JSZip from 'jszip';
import { readBundleEntries } from '../../src/core/okf/zip';

const cleanupPaths: string[] = [];
afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('readBundleEntries', () => {
  it('reads a plain directory into posix-relative entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'okf-install-'));
    cleanupPaths.push(dir);
    await mkdir(join(dir, 'concepts'), { recursive: true });
    await writeFile(join(dir, 'index.md'), '# Index');
    await writeFile(join(dir, 'concepts', 'foo.md'), 'Foo body');

    const entries = await readBundleEntries(dir);
    const byPath = Object.fromEntries(entries.map((entry) => [entry.path, entry.content]));
    expect(byPath['index.md']).toBe('# Index');
    expect(byPath['concepts/foo.md']).toBe('Foo body');
  });

  it('reads a zip and strips a single top-level wrapper folder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'okf-install-'));
    cleanupPaths.push(dir);
    const zip = new JSZip();
    const wrapper = zip.folder('my-bundle-0.1.0')!;
    wrapper.file('index.md', '# Index');
    wrapper.folder('concepts')!.file('foo.md', 'Foo body');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const zipPath = join(dir, 'bundle.zip');
    await writeFile(zipPath, buffer);

    const entries = await readBundleEntries(zipPath);
    const byPath = Object.fromEntries(entries.map((entry) => [entry.path, entry.content]));
    expect(byPath['index.md']).toBe('# Index');
    expect(byPath['concepts/foo.md']).toBe('Foo body');
  });
});
