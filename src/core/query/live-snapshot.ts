import type { App } from 'obsidian';
import {
  SYSTEM_FILES,
  buildPageFromContent,
  bundleEntriesFromIndex,
  type BundleRegistryEntry,
  type ScannedBundleEntry,
  type ScannedPage,
  type VaultSnapshot,
} from './scan';
import { CONFIG_PATH, parseConfig } from '../reference-config';
import {
  PROJECT_MARKERS,
  isIgnoredPath,
  listIgnoredDirs,
  projectRootsFromFiles,
  type ExclusionContext,
  type IgnoredDir,
} from './exclusions';

/**
 * In-memory vault snapshot backing the `obsidian knowlery:query` CLI handler
 * (spec f5, §5.2).
 *
 * The CLI host only captures handler output within the current microtask queue, so the
 * handler cannot read files at query time. This class does all I/O off the query path:
 * a full build in the background after layout-ready, then per-file incremental updates
 * driven by Obsidian's event stream (which also fires for externally edited files).
 *
 * This is deliberately NOT the on-disk index projection the F2 spec rejected: the
 * snapshot lives only in process memory, exists only while Obsidian runs, and is
 * invalidated by the app's own events — the "stale while Obsidian is closed" failure
 * class cannot occur, because the snapshot does not exist then. Headless callers use
 * query.mjs, which live-scans.
 *
 * Page construction goes through the same buildPageFromContent as the fs scanner, so
 * parity between the two transports is structural.
 */
/**
 * Timer indirection: the plugin uses window timers (per Obsidian guidelines), while
 * unit tests inject plain node timers, since these debounce a data cache rather than
 * anything window-bound.
 */
export interface SnapshotTimers {
  set: (callback: () => void, ms: number) => unknown;
  clear: (id: unknown) => void;
}

export class LiveQuerySnapshot {
  private pages = new Map<string, ScannedPage>();
  private bundleEntries: ScannedBundleEntry[] = [];
  private referenceDirs: string[] = [];
  private referenceConfigError: string | null = null;
  private ignoreDirs: string[] = [];
  /** Directories holding a project manifest; rebuilt from the vault file list, kept current on marker events. */
  private projectRoots = new Set<string>();
  private isReady = false;
  private pendingRefresh = new Map<string, unknown>();
  private timers: SnapshotTimers;

  constructor(
    private app: App,
    private debounceMs = 300,
    timers?: SnapshotTimers,
  ) {
    this.timers = timers ?? {
      set: (callback, ms) => window.setTimeout(callback, ms),
      clear: (id) => window.clearTimeout(id as number),
    };
  }

  get ready(): boolean {
    return this.isReady;
  }

  /** Returns null until the initial build completes — callers surface a warming message. */
  snapshot(): VaultSnapshot | null {
    if (!this.isReady) return null;
    return {
      root: '',
      pages: [...this.pages.values()],
      bundleEntries: this.bundleEntries,
      referenceDirs: this.referenceDirs,
      ignoreDirs: this.ignoreDirs,
      ...(this.referenceConfigError ? { referenceConfigError: this.referenceConfigError } : {}),
      ignoredDirs: this.ignoredDirs(),
    };
  }

  private exclusions(): ExclusionContext {
    return { projectRoots: this.projectRoots, ignoreDirs: this.ignoreDirs };
  }

  /** Same list the fs scanner reports, derived from the vault's folder tree. */
  ignoredDirs(): IgnoredDir[] {
    const folders = this.app.vault.getAllFolders?.(false) ?? [];
    return listIgnoredDirs(folders.map((folder) => folder.path), this.exclusions());
  }

  /** Why `.knowlery/config.json` could not be read, while both directory lists are treated as empty. */
  configError(): string | null {
    return this.referenceConfigError;
  }

  async build(): Promise<void> {
    // Config (ignoreDirs) and project roots must be known before the first file is
    // judged, so they load ahead of the page walk.
    await this.refreshBundles();
    this.projectRoots = projectRootsFromFiles(this.app.vault.getFiles().map((file) => file.path));
    for (const file of this.app.vault.getMarkdownFiles()) {
      await this.refreshFile(file.path);
    }
    this.isReady = true;
  }

  /**
   * A project manifest appearing or disappearing changes which sibling directories
   * are build output; recompute roots and drop pages that are now excluded.
   */
  async handleMarkerChange(path: string): Promise<void> {
    const name = path.slice(path.lastIndexOf('/') + 1);
    if (!PROJECT_MARKERS.has(name)) return;
    this.projectRoots = projectRootsFromFiles(this.app.vault.getFiles().map((file) => file.path));
    await this.reconcileExclusions();
  }

