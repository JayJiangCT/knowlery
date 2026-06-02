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
import { withActivityLedgerReminder } from '../core/agent-request';
import type { DailyReviewParseResult, DailyReviewRequest } from '../core/agent-review';
import { buildDailyReviewRequest, readDailyReviewResult, writeDailyReviewRequest } from '../core/agent-review';
import { buildWeeklyBakeModel, REPORT_DIR, writeWeeklyBakeReport } from '../core/weekly-bake';
import { RECIPE_BOOK } from '../core/moves';
import { ReflectionCaptureModal } from '../modals/reflection-capture';
import { IconBookOpen, IconChevronRight, IconClipboard, IconExternalLink, IconPlay, IconPlus, IconRefresh } from './Icons';

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

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const activity = await readRecentActivityRecords(plugin.app, 14);
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
    if (payload) plugin.events.trigger('dashboard-refresh-complete', payload);
  }, [plugin]);

  useEffect(() => {
    refresh();
    const ref = plugin.events.on('dashboard-refresh', (payload?: DashboardRefreshPayload) => {
      refresh(payload);
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
    new ReflectionCaptureModal(plugin.app, plugin, () => refresh()).open();
  };

  const copyRequest = async (request?: string) => {
    if (!request) {
      new Notice('No agent request prepared yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(withActivityLedgerReminder(request));
      new Notice('Agent request copied.');
    } catch {
      new Notice('Could not copy agent request.');
    }
  };

  const sendRequest = async (request?: string) => {
    if (!request) {
      new Notice('No agent request prepared yet.');
      return;
    }
    const sent = await sendPromptToClaudian(plugin.app, withActivityLedgerReminder(request));
    if (sent) {
      new Notice('Request sent to claudian.');
      return;
    }
    await copyRequest(request);
  };

  const generateReport = async () => {
    setGenerating(true);
    try {
      const result = await readRecentActivityRecords(plugin.app, 7);
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
      const result = await readRecentActivityRecords(plugin.app, 7);
      const request = buildDailyReviewRequest(result.records);
      await writeDailyReviewRequest(plugin.app, request);
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
          onCopyRequest={copyRequest}
          onSendRequest={sendRequest}
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
                onClick={() => sendRequest(noteRequest ?? undefined)}
              >
                <span>Send to agent</span>
              </button>
              <button
                type="button"
                className="knowlery-btn knowlery-btn--outline"
                onClick={() => copyRequest(noteRequest ?? undefined)}
              >
                <IconClipboard size={14} />
                <span>Copy prompt</span>
              </button>
            </div>
          </article>
        ) : (
          <p className="knowlery-home__note-empty">Open a Markdown note and Knowlery will suggest one small maintenance move for it.</p>
        )}
      </section>

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
              onClick={generateReport}
              disabled={generating}
            >
              {generating ? <IconRefresh size={14} /> : <IconBookOpen size={14} />}
              <span>{generating ? 'Generating…' : 'Generate summary'}</span>
            </button>
            <button
              type="button"
              className="knowlery-btn knowlery-btn--outline"
              onClick={openLatestReport}
              disabled={!latestReportExists}
            >
              <IconExternalLink size={14} />
              <span>Open last report</span>
            </button>
            <button
              type="button"
              className="knowlery-btn knowlery-btn--outline"
              onClick={polishWithAgent}
              disabled={polishing}
            >
              {polishing ? <IconRefresh size={14} /> : <IconPlay size={14} />}
              <span>{polishing ? 'Preparing…' : 'Send for review'}</span>
            </button>
          </div>
          <WeeklyReviewStatus dailyReview={dailyReview} onCheckResult={() => refresh()} />
        </article>
      </section>

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
        <span>Next recipe: {result.result.nextRecipe}</span>
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
