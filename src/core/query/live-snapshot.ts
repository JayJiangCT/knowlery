/* eslint-disable obsidianmd/prefer-window-timers --
 * These timers debounce a data-cache refresh; they are not UI-window-bound, so popout
 * window compatibility does not apply. Bare timers keep this class runnable in node
 * unit tests. */
import type { App } from 'obsidian';
import {
  INSTRUCTION_FILES,
  buildPageFromContent,
  bundleEntriesFromIndex,
  type BundleRegistryEntry,
  type ScannedBundleEntry,
  type ScannedPage,
  type VaultSnapshot,
} from './scan';

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
export class LiveQuerySnapshot {
  private pages = new Map<string, ScannedPage>();
  private bundleEntries: ScannedBundleEntry[] = [];
  private isReady = false;
  private pendingRefresh = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private app: App,
    private debounceMs = 300,
  ) {}

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
    };
  }

  async build(): Promise<void> {
    for (const file of this.app.vault.getMarkdownFiles()) {
      await this.refreshFile(file.path);
    }
    await this.refreshBundles();
    this.isReady = true;
  }

  /** Debounced per path: rapid successive edits to one file collapse into one re-read. */
  scheduleRefresh(path: string): void {
    if (!path.endsWith('.md')) return;
    const existing = this.pendingRefresh.get(path);
    if (existing) clearTimeout(existing);
    this.pendingRefresh.set(
      path,
      setTimeout(() => {
        this.pendingRefresh.delete(path);
        void this.refreshFile(path);
      }, this.debounceMs),
    );
  }

  handleDelete(path: string): void {
    const pending = this.pendingRefresh.get(path);
    if (pending) {
      clearTimeout(pending);
      this.pendingRefresh.delete(path);
    }
    this.pages.delete(path);
  }

  handleRename(oldPath: string, newPath: string): void {
    this.handleDelete(oldPath);
    this.scheduleRefresh(newPath);
  }

  async refreshFile(path: string): Promise<void> {
    if (INSTRUCTION_FILES.has(path)) return;
    const file = this.app.vault.getFileByPath(path);
    if (!file) {
      this.pages.delete(path);
      return;
    }
    try {
      const content = await this.app.vault.cachedRead(file);
      const page = buildPageFromContent(path, content);
      if (page) this.pages.set(path, page);
    } catch {
      // Unreadable file — keep the previous snapshot entry rather than dropping it.
    }
  }

  /**
   * Bundle registry files are hidden (.knowlery/), so vault events do not fire for
   * them; callers re-invoke this on the plugin's dashboard-refresh event, which
   * Knowlery triggers after bundle install/uninstall.
   */
  async refreshBundles(): Promise<void> {
    const adapter = this.app.vault.adapter;
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
            const agentIndex = JSON.parse(await adapter.read(indexPath));
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
