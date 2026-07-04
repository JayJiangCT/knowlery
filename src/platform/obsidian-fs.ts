import type { App } from 'obsidian';
import { normalizePath } from 'obsidian';
import type { VaultFs } from '../core/vault-fs';

interface AdapterWithRmdir {
  rmdir?: (path: string, recursive?: boolean) => Promise<void>;
}

/**
 * VaultFs over Obsidian's vault API (spec 0.7 f1, §4.1).
 *
 * Write and mkdir reproduce vault-io.ts's semantics verbatim: the vault API is
 * preferred for indexed files (so the metadata cache sees changes exactly as before),
 * with adapter fallbacks for hidden paths the vault index does not cover.
 */
export function obsidianVaultFs(app: App): VaultFs {
  const adapter = app.vault.adapter;
  return {
    exists: (path) => adapter.exists(normalizePath(path)),

    read: (path) => adapter.read(normalizePath(path)),

    readBinary: (path) => adapter.readBinary(normalizePath(path)),

    write: async (path, content) => {
      const normalized = normalizePath(path);
      const existing = app.vault.getFileByPath(normalized);
      if (existing) {
        await app.vault.modify(existing, content);
      } else {
        try {
          await app.vault.create(normalized, content);
        } catch {
          // File exists on disk but not in vault index — write via adapter
          await adapter.write(normalized, content);
        }
      }
    },

    writeBinary: (path, data) => adapter.writeBinary(normalizePath(path), data),

    mkdir: async (path) => {
      const normalized = normalizePath(path);
      if (app.vault.getFolderByPath(normalized)) return;
      try {
        await app.vault.createFolder(normalized);
      } catch {
        // Folder may exist on disk but not in the vault index (hidden directories),
        // or be a hidden path the vault API refuses — fall back to the adapter.
        if (!(await adapter.exists(normalized))) {
          await adapter.mkdir(normalized);
        }
      }
    },

    remove: (path) => adapter.remove(normalizePath(path)),

    rmdir: async (path, recursive) => {
      const normalized = normalizePath(path);
      const withRmdir = adapter as typeof adapter & AdapterWithRmdir;
      if ((await adapter.exists(normalized)) && withRmdir.rmdir) {
        await withRmdir.rmdir(normalized, recursive);
      }
    },

    list: (path) => adapter.list(normalizePath(path)),
  };
}
