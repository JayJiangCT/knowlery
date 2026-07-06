// Shared mock App for OKF tests: an in-memory vault with just enough of the
// Vault/MetadataCache surface for collect/compile/export-scope. Mock at the
// App boundary only (per the spec's testing conventions note).

export interface MockOkfApp {
  writes: Record<string, string>;
  vault: {
    configDir: string;
    getMarkdownFiles: () => Array<{ path: string; basename: string; extension: string }>;
    getFileByPath: (path: string) => { path: string; basename: string; extension: string } | null;
    read: (file: { path: string }) => Promise<string>;
    cachedRead: (file: { path: string }) => Promise<string>;
    adapter: {
      exists: (path: string) => Promise<boolean>;
      read: (path: string) => Promise<string>;
      write: (path: string, content: string) => Promise<void>;
      mkdir: (path: string) => Promise<void>;
      rmdir: (path: string, recursive?: boolean) => Promise<void>;
      list: (path: string) => Promise<{ files: string[]; folders: string[] }>;
    };
  };
  metadataCache: {
    getFirstLinkpathDest: (linkpath: string, sourcePath: string) => { path: string } | null;
    resolvedLinks: Record<string, Record<string, number>>;
  };
}

import type { VaultFs } from '../../src/core/vault-fs';

/**
 * Adapts the OKF mock app into a VaultFs for the inverted install-side modules
 * (spec 0.7 f1). Reads are writes-first, matching the vault.read semantics the
 * pre-inversion code used for KNOWLEDGE.md, so existing assertions carry over.
 */
export function okfVaultFs(app: MockOkfApp): VaultFs {
  const adapter = app.vault.adapter;
  return {
    exists: (path) => adapter.exists(path),
    read: async (path) => app.writes[path] ?? (await adapter.read(path)),
    readBinary: async (path) => {
      const content = app.writes[path] ?? (await adapter.read(path));
      return new TextEncoder().encode(content).buffer as ArrayBuffer;
    },
    write: (path, content) => adapter.write(path, content),
    writeBinary: async (path, data) => adapter.write(path, new TextDecoder().decode(data)),
    mkdir: (path) => adapter.mkdir(path),
    remove: async (path) => {
      delete app.writes[path];
    },
    rmdir: (path, recursive) => adapter.rmdir(path, recursive),
    list: (path) => adapter.list(path),
  };
}

import type { BundleSource } from '../../src/core/okf/collect';

/**
 * Adapts the OKF mock app into a BundleSource for the inverted export-side modules
 * (spec 0.8 f1): okfVaultFs for I/O plus a LinkResolver over the mock metadataCache,
 * mirroring src/platform/obsidian-link-resolver.ts exactly.
 */
export function okfBundleSource(app: MockOkfApp): BundleSource {
  return {
    fs: okfVaultFs(app),
    resolver: {
      resolve: (target, fromPath) => {
        const dest = app.metadataCache.getFirstLinkpathDest(target, fromPath);
        return dest ? dest.path : null;
      },
      resolvedLinks: () => app.metadataCache.resolvedLinks ?? {},
    },
    configDir: app.vault.configDir,
  };
}

export function createOkfMockApp(
  initialFiles: Record<string, string>,
  options: { resolvedLinks?: Record<string, Record<string, number>> } = {},
): MockOkfApp {
  const files: Record<string, string> = { ...initialFiles };
  const writes: Record<string, string> = {};

  const fileEntry = (path: string) => ({
    path,
    basename: path.split('/').pop()!.replace(/\.md$/, ''),
    extension: path.split('.').pop() ?? '',
  });

  const allPaths = () => [...new Set([...Object.keys(files), ...Object.keys(writes)])];

  return {
    writes,
    vault: {
      configDir: '.obsidian',
      getMarkdownFiles: () => Object.keys(files).filter((path) => path.endsWith('.md')).map(fileEntry),
      getFileByPath: (path: string) => (files[path] !== undefined ? fileEntry(path) : null),
      read: async (file: { path: string }) => writes[file.path] ?? files[file.path],
      cachedRead: async (file: { path: string }) => writes[file.path] ?? files[file.path],
      adapter: {
        exists: async (path: string) =>
          allPaths().some((entry) => entry === path || entry.startsWith(`${path}/`)),
        read: async (path: string) => files[path] ?? writes[path],
        write: async (path: string, content: string) => {
          writes[path] = content;
        },
        mkdir: async () => {},
        rmdir: async (path: string) => {
          for (const key of Object.keys(writes)) {
            if (key === path || key.startsWith(`${path}/`)) delete writes[key];
          }
        },
        list: async (path: string) => {
          const prefix = path === '/' || path === '' ? '' : `${path.replace(/\/$/, '')}/`;
          const children = allPaths().filter((entry) => entry.startsWith(prefix));
          return {
            files: children.filter((entry) => !entry.slice(prefix.length).includes('/')),
            folders: [...new Set(children
              .map((entry) => entry.slice(prefix.length).split('/')[0])
              .filter((part) => part && children.some((entry) => entry.startsWith(`${prefix}${part}/`)))
              .map((folder) => `${prefix}${folder}`))],
          };
        },
      },
    },
    metadataCache: {
      getFirstLinkpathDest: (linkpath: string) => {
        const withExt = linkpath.endsWith('.md') ? linkpath : `${linkpath}.md`;
        if (files[withExt] !== undefined) return { path: withExt };
        // Basename resolution: unique match only. Ambiguous basenames resolve to
        // null — the semantic the 0.8 f1 spec fixed for the headless resolver,
        // mirrored here so parity tests compare like with like.
        const matches = Object.keys(files).filter((path) => path.endsWith(`/${withExt}`));
        return matches.length === 1 ? { path: matches[0] } : null;
      },
      resolvedLinks: options.resolvedLinks ?? {},
    },
  };
}
