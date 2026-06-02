import type { TFile } from 'obsidian';
import { Notice, setTooltip } from 'obsidian';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePlugin } from '../context';
import type { DashboardRefreshPayload, DashboardScreen } from '../types';
import type { TodayModel } from '../core/today-model';
import { buildTodayModel } from '../core/today-model';
import { readRecentActivityRecords } from '../core/activity-ledger';
import { getVaultStats } from '../core/vault-health';
import { sendPromptToClaudian } from '../core/claudian-bridge';
import { withActivityLedgerReminder } from '../core/agent-request';
import { ReflectionCaptureModal } from '../modals/reflection-capture';
import { IconClipboard, IconPlus } from './Icons';

export function DashboardHome(props: { navigate: (screen: DashboardScreen, payload?: unknown) => void }) {
  const plugin = usePlugin();
  const [model, setModel] = useState<TodayModel | null>(null);
  const initialFile = plugin.app.workspace.getActiveFile();
  const [file, setFile] = useState<TFile | null>(initialFile?.extension === 'md' ? initialFile : null);

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const activity = await readRecentActivityRecords(plugin.app, 14);
    setModel(buildTodayModel(getVaultStats(plugin.app), activity.records));
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
