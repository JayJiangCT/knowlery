import type { BundleManifest, ConformanceReport } from '../../types';
import { BundleManifestSchema } from '../../types';
import type { BundleFile } from './shared';
import { BUNDLE_MARKER, toPosixPath } from './shared';
import { checkConformance } from './conformance';

export interface BundleSourceEntry {
  path: string;
  content: string;
}

export interface InstallPreview {
  manifest: BundleManifest;
  conformance: ConformanceReport;
}

/**
 * §15.2 P0: a bundle is untrusted input (someone else's export, a
 * downloaded zip) until every entry path is proven to stay inside the
 * install root. Checked on the RAW path before any normalization can strip
 * the telltale absolute-path/`..` markers, then re-checked after joining.
 */
export function assertSafeInstallPath(libraryPath: string, entryPath: string): string {
  if (!entryPath || entryPath.startsWith('/') || entryPath.startsWith('\\') || /^[a-zA-Z]:/.test(entryPath)) {
    throw new Error(`Unsafe absolute path in bundle: ${entryPath}`);
  }
  const segments = entryPath.split(/[\\/]+/);
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    throw new Error(`Unsafe path segment in bundle: ${entryPath}`);
  }

  const normalizedRoot = toPosixPath(libraryPath);
  const normalizedEntry = toPosixPath(entryPath);
  const fullPath = `${normalizedRoot}/${normalizedEntry}`;
  if (fullPath !== normalizedRoot && !fullPath.startsWith(`${normalizedRoot}/`)) {
    throw new Error(`Unsafe path escapes install root: ${entryPath}`);
  }
  return fullPath;
}

export function assertSafeBundleId(id: string): void {
  if (!id || /[\\/]/.test(id)) {
    throw new Error(`Unsafe bundle id: ${id}`);
  }
  if (id.split('.').some((segment) => segment.length === 0)) {
    throw new Error(`Unsafe bundle id: ${id}`);
  }
}

export function inferBundleFileKind(path: string): BundleFile['kind'] {
  if (path === 'index.md' || path.endsWith('/index.md')) return 'index';
  if (path === 'log.md') return 'log';
  if (path === 'README.md') return 'readme';
  if (path.startsWith('_sources/')) return 'source';
  if (path === 'SCHEMA.md') return 'reference';
  return 'concept';
}

export function previewInstall(entries: BundleSourceEntry[]): InstallPreview {
  const manifestEntry = entries.find((entry) => toPosixPath(entry.path) === BUNDLE_MARKER);
  if (!manifestEntry) {
    throw new Error(`Not a knowledge bundle: missing ${BUNDLE_MARKER} at the bundle root.`);
  }
  const manifest = BundleManifestSchema.parse(JSON.parse(manifestEntry.content));
  assertSafeBundleId(manifest.id);

  const bundleFiles: BundleFile[] = entries
    .filter((entry) => entry.path.endsWith('.md'))
    .map((entry) => {
      const path = toPosixPath(entry.path);
      return { path, content: entry.content, kind: inferBundleFileKind(path) };
    });

  return { manifest, conformance: checkConformance(bundleFiles) };
}
