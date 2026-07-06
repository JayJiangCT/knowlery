import type { App, TFile } from 'obsidian';
import type { LinkResolver } from '../core/okf/link-resolver';
import { toPosixPath } from '../core/okf/shared';

interface MetadataCacheLike {
  getFirstLinkpathDest?: (linkpath: string, sourcePath: string) => TFile | null;
  resolvedLinks?: Record<string, Record<string, number>>;
}

/** LinkResolver over Obsidian's metadataCache — the pre-inversion behavior, byte-preserved. */
export function obsidianLinkResolver(app: App): LinkResolver {
  const metadataCache = app.metadataCache as MetadataCacheLike;
  return {
    resolve: (target, fromPath) => {
      const dest = metadataCache.getFirstLinkpathDest?.(target, fromPath) ?? null;
      return dest ? toPosixPath(dest.path) : null;
    },
    resolvedLinks: () => metadataCache.resolvedLinks ?? {},
  };
}
