import type { VaultFs } from '../../src/core/vault-fs';

/**
 * In-memory VaultFs for unit tests (spec 0.7 f1) — replaces the per-file mock App
 * constructions. Exposes the backing file map and a write log so existing assertions
 * carry over unchanged.
 */
export interface MemoryFs extends VaultFs {
  files: Map<string, string>;
  dirs: Set<string>;
  writeLog: string[];
}

export function createMemoryFs(initialFiles: Record<string, string> = {}): MemoryFs {
  const files = new Map(Object.entries(initialFiles));
  const dirs = new Set<string>();
  const writeLog: string[] = [];

  const addParentDirs = (path: string) => {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  };

  for (const path of files.keys()) addParentDirs(path);

  return {
    files,
    dirs,
    writeLog,

    exists: async (path) => files.has(path) || dirs.has(path),

    read: async (path) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },

    readBinary: async (path) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return new TextEncoder().encode(content).buffer as ArrayBuffer;
    },

    write: async (path, content) => {
      addParentDirs(path);
      files.set(path, content);
      writeLog.push(path);
    },

    writeBinary: async (path, data) => {
      addParentDirs(path);
      files.set(path, new TextDecoder().decode(data));
      writeLog.push(path);
    },

    mkdir: async (path) => {
      addParentDirs(`${path}/x`);
      dirs.add(path);
    },

    remove: async (path) => {
      files.delete(path);
    },

    rename: async (oldPath, newPath) => {
      if (files.has(oldPath)) {
        files.set(newPath, files.get(oldPath)!);
        files.delete(oldPath);
        addParentDirs(newPath);
        writeLog.push(newPath);
        return;
      }
      // Directory move: re-key every child.
      const prefix = `${oldPath}/`;
      for (const file of [...files.keys()]) {
        if (file.startsWith(prefix)) {
          files.set(`${newPath}/${file.slice(prefix.length)}`, files.get(file)!);
          files.delete(file);
        }
      }
      for (const dir of [...dirs]) {
        if (dir === oldPath || dir.startsWith(prefix)) {
          dirs.delete(dir);
          dirs.add(dir === oldPath ? newPath : `${newPath}/${dir.slice(prefix.length)}`);
        }
      }
      addParentDirs(`${newPath}/x`);
      writeLog.push(newPath);
    },

    rmdir: async (path, recursive) => {
      if (!recursive) {
        dirs.delete(path);
        return;
      }
      const prefix = `${path}/`;
      for (const file of [...files.keys()]) {
        if (file.startsWith(prefix)) files.delete(file);
      }
      for (const dir of [...dirs]) {
        if (dir === path || dir.startsWith(prefix)) dirs.delete(dir);
      }
    },

    list: async (path) => {
      const prefix = `${path}/`;
      const listedFiles: string[] = [];
      const listedFolders = new Set<string>();

      for (const file of files.keys()) {
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        const first = rest.split('/')[0];
        if (rest.includes('/')) listedFolders.add(`${path}/${first}`);
        else listedFiles.push(file);
      }

      for (const dir of dirs) {
        if (!dir.startsWith(prefix)) continue;
        const rest = dir.slice(prefix.length);
        if (!rest || rest.includes('/')) continue;
        listedFolders.add(`${path}/${rest}`);
      }

      return { files: listedFiles.sort(), folders: [...listedFolders].sort() };
    },
  };
}
