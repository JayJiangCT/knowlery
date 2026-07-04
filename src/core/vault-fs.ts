/**
 * Platform-neutral vault file access (spec 0.7 f1, §4.1).
 *
 * Knowlery's lifecycle logic (init, skill/rule sync, migrations, health, bundle
 * install) depends on this interface instead of Obsidian's App, so the same core
 * serves both shells: the Obsidian plugin (src/platform/obsidian-fs.ts) and the
 * standalone CLI (src/platform/node-fs.ts).
 *
 * Paths are vault-relative with `/` separators.
 */
export interface VaultFs {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  readBinary(path: string): Promise<ArrayBuffer>;
  write(path: string, content: string): Promise<void>;
  writeBinary(path: string, data: ArrayBuffer): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  rmdir(path: string, recursive: boolean): Promise<void>;
  list(path: string): Promise<{ files: string[]; folders: string[] }>;
}

/** Local equivalent of Obsidian's normalizePath, so core modules need no obsidian import. */
export function normalizeVaultPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

/**
 * Wraps a VaultFs and records every mutated path, so callers (e.g. `knowlery sync`)
 * can report what actually changed. Write-on-change discipline lives in the callers;
 * this only observes.
 */
export function loggingVaultFs(inner: VaultFs): { fs: VaultFs; writes: string[] } {
  const writes: string[] = [];
  const record = (path: string) => {
    if (!writes.includes(path)) writes.push(path);
  };
  return {
    writes,
    fs: {
      ...inner,
      write: async (path, content) => {
        await inner.write(path, content);
        record(path);
      },
      writeBinary: async (path, data) => {
        await inner.writeBinary(path, data);
        record(path);
      },
      remove: async (path) => {
        await inner.remove(path);
        record(path);
      },
      rmdir: async (path, recursive) => {
        await inner.rmdir(path, recursive);
        record(path);
      },
    },
  };
}