  /**
   * After an exclusion input changes: newly excluded directories lose their pages,
   * and Markdown files that are no longer excluded (and not yet held) are read in.
   * Skipped before the initial build, which walks every file anyway.
   */
  private async reconcileExclusions(): Promise<void> {
    if (!this.isReady) return;
    const context = this.exclusions();
    for (const path of [...this.pages.keys()]) {
      if (isIgnoredPath(path, context)) this.pages.delete(path);
    }
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (this.pages.has(file.path) || SYSTEM_FILES.has(file.path)) continue;
      if (!isIgnoredPath(file.path, context)) await this.refreshFile(file.path);
    }
  }

  /** Debounced per path: rapid successive edits to one file collapse into one re-read. */
  scheduleRefresh(path: string): void {
    if (!path.endsWith('.md')) return;
    const existing = this.pendingRefresh.get(path);
    if (existing !== undefined) this.timers.clear(existing);
    this.pendingRefresh.set(
      path,
      this.timers.set(() => {
        this.pendingRefresh.delete(path);
        void this.refreshFile(path);
      }, this.debounceMs),
    );
  }

  handleDelete(path: string): void {
    const pending = this.pendingRefresh.get(path);
    if (pending !== undefined) {
      this.timers.clear(pending);
      this.pendingRefresh.delete(path);
    }
    this.pages.delete(path);
  }

  handleRename(oldPath: string, newPath: string): void {
    this.handleDelete(oldPath);
    this.scheduleRefresh(newPath);
  }

  async refreshFile(path: string): Promise<void> {
    if (SYSTEM_FILES.has(path)) return;
    if (isIgnoredPath(path, this.exclusions())) {
      this.pages.delete(path);
      return;
    }
    const file = this.app.vault.getFileByPath(path);
    if (!file) {
      this.pages.delete(path);
      return;
    }
    try {
      const content = await this.app.vault.cachedRead(file);
      const page = buildPageFromContent(path, content, file.stat.mtime);
      if (page) this.pages.set(path, page);
    } catch {
      // Unreadable file — keep the previous snapshot entry rather than dropping it.
    }
  }

  /**
   * Bundle registry and config files are hidden (.knowlery/), so vault events do not
   * fire for them; callers re-invoke this on the plugin's dashboard-refresh event,
   * which Knowlery triggers after bundle install/uninstall and reference-dir edits.
   */
  async refreshBundles(): Promise<void> {
    const adapter = this.app.vault.adapter;
    const previousIgnoreDirs = this.ignoreDirs.join('\n');
    try {
      const raw = (await adapter.exists(CONFIG_PATH)) ? await adapter.read(CONFIG_PATH) : null;
      const config = parseConfig(raw);
      this.referenceDirs = config.referenceDirs;
      this.ignoreDirs = config.ignoreDirs;
      this.referenceConfigError = null;
    } catch (error) {
      // Same degradation as the fs scanner: malformed config means empty lists, and
      // the error rides on the snapshot so the dashboard can say why.
      this.referenceDirs = [];
      this.ignoreDirs = [];
      this.referenceConfigError = error instanceof Error ? error.message : String(error);
    }
    if (this.ignoreDirs.join('\n') !== previousIgnoreDirs) await this.reconcileExclusions();
    const registryPath = '.knowlery/bundles.json';
    const entries: ScannedBundleEntry[] = [];
    try {
      if (await adapter.exists(registryPath)) {
        const registry = JSON.parse(await adapter.read(registryPath)) as {
          bundles?: Record<string, BundleRegistryEntry>;
        };
        for (const [bundleId, bundle] of Object.entries(registry.bundles ?? {})) {
          if (!bundle.libraryPath) continue;
          const indexPath = `${bundle.libraryPath}/agent-index.json`;
          if (!(await adapter.exists(indexPath))) continue;
          try {
            const agentIndex = JSON.parse(await adapter.read(indexPath)) as { concepts?: import('./scan').AgentIndexConceptEntry[] };
            entries.push(...bundleEntriesFromIndex(bundleId, bundle.libraryPath, agentIndex));
          } catch {
            // Malformed bundle index — skip this bundle, keep the rest.
          }
        }
      }
      this.bundleEntries = entries;
    } catch {
      // Malformed registry — keep the previous bundle entries.
    }
  }
}
