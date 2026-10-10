import { requestUrl } from 'obsidian';
import type KnowleryPlugin from './main';
import type { JevTransport } from './core/jev/client';
import {
  autoTriage,
  autoTriageAll,
  type AutoTriageAllResult,
  type AutoTriageDeps,
  type AutoTriageResult,
} from './core/jev/auto-triage';

/** Plugin-shell transport: requestUrl bypasses renderer CORS, as every other remote call here does. */
export const obsidianJevTransport: JevTransport = async (url, headers, body) => {
  const response = await requestUrl({ url, method: 'POST', headers, body, throw: false });
  return { status: response.status, text: response.text };
};

/** Quiet period after the last vault change before a background pass starts. */
export const JEV_AUTO_RANK_DEBOUNCE_MS = 30_000;

/**
 * Background Jev scoring for users whose workbench is an agent harness rather than
 * Obsidian: with the key set and "Score automatically" on, every uncooked note that
 * lacks a current score is scored shortly after it settles, and the result lands in
 * `.knowlery/triage.json` — where `knowlery stale`, the MCP `stale` tool, and
 * `query.mjs --stale` read it without any key of their own.
 *
 * Off by default: it is the one place Knowlery would spend the user's money without a
 * click, so the user turns it on. One pass at a time; a pass that fails is logged and
 * retried on the next vault change, never in a loop.
 */
export class JevBackgroundScorer {
  private timer: number | null = null;
  private running = false;

  constructor(private plugin: KnowleryPlugin) {}

  get enabled(): boolean {
    return this.plugin.settings.jevApiKey !== '' && this.plugin.settings.jevAutoRank;
  }

  /** Called on vault changes and after the live snapshot builds; coalesces into one pass. */
  schedule(): void {
    if (!this.enabled) return;
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.runNow().catch((error: unknown) => {
        console.warn('Knowlery: background Jev scoring failed; will retry after the next vault change.', error);
      });
    }, JEV_AUTO_RANK_DEBOUNCE_MS);
  }

  cancel(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  /** One capped pass over unscored uncooked notes — the background top-up for new notes. */
  async runNow(onProgress?: (done: number, total: number) => void): Promise<AutoTriageResult | null> {
    return this.withDeps(onProgress, async (deps) => {
      const result = await autoTriage(deps);
      return { result, wrote: (result.outcome?.scores.length ?? 0) > 0 };
    });
  }

  /** The whole backlog, pass after pass — the dashboard's Rank button. */
  async runAll(onProgress?: (done: number, total: number) => void): Promise<AutoTriageAllResult | null> {
    return this.withDeps(onProgress, async (deps) => {
      const result = await autoTriageAll(deps);
      return { result, wrote: result.scores.length > 0 };
    });
  }

  private async withDeps<T>(
    onProgress: ((done: number, total: number) => void) | undefined,
    run: (deps: AutoTriageDeps) => Promise<{ result: T; wrote: boolean }>,
  ): Promise<T | null> {
    const apiKey = this.plugin.settings.jevApiKey;
    const snapshot = this.plugin.liveSnapshot?.snapshot();
    if (!apiKey || !snapshot || this.running) return null;
    this.running = true;
    try {
      const { result, wrote } = await run({
        fs: this.plugin.fs,
        snapshot,
        apiKey,
        transport: obsidianJevTransport,
        readNote: async (path) => {
          const file = this.plugin.app.vault.getFileByPath(path);
          if (!file) throw new Error(`Note not found: ${path}`);
          return this.plugin.app.vault.cachedRead(file);
        },
        onProgress,
      });
      if (wrote) {
        await this.plugin.liveSnapshot?.refreshTriage();
        this.plugin.events.trigger('dashboard-refresh');
      }
      return result;
    } finally {
      this.running = false;
    }
  }
}
