import type { TFile } from 'obsidian';
import { normalizePath, Notice, setTooltip } from 'obsidian';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePlugin } from '../context';
import type { ActivityRecord, DashboardMove, DashboardRefreshPayload, DashboardScreen } from '../types';
import type { TodayModel } from '../core/today-model';
import { buildTodayModel } from '../core/today-model';
import { readRecentActivityRecords } from '../core/activity-ledger';
import { getVaultStats } from '../core/vault-health';
import { sendPromptToClaudian } from '../core/claudian-bridge';
import { sendPromptToAgent, copyPrompt } from './request-actions';
import type { DailyReviewParseResult, DailyReviewRequest } from '../core/agent-review';
import { buildDailyReviewRequest, readDailyReviewResult, writeDailyReviewRequest } from '../core/agent-review';
import { buildWeeklyBakeModel, REPORT_DIR, writeWeeklyBakeReport } from '../core/weekly-bake';
import { RECIPE_BOOK } from '../core/moves';
import { buildRecookPrompt, computeStaleness, type StalenessReport } from '../core/query/staleness';
import { ReflectionCaptureModal } from '../modals/reflection-capture';
import { ExportBundleModal } from '../modals/export-bundle';
import { InstallBundleModal } from '../modals/install-bundle';
import { summarizeBundleScope } from '../core/okf/export-scope';
import { collectUpdateStatuses, modifiedFiles, type UpdateStatus } from '../core/okf/update-check';
import type { UpstreamDeps } from '../core/okf/upstream';
import { downloadRemoteBundle, type RemoteFetchResult } from '../core/okf/remote-source';
import { readBundleEntries } from '../core/okf/zip';
import { installBundle } from '../core/okf/install';
import { requestUrl } from 'obsidian';
import { Readable } from 'node:stream';

/** Plugin-shell transports for the update loop (spec 0.9 f3): requestUrl, as in F1. */
async function obsidianRemoteFetch(url: string): Promise<RemoteFetchResult> {
  const response = await requestUrl({ url, throw: false });
  return {
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    body: Readable.from(Buffer.from(response.arrayBuffer)),
  };
}

function pluginUpstreamDeps(): UpstreamDeps {
  return {
    fetchText: async (url) => {
      const response = await requestUrl({ url, throw: false });
      return { status: response.status, ok: response.status >= 200 && response.status < 300, text: response.text };
    },
    // ghApi deliberately not overridden: the default runner resolves the gh
    // binary through common install locations (gh-binary.ts), which is what
    // makes private-shelf checks work inside Electron's minimal GUI PATH
    // (maintainer acceptance finding, 0.9 f3).
  };
}
import { conceptIdFromPath, isKnowledgePath, sanitizeBundleId } from '../core/okf/shared';
import type { InstalledBundlesFile } from '../types';
import { readInstalledBundles } from '../core/okf/registry';
import { uninstallBundle } from '../core/okf/uninstall';
import { IconBookOpen, IconChevronRight, IconClipboard, IconDownload, IconExternalLink, IconPlay, IconPlus, IconRefresh } from './Icons';

const LATEST_REPORT_PATH = `${REPORT_DIR}/latest.html`;

interface FullPathAdapter {
  getFullPath: (path: string) => string | undefined;
}

interface ElectronWindow {
  require: (moduleName: 'electron') => {
    shell: {
      openPath: (path: string) => Promise<string>;
    };
  };
}

