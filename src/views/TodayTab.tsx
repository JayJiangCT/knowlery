import { normalizePath, Notice, setTooltip } from 'obsidian';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePlugin } from '../context';
import type { DashboardRefreshPayload } from '../types';
import type { TodayModel } from '../core/today-model';
import { readRecentActivityRecords } from '../core/activity-ledger';
import { buildTodayModel } from '../core/today-model';
import type { LatestDailyReviewResult } from '../core/agent-review';
import { readLatestDailyReviewResult } from '../core/agent-review';
import { getVaultStats } from '../core/vault-health';
import { buildWeeklyBakeModel, REPORT_DIR, writeWeeklyBakeReport } from '../core/weekly-bake';
import { sendPromptToClaudian } from '../core/claudian-bridge';
import { ReflectionCaptureModal } from '../modals/reflection-capture';
import { IconBookOpen, IconClipboard, IconPlay, IconPlus, IconRefresh } from './Icons';

export function TodayTab() {
  const plugin = usePlugin();
  const [model, setModel] = useState<TodayModel | null>(null);
  const [latestReview, setLatestReview] = useState<LatestDailyReviewResult | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const activity = await readRecentActivityRecords(plugin.app, 14);
    setModel(buildTodayModel(getVaultStats(plugin.app), activity.records));
    setLatestReview(await readLatestDailyReviewResult(plugin.app));
    if (payload) plugin.events.trigger('dashboard-refresh-complete', payload);
  }, [plugin]);

  useEffect(() => {
    refresh();
    const ref = plugin.events.on('dashboard-refresh', (payload?: DashboardRefreshPayload) => {
      refresh(payload);
    });
    return () => plugin.events.offref(ref);
  }, [plugin, refresh]);

  const addReflection = () => {
    new ReflectionCaptureModal(plugin.app, plugin, () => refresh()).open();
  };

  const copyRequest = async (request?: string) => {
    if (!request) {
      new Notice('No agent request prepared yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(request);
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

    const sent = await sendPromptToClaudian(plugin.app, request);
    if (sent) {
      new Notice('Request sent to Claudian.');
      return;
    }

    await copyRequest(request);
  };

  const generateReport = async () => {
    setBusy(true);
    try {
      const result = await readRecentActivityRecords(plugin.app, 7);
      const written = await writeWeeklyBakeReport(plugin.app, buildWeeklyBakeModel(result.records));
      new Notice(`Weekly Atlas generated: ${written.latestPath}`);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const openRecipes = () => {
    plugin.events.trigger('dashboard-open-tab', 'recipes');
  };

  if (!model) return <div className="knowlery-today" />;

  return (
    <div className="knowlery-today">
      <section className={`knowlery-today__hero knowlery-today__hero--${model.stage}`}>
        <div>
          <div className="knowlery-section-label">Today</div>
          <h2>{model.title}</h2>
          <p>{model.body}</p>
        </div>
        <TodayPrimaryAction
          model={model}
          busy={busy}
          onAddReflection={addReflection}
          onCopyRequest={copyRequest}
          onSendRequest={sendRequest}
          onGenerateReport={generateReport}
        />
      </section>

      <section className="knowlery-today__stats" aria-label="Today stats">
        {model.stats.map((stat) => (
          <div key={stat.label} className="knowlery-today__stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>

      <LatestReviewCard latestReview={latestReview} />

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">
          {model.stage === 'returning' ? 'Active threads' : 'Suggested next steps'}
        </div>
        {model.stage === 'returning' ? (
          <ReturningToday model={model} />
        ) : (
          <FirstSteps model={model} onAddReflection={addReflection} onCopyRequest={copyRequest} onOpenRecipes={openRecipes} />
        )}
      </section>
    </div>
  );
}

function LatestReviewCard(props: { latestReview: LatestDailyReviewResult | null }) {
  if (!props.latestReview) return null;

  const { result, path } = props.latestReview;
  if (!result.ok) {
    return (
      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Latest agent review</div>
        <p className="knowlery-counter__review-state">Review exists at {path}, but the JSON is malformed: {result.error}</p>
      </section>
    );
  }

  return (
    <section className="knowlery-counter__section">
      <div className="knowlery-section-label">Latest agent review</div>
      <article className="knowlery-counter__review-result">
        <h3>{result.result.title}</h3>
        <p>{result.result.summary}</p>
        <span>Next recipe: {result.result.nextRecipe}</span>
      </article>
    </section>
  );
}

function TodayPrimaryAction(props: {
  model: TodayModel;
  busy: boolean;
  onAddReflection: () => void;
  onCopyRequest: (request?: string) => void;
  onSendRequest: (request?: string) => void;
  onGenerateReport: () => void;
}) {
  const { model } = props;
  if (model.stage === 'empty-vault') {
    return (
      <button className="knowlery-btn knowlery-btn--outline" onClick={props.onAddReflection}>
        <IconPlus size={14} />
        <span>{model.primaryAction.label}</span>
      </button>
    );
  }

  if (model.primaryAction.kind === 'report') {
    return (
      <button className="knowlery-btn knowlery-btn--outline" onClick={props.onGenerateReport} disabled={props.busy}>
        {props.busy ? <IconRefresh size={14} /> : <IconBookOpen size={14} />}
        <span>{props.busy ? 'Generating...' : model.primaryAction.label}</span>
      </button>
    );
  }

  return (
    <div className="knowlery-hero-actions">
      <IconActionButton label="Copy prompt" onClick={() => props.onCopyRequest(model.primaryAction.request)}>
        <IconClipboard size={14} />
      </IconActionButton>
      <IconActionButton label="Send to Claudian" onClick={() => props.onSendRequest(model.primaryAction.request)}>
        <IconPlay size={14} />
      </IconActionButton>
    </div>
  );
}

function IconActionButton(props: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
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

function FirstSteps(props: {
  model: TodayModel;
  onAddReflection: () => void;
  onCopyRequest: (request?: string) => void;
  onOpenRecipes: () => void;
}) {
  return (
    <div className="knowlery-today__steps">
      {props.model.secondaryActions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="knowlery-today__step"
          onClick={() => {
            if (action.label === 'Add reflection') props.onAddReflection();
            else if (action.kind === 'agent-request') props.onCopyRequest(action.request);
            else props.onOpenRecipes();
          }}
        >
          <span>{action.label}</span>
          <small>{action.kind === 'agent-request' ? 'Prepares an agent request' : 'Works locally in Knowlery'}</small>
        </button>
      ))}
    </div>
  );
}

function ReturningToday(props: { model: TodayModel }) {
  const summary = props.model.summary;
  if (summary.knowledgeThreads.length === 0) {
    return <p className="knowlery-counter__empty">No active knowledge threads yet.</p>;
  }

  return (
    <div className="knowlery-counter__thread-list">
      {summary.knowledgeThreads.map((thread) => (
        <article key={thread.id} className="knowlery-counter__thread">
          <div className="knowlery-counter__thread-header">
            <div>
              <h3>{thread.title}</h3>
              <span>
                {thread.recordsCount} records · {thread.relatedFiles.length} files · {new Date(thread.lastSeen).toLocaleDateString()}
              </span>
            </div>
            <span className="knowlery-counter__thread-state">Next: {thread.nextMove}</span>
          </div>
          <p>{thread.nextMoveReason}</p>
        </article>
      ))}
    </div>
  );
}

export const LATEST_REPORT_PATH = normalizePath(`${REPORT_DIR}/latest.html`);
