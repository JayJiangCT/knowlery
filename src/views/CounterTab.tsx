import { normalizePath, Notice } from 'obsidian';
import { useCallback, useEffect, useState } from 'react';
import { usePlugin } from '../context';
import type { CounterSummary, DashboardRefreshPayload } from '../types';
import { buildCounterSummary } from '../core/activity-model';
import { readRecentActivityRecords } from '../core/activity-ledger';
import { buildWeeklyBakeModel, REPORT_DIR, writeWeeklyBakeReport } from '../core/weekly-bake';
import { ReflectionCaptureModal } from '../modals/reflection-capture';
import { IconBookOpen, IconExternalLink, IconPlus, IconRefresh } from './Icons';

const LATEST_REPORT_PATH = `${REPORT_DIR}/latest.html`;

export function CounterTab() {
  const plugin = usePlugin();
  const [summary, setSummary] = useState<CounterSummary | null>(null);
  const [generating, setGenerating] = useState(false);
  const [latestReportExists, setLatestReportExists] = useState(false);

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const result = await readRecentActivityRecords(plugin.app, 14);
    setSummary(buildCounterSummary(result.records, result.errors.length));
    setLatestReportExists(await plugin.app.vault.adapter.exists(normalizePath(LATEST_REPORT_PATH)));
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

  const generateReport = async () => {
    setGenerating(true);
    try {
      const result = await readRecentActivityRecords(plugin.app, 7);
      const model = buildWeeklyBakeModel(result.records);
      const written = await writeWeeklyBakeReport(plugin.app, model);
      setLatestReportExists(true);
      new Notice(`Weekly Bake generated: ${written.latestPath}`);
      await refresh();
    } finally {
      setGenerating(false);
    }
  };

  const openLatestReport = async () => {
    const path = normalizePath(LATEST_REPORT_PATH);
    const adapter = plugin.app.vault.adapter;
    if (!(await adapter.exists(path))) {
      new Notice('No Weekly Bake report has been generated yet.');
      setLatestReportExists(false);
      return;
    }

    const fullPath = (adapter as any).getFullPath(path) as string | undefined;
    if (!fullPath) {
      new Notice(`Weekly Bake report is at ${path}`);
      return;
    }

    const { shell } = (window as any).require('electron');
    shell.openPath(fullPath);
  };

  if (!summary) {
    return <div className="knowlery-counter" />;
  }

  return (
    <div className="knowlery-counter">
      <section className="knowlery-counter__hero">
        <div>
          <div className="knowlery-section-label">Counter</div>
          <p>Your quiet surface for recent agent work, open questions, and notes worth baking.</p>
        </div>
        <button className="knowlery-btn knowlery-btn--outline" onClick={addReflection}>
          <IconPlus size={14} />
          <span>Add reflection</span>
        </button>
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Active threads</div>
        {summary.knowledgeThreads.length === 0 ? (
          <EmptyCounterLine text="No active knowledge threads yet." />
        ) : (
          <div className="knowlery-counter__thread-list">
            {summary.knowledgeThreads.map((thread) => (
              <article key={thread.id} className="knowlery-counter__thread">
                <div className="knowlery-counter__thread-header">
                  <div>
                    <h3>{thread.title}</h3>
                    <span>
                      {thread.recordsCount} records · {thread.relatedFiles.length} files ·{' '}
                      {new Date(thread.lastSeen).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="knowlery-counter__thread-state">
                    Stage: {thread.stage} · Next: {thread.nextMove}
                  </span>
                </div>
                <p>{thread.nextMoveReason}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Recurring themes</div>
        {summary.recurringThemes.length === 0 ? (
          <EmptyCounterLine text="No themes yet. Activity records will appear here after agents or reflections leave summaries." />
        ) : (
          <div className="knowlery-counter__theme-list">
            {summary.recurringThemes.map((theme) => (
              <div key={theme.name} className="knowlery-counter__theme">
                <span>{theme.name}</span>
                <strong>{theme.count}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Recent agent work</div>
        {summary.recentAgentWork.length === 0 ? (
          <EmptyCounterLine text="No recent activity receipts found." />
        ) : (
          <div className="knowlery-counter__work-list">
            {summary.recentAgentWork.map((record) => (
              <article key={`${record.time}-${record.summary}`} className="knowlery-counter__work">
                <span className="knowlery-counter__work-meta">
                  {record.agent} · {new Date(record.time).toLocaleString()}
                </span>
                <p>{record.summary}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Unbaked notes</div>
        {summary.unbakedNotes.length === 0 ? (
          <EmptyCounterLine text="Nothing is marked unbaked right now." />
        ) : (
          <div className="knowlery-counter__work-list">
            {summary.unbakedNotes.map((record) => (
              <article key={`${record.time}-${record.summary}`} className="knowlery-counter__work">
                <p>{record.summary}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Weekly Bake</div>
        <div className="knowlery-counter__report-actions">
          <div className="knowlery-counter__report-buttons">
            <button className="knowlery-btn knowlery-btn--outline" onClick={generateReport} disabled={generating}>
              {generating ? <IconRefresh size={14} /> : <IconBookOpen size={14} />}
              <span>{generating ? 'Generating...' : 'Generate report'}</span>
            </button>
            <button
              className="knowlery-btn knowlery-btn--outline"
              onClick={openLatestReport}
              disabled={!latestReportExists}
            >
              <IconExternalLink size={14} />
              <span>Open latest</span>
            </button>
          </div>
          <span className="knowlery-counter__coverage">
            {summary.coverage.recordsLogged} records · {summary.coverage.malformedRecords} malformed
          </span>
        </div>
      </section>
    </div>
  );
}

function EmptyCounterLine(props: { text: string }) {
  return <p className="knowlery-counter__empty">{props.text}</p>;
}