export function DashboardHome(props: { navigate: (screen: DashboardScreen, payload?: unknown) => void }) {
  const plugin = usePlugin();
  const [model, setModel] = useState<TodayModel | null>(null);
  const initialFile = plugin.app.workspace.getActiveFile();
  const [file, setFile] = useState<TFile | null>(initialFile?.extension === 'md' ? initialFile : null);

  // Weekly summary state
  const [generating, setGenerating] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [latestReportExists, setLatestReportExists] = useState(false);
  const [recordCount, setRecordCount] = useState(0);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [dailyReview, setDailyReview] = useState<{
    request: DailyReviewRequest;
    requestExists: boolean;
    result: DailyReviewParseResult | null;
  } | null>(null);
  const [bundleSummary, setBundleSummary] = useState<{
    approved: number;
    unreviewed: number;
    flagged: number;
    seeds: number;
  } | null>(null);
  const [installedBundles, setInstalledBundles] = useState<InstalledBundlesFile | null>(null);
  const [staleness, setStaleness] = useState<StalenessReport | null>(null);

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const activity = await readRecentActivityRecords(plugin.fs, 14);
    setModel(buildTodayModel(getVaultStats(plugin.app), activity.records));
    setRecords(activity.records);
    setRecordCount(activity.records.length);
    setLatestReportExists(await plugin.app.vault.adapter.exists(normalizePath(LATEST_REPORT_PATH)));
    const request = buildDailyReviewRequest(activity.records);
    setDailyReview({
      request,
      requestExists: await plugin.app.vault.adapter.exists(normalizePath(request.requestPath)),
      result: await readDailyReviewResult(plugin.app, request.resultPath, request.id),
    });
    setBundleSummary(await summarizeBundleScope(plugin.fs, sanitizeBundleId(plugin.settings.bundleCreatorName, plugin.settings.kbName)));
    setInstalledBundles(await readInstalledBundles(plugin.fs));
    const snapshot = plugin.liveSnapshot?.snapshot() ?? null;
    setStaleness(snapshot ? computeStaleness(snapshot) : null);
    if (payload) plugin.events.trigger('dashboard-refresh-complete', payload);
  }, [plugin]);

  useEffect(() => {
    void refresh();
    const ref = plugin.events.on('dashboard-refresh', (payload?: DashboardRefreshPayload) => {
      void refresh(payload);
    });
    return () => plugin.events.offref(ref);
  }, [plugin, refresh]);

  useEffect(() => {
    const fileOpenRef = plugin.app.workspace.on('file-open', (nextFile) => {
      if (nextFile?.extension === 'md') setFile(nextFile);
    });
    const activeLeafRef = plugin.app.workspace.on('active-leaf-change', () => {
      const activeFile = plugin.app.workspace.getActiveFile();
      if (activeFile?.extension === 'md') setFile(activeFile);
    });
    return () => {
      plugin.app.workspace.offref(fileOpenRef);
      plugin.app.workspace.offref(activeLeafRef);
    };
  }, [plugin]);

  const addReflection = () => {
    new ReflectionCaptureModal(plugin.app, plugin, () => void refresh()).open();
  };

  const openShareModal = (seed?: string) => {
    new ExportBundleModal(plugin.app, plugin, seed).open();
  };

  const openInstallModal = () => {
    new InstallBundleModal(plugin.app, plugin).open();
  };

  const removeBundle = async (bundleId: string) => {
    await uninstallBundle(plugin.fs, bundleId);
    setInstalledBundles(await readInstalledBundles(plugin.fs));
  };

  const copyRequest = async (request?: string) => {
    if (!request) {
      new Notice('No agent request prepared yet.');
      return;
    }
    await copyPrompt(request);
  };

  const sendRequest = async (request?: string) => {
    if (!request) {
      new Notice('No agent request prepared yet.');
      return;
    }
    await sendPromptToAgent(plugin.app, request);
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const result = await readRecentActivityRecords(plugin.fs, 7);
      const written = await writeWeeklyBakeReport(plugin.app, buildWeeklyBakeModel(result.records));
      setLatestReportExists(true);
      new Notice(`Weekly summary generated: ${written.latestPath}`);
      await refresh();
    } finally {
      setGenerating(false);
    }
  };

  const openLatestReport = async () => {
    const path = normalizePath(LATEST_REPORT_PATH);
    const adapter = plugin.app.vault.adapter;
    if (!(await adapter.exists(path))) {
      new Notice('No weekly summary has been generated yet.');
      setLatestReportExists(false);
      return;
    }
    const fullPath = (adapter as typeof adapter & FullPathAdapter).getFullPath(path);
    if (!fullPath) {
      new Notice(`Weekly summary is at ${path}`);
      return;
    }
    const { shell } = (window as Window & ElectronWindow).require('electron');
    void shell.openPath(fullPath);
  };

  const polishWithAgent = async () => {
    setPolishing(true);
    try {
      const result = await readRecentActivityRecords(plugin.fs, 7);
      const request = buildDailyReviewRequest(result.records);
      await writeDailyReviewRequest(plugin.app, request);
      // Weekly review sends the structured request prompt as-is (no ledger-reminder wrapper).
      const sent = await sendPromptToClaudian(plugin.app, request.prompt);
      setDailyReview({
        request,
        requestExists: true,
        result: await readDailyReviewResult(plugin.app, request.resultPath, request.id),
      });
      if (sent) {
        new Notice('Review polish request sent to claudian.');
        return;
      }
      try {
        await navigator.clipboard.writeText(request.prompt);
        new Notice('Claudian is not available. Review request copied.');
      } catch {
        new Notice('Claudian is not available, and the request could not be copied.');
      }
    } finally {
      setPolishing(false);
    }
  };

  const noteRequest = useMemo(() => {
    if (!file) return null;
    return `Review the current note "${file.basename}": find related older notes and comparisons, then identify which connections, questions, or structures are worth writing back to the knowledge base.`;
  }, [file]);

  const currentConceptId = file && isKnowledgePath(file.path) ? conceptIdFromPath(file.path) : null;

  if (!model) return <div className="knowlery-home" />;

  return (
    <div className="knowlery-home">
      <section className="knowlery-home__today">
        <div className="knowlery-home__today-copy">
          <div className="knowlery-section-label">Today's move</div>
          <h2>{model.title}</h2>
          <p>{model.body}</p>
        </div>
        <TodayMoveActions
          model={model}
          onAddReflection={addReflection}
          onCopyRequest={(request) => void copyRequest(request)}
          onSendRequest={(request) => void sendRequest(request)}
          onNavigateAllMoves={() => props.navigate('all-moves')}
        />
      </section>

      <SuggestedMovesSection
        moves={RECIPE_BOOK}
        onMoveClick={(move) => props.navigate('move-detail', move)}
        onViewAll={() => props.navigate('all-moves')}
      />

      <section className="knowlery-home__note">
        <div className="knowlery-section-label">This note</div>
        {file ? (
          <article className="knowlery-home__note-card">
            <div className="knowlery-home__note-header">
              <h3>{file.basename}</h3>
              <span className="knowlery-home__note-path">{file.path}</span>
            </div>
            <p>{noteRequest}</p>
            <div className="knowlery-home__note-actions">
              <button
                type="button"
                className="knowlery-btn knowlery-btn--primary"
                onClick={() => void sendRequest(noteRequest ?? undefined)}
              >
                <span>Send to agent</span>
              </button>
              <button
                type="button"
                className="knowlery-btn knowlery-btn--outline"
                onClick={() => void copyRequest(noteRequest ?? undefined)}
              >
                <IconClipboard size={14} />
                <span>Copy prompt</span>
              </button>
              {currentConceptId && (
                <button
                  type="button"
                  className="knowlery-btn knowlery-btn--outline"
                  onClick={() => openShareModal(currentConceptId)}
                >
                  <IconExternalLink size={14} />
                  <span>Share this topic…</span>
                </button>
              )}
            </div>
          </article>
        ) : (
          <p className="knowlery-home__note-empty">Open a Markdown note and Knowlery will suggest one small maintenance move for it.</p>
        )}
      </section>

      <KnowledgeHealthSection
        report={staleness}
        onViewAll={() => props.navigate('knowledge-health')}
      />

      <RecentActivitySection
        records={records}
        onViewAll={() => props.navigate('all-activity')}
      />

      <section className="knowlery-home__week">
        <div className="knowlery-section-label">This week</div>
        <article className="knowlery-home__week-card">
          <div className="knowlery-home__week-header">
            <h3>Weekly summary</h3>
            <span className="knowlery-home__week-count">{recordCount} records</span>
          </div>
          <div className="knowlery-home__week-actions">
            <button
              type="button"
              className="knowlery-btn knowlery-btn--primary"
              onClick={() => void generateReport()}
              disabled={generating}
            >
              {generating ? <span className="knowlery-spin"><IconRefresh size={14} /></span> : <IconBookOpen size={14} />}
              <span>{generating ? 'Generating…' : 'Generate summary'}</span>
            </button>
            <button
              type="button"
              className="knowlery-btn knowlery-btn--outline"
              onClick={() => void openLatestReport()}
              disabled={!latestReportExists}
            >
              <IconExternalLink size={14} />
              <span>Open last report</span>
            </button>
            <button
              type="button"
              className="knowlery-btn knowlery-btn--outline"
              onClick={() => void polishWithAgent()}
              disabled={polishing}
            >
              {polishing ? <span className="knowlery-spin"><IconRefresh size={14} /></span> : <IconPlay size={14} />}
              <span>{polishing ? 'Preparing…' : 'Send for review'}</span>
            </button>
          </div>
          <WeeklyReviewStatus dailyReview={dailyReview} onCheckResult={() => void refresh()} />
        </article>
      </section>

      <section className="knowlery-home__bundle">
        <div className="knowlery-section-label">Bundles</div>
        <article className="knowlery-home__bundle-card">
          <div className="knowlery-home__bundle-copy">
            <h3>{bundleSummary && bundleSummary.seeds > 0 ? 'Knowledge bundle review' : 'Pick a topic to share'}</h3>
            <span>
              {bundleSummary && bundleSummary.seeds > 0
                ? `${bundleSummary.approved} approved · ${bundleSummary.unreviewed} need review`
                : 'Create a reviewed bundle from selected knowledge pages.'}
            </span>
          </div>
          <button
            type="button"
            className="knowlery-btn knowlery-btn--primary"
            onClick={() => openShareModal()}
          >
            <IconExternalLink size={14} />
            <span>{bundleSummary && bundleSummary.seeds > 0 ? 'Continue review' : 'Share knowledge…'}</span>
          </button>
        </article>
        <article className="knowlery-home__bundle-card">
          <div className="knowlery-home__bundle-copy">
            <h3>Install a knowledge bundle</h3>
            <span>Add someone else's exported knowledge bundle to this vault.</span>
          </div>
          <button
            type="button"
            className="knowlery-btn knowlery-btn--outline"
            onClick={openInstallModal}
          >
            <IconDownload size={14} />
            <span>Install bundle…</span>
          </button>
        </article>
      </section>

      <InstalledBundlesSection registry={installedBundles} onUninstall={(bundleId) => void removeBundle(bundleId)} />

      <section className="knowlery-home__stats" aria-label="Vault stats">
        {model.stats.map((stat) => (
          <div key={stat.label} className="knowlery-home__stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function InstalledBundlesSection(props: {
  registry: InstalledBundlesFile | null;
  onUninstall: (bundleId: string) => void;
}) {
  const plugin = usePlugin();
  const { registry } = props;
  const [statuses, setStatuses] = useState<Map<string, UpdateStatus> | null>(null);
  const [checking, setChecking] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  if (!registry) return null;
  const entries = Object.entries(registry.bundles);
  if (entries.length === 0) return null;

  // Pull means pull (spec 0.9 f3): checking happens on click, never on load.
  const checkUpdates = async () => {
    setChecking(true);
    try {
      const found = await collectUpdateStatuses(plugin.fs, pluginUpstreamDeps());
      setStatuses(new Map(found.map((status) => [status.id, status])));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : String(error));
    } finally {
      setChecking(false);
    }
  };

  const updateBundle = async (id: string, url: string) => {
    setUpdating(id);
    try {
      // Local-modification protection (spec 0.9 f3, §4.3.3) — the same core check
      // the CLI runs. The dashboard offers no force path; deliberate overwrites
      // go through `knowlery bundle update <id> --force`.
      const entry = registry.bundles[id];
      const changed = await modifiedFiles(plugin.fs, entry);
      if (changed.length > 0) {
        const preview = changed.slice(0, 3).join('\n');
        const more = changed.length > 3 ? `\n…and ${changed.length - 3} more` : '';
        new Notice(
          `${id} was modified locally — updating would overwrite these edits:\n${preview}${more}\n`
          + 'Move your notes into your own pages, or run `knowlery bundle update '
          + `${id} --force\` from the CLI to overwrite.`,
        );
        return;
      }
      const downloaded = await downloadRemoteBundle(url, { fetchImpl: obsidianRemoteFetch });
      try {
        const bundleEntries = await readBundleEntries(downloaded.zipPath);
        await installBundle(plugin.fs, bundleEntries, { source: url });
      } finally {
        await downloaded.cleanup();
      }
      new Notice(`${id} updated.`);
      setStatuses(null);
      plugin.events.trigger('dashboard-refresh');
    } catch (error) {
      new Notice(`Update failed — the installed version is untouched. ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <section className="knowlery-home__installed">
      <div className="knowlery-section-label">
        Installed bundles
        <button
          type="button"
          className="knowlery-btn knowlery-btn--outline knowlery-home__installed-check"
          disabled={checking}
          onClick={() => void checkUpdates()}
        >
          {checking ? 'Checking…' : 'Check updates'}
        </button>
      </div>
      {entries.map(([id, entry]) => {
        const status = statuses?.get(id);
        return (
          <div key={id} className="knowlery-home__installed-row">
            <div className="knowlery-home__installed-body">
              <span className="knowlery-home__installed-title">{entry.title}</span>
              <span className="knowlery-home__installed-meta">
                v{entry.version}
                {status?.kind === 'current' && ' · up to date'}
                {(status?.kind === 'unchecked' || status?.kind === 'skipped' || status?.kind === 'unreachable') && ` · ${status.reason}`}
              </span>
            </div>
            {status?.kind === 'available' && (
              <button
                type="button"
                className="knowlery-btn knowlery-btn--primary"
                disabled={updating !== null}
                onClick={() => void updateBundle(id, status.url)}
              >
                {updating === id ? 'Updating…' : `Update to v${status.latest}`}
              </button>
            )}
            <span className={`knowlery-badge knowlery-badge--${entry.conformance === 'passed' ? 'success' : 'warning'}`}>
              {entry.conformance}
            </span>
            <button
              type="button"
              className="knowlery-btn knowlery-btn--outline"
              onClick={() => props.onUninstall(id)}
            >
              <span>Uninstall</span>
            </button>
          </div>
        );
      })}
    </section>
  );
}

function TodayMoveActions(props: {
  model: TodayModel;
  onAddReflection: () => void;
  onCopyRequest: (request?: string) => void;
  onSendRequest: (request?: string) => void;
  onNavigateAllMoves: () => void;
}) {
  const { model } = props;

  if (model.stage === 'empty-vault') {
    return (
      <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={props.onAddReflection}>
        <IconPlus size={14} />
        <span>{model.primaryAction.label}</span>
      </button>
    );
  }

  if (model.primaryAction.kind === 'local') {
    return (
      <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={props.onNavigateAllMoves}>
        <span>{model.primaryAction.label}</span>
      </button>
    );
  }

  // agent-request: send as primary, copy as secondary
  return (
    <div className="knowlery-home__today-actions">
      <button
        type="button"
        className="knowlery-btn knowlery-btn--primary"
        onClick={() => props.onSendRequest(model.primaryAction.request)}
      >
        <span>{model.primaryAction.label}</span>
      </button>
      <IconActionButton label="Copy prompt" onClick={() => props.onCopyRequest(model.primaryAction.request)}>
        <IconClipboard size={14} />
      </IconActionButton>
    </div>
  );
}

function IconActionButton(props: { label: string; onClick: () => void; children: ReactNode }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!buttonRef.current) return;
    setTooltip(buttonRef.current, props.label, { placement: 'top', delay: 300 });
  }, [props.label]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="knowlery-icon-action"
      onClick={props.onClick}
      aria-label={props.label}
    >
      {props.children}
    </button>
  );
}

function WeeklyReviewStatus(props: {
  dailyReview: {
    request: DailyReviewRequest;
    requestExists: boolean;
    result: DailyReviewParseResult | null;
  } | null;
  onCheckResult: () => void;
}) {
  if (!props.dailyReview) return null;

  const { request, requestExists, result } = props.dailyReview;

  if (result?.ok) {
    return (
      <article className="knowlery-home__week-result">
        <h3>{result.result.title}</h3>
        <p>{result.result.summary}</p>
        <span>Next move: {result.result.nextRecipe}</span>
      </article>
    );
  }

  if (result && !result.ok) {
    return <p className="knowlery-home__week-state">Result file exists, but the JSON is malformed: {result.error}</p>;
  }

  if (requestExists) {
    return (
      <div className="knowlery-home__week-pending">
        <p className="knowlery-home__week-state">Request created. Waiting for agent result at {request.resultPath}.</p>
        <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={props.onCheckResult}>
          <IconRefresh size={14} />
          <span>Check result</span>
        </button>
      </div>
    );
  }

  return null;
}

const MOVES_CAP = 3;

function SuggestedMovesSection(props: {
  moves: DashboardMove[];
  onMoveClick: (move: DashboardMove) => void;
  onViewAll: () => void;
}) {
  const { moves } = props;
  const shown = moves.slice(0, MOVES_CAP);
  return (
    <section className="knowlery-home__moves">
      <div className="knowlery-section-label">Suggested moves</div>
      {shown.map((move) => (
        <button
          key={move.id}
          type="button"
          className="knowlery-home__move"
          onClick={() => props.onMoveClick(move)}
        >
          <div className="knowlery-home__move-body">
            <span className="knowlery-home__move-title">{move.title}</span>
            <span className="knowlery-home__move-meta">{move.meta}</span>
          </div>
          <IconChevronRight size={14} />
        </button>
      ))}
      {moves.length > MOVES_CAP && (
        <button
          type="button"
          className="knowlery-home__viewall"
          onClick={props.onViewAll}
        >
          View all ({moves.length}) →
        </button>
      )}
    </section>
  );
}

const ACTIVITY_CAP = 3;

const STALE_CAP = 3;

function KnowledgeHealthSection(props: {
  report: StalenessReport | null;
  onViewAll: () => void;
}) {
  const { report } = props;
  if (!report) return null; // live snapshot still warming up — the section appears on the next refresh

  const stale = report.stalePages;
  const uncooked = report.uncookedNotes;
  const shown = stale.slice(0, STALE_CAP);
  const summary = [
    stale.length > 0 ? `${stale.length} ${stale.length === 1 ? 'page has' : 'pages have'} changed sources` : null,
    uncooked.length > 0 ? `${uncooked.length} ${uncooked.length === 1 ? 'note' : 'notes'} never compiled` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className="knowlery-home__activity" aria-label="Knowledge health">
      <div className="knowlery-section-label">Knowledge health</div>
      {stale.length === 0 && uncooked.length === 0 ? (
        <p className="knowlery-home__note-empty">Compiled pages are up to date with their sources.</p>
      ) : (
        <>
          <div className="knowlery-home__act">
            <span className="knowlery-home__act-summary">{summary}</span>
          </div>
          {shown.map((finding) => (
            <div key={finding.path} className="knowlery-home__act">
              <span className="knowlery-home__act-summary">{finding.path}</span>
              <span className="knowlery-home__act-meta">
                {finding.changedSources.length} {finding.changedSources.length === 1 ? 'source' : 'sources'} changed
              </span>
            </div>
          ))}
          <div className="knowlery-home__note-actions">
            {stale.length > 0 && (
              <button
                type="button"
                className="knowlery-btn knowlery-btn--outline"
                onClick={() => { void copyPrompt(buildRecookPrompt(report)); }}
              >
                <IconClipboard size={14} />
                <span>Copy re-cook prompt</span>
              </button>
            )}
            <button
              type="button"
              className="knowlery-home__viewall"
              onClick={props.onViewAll}
            >
              View all →
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function RecentActivitySection(props: {
  records: ActivityRecord[];
  onViewAll: () => void;
}) {
  const { records } = props;
  if (records.length === 0) return null;
  const shown = records.slice(0, ACTIVITY_CAP);
  return (
    <section className="knowlery-home__activity">
      <div className="knowlery-section-label">Recent activity</div>
      {shown.map((record, index) => (
        <div key={`${record.time}-${index}`} className="knowlery-home__act">
          <span className="knowlery-home__act-summary">{record.summary}</span>
          <span className="knowlery-home__act-meta">{record.time.slice(0, 10)}</span>
        </div>
      ))}
      {records.length > ACTIVITY_CAP && (
        <button
          type="button"
          className="knowlery-home__viewall"
          onClick={props.onViewAll}
        >
          View all ({records.length}) →
        </button>
      )}
    </section>
  );
}
