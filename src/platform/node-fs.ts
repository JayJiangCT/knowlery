import { mkdir, readFile, readdir, rename, rm, unlink, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { VaultFs } from '../core/vault-fs';
import { normalizeVaultPath } from '../core/vault-fs';

/**
 * VaultFs over plain node:fs (spec 0.7 f1, §4.1) — the CLI shell's implementation,
 * also used by unit tests against temp directories. Semantics mirror Obsidian's
 * adapter: paths are vault-relative, `list` returns full relative paths split into
 * files and folders.
 */
export function nodeVaultFs(root: string): VaultFs {
  const abs = (path: string) => join(root, normalizeVaultPath(path));

  return {
    exists: async (path) => {
      try {
        await stat(abs(path));
        return true;
      } catch {
        return false;
      }
    },

    read: (path) => readFile(abs(path), 'utf8'),

    readBinary: async (path) => {
      const buffer = await readFile(abs(path));
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    },

    write: async (path, content) => {
      await mkdir(dirname(abs(path)), { recursive: true });
      await writeFile(abs(path), content);
    },

    writeBinary: async (path, data) => {
      await mkdir(dirname(abs(path)), { recursive: true });
      await writeFile(abs(path), Buffer.from(data));
    },

    mkdir: async (path) => {
      await mkdir(abs(path), { recursive: true });
    },

    remove: (path) => unlink(abs(path)),

    rmdir: async (path, recursive) => {
      await rm(abs(path), { recursive, force: true });
    },

    rename: async (oldPath, newPath) => {
      await rename(abs(oldPath), abs(newPath));
    },

    list: async (path) => {
      const normalized = normalizeVaultPath(path).replace(/\/+$/, '');
      const entries = await readdir(abs(normalized), { withFileTypes: true });
      const files: string[] = [];
      const folders: string[] = [];
      for (const entry of entries) {
        const full = normalized ? `${normalized}/${entry.name}` : entry.name;
        if (entry.isDirectory()) folders.push(full);
        else files.push(full);
      }
      return { files: files.sort(), folders: folders.sort() };
    },
  };
}
