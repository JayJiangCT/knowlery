import type { TFile } from 'obsidian';
import { Notice } from 'obsidian';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlugin } from '../context';
import type { CounterSummary, DashboardRefreshPayload } from '../types';
import { buildCounterSummary } from '../core/activity-model';
import { readRecentActivityRecords } from '../core/activity-ledger';
import { sendPromptToClaudian } from '../core/claudian-bridge';
import { IconClipboard, IconPlay, IconRefresh } from './Icons';

export function ThisNoteTab() {
  const plugin = usePlugin();
  const initialFile = plugin.app.workspace.getActiveFile();
  const [file, setFile] = useState<TFile | null>(initialFile?.extension === 'md' ? initialFile : null);
  const [summary, setSummary] = useState<CounterSummary | null>(null);

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const activeFile = plugin.app.workspace.getActiveFile();
    setFile((previous) => activeFile?.extension === 'md' ? activeFile : previous);
    const activity = await readRecentActivityRecords(plugin.app, 14);
    setSummary(buildCounterSummary(activity.records, activity.errors.length));
    if (payload) plugin.events.trigger('dashboard-refresh-complete', payload);
  }, [plugin]);

  useEffect(() => {
    refresh();
    const fileOpenRef = plugin.app.workspace.on('file-open', (nextFile) => {
      if (nextFile?.extension === 'md') setFile(nextFile);
    });
    const activeLeafRef = plugin.app.workspace.on('active-leaf-change', () => {
      const activeFile = plugin.app.workspace.getActiveFile();
      if (activeFile?.extension === 'md') setFile(activeFile);
    });
    const refreshRef = plugin.events.on('dashboard-refresh', (payload?: DashboardRefreshPayload) => {
      refresh(payload);
    });
    return () => {
      plugin.app.workspace.offref(fileOpenRef);
      plugin.app.workspace.offref(activeLeafRef);
      plugin.events.offref(refreshRef);
    };
  }, [plugin, refresh]);

  const noteContext = useMemo(() => {
    if (!file || !summary) return null;
    const basename = file.basename.toLowerCase();
    const path = file.path.toLowerCase();
    const threads = summary.knowledgeThreads.filter((thread) => {
      return thread.relatedFiles.some((related) => related.toLowerCase() === path)
        || thread.topics.some((topic) => basename.includes(topic.toLowerCase()) || topic.toLowerCase().includes(basename));
    });
    return {
      threads,
      request: `请围绕当前笔记「${file.basename}」做一次知识复盘：先找出相关旧笔记和对比笔记，再判断哪些连接、问题或结构值得写回知识库。`,
    };
  }, [file, summary]);

  const copyRequest = async () => {
    if (!noteContext) return;
    try {
      await navigator.clipboard.writeText(noteContext.request);
      new Notice('Current note request copied.');
    } catch {
      new Notice('Could not copy current note request.');
    }
  };

  const sendRequest = async () => {
    if (!noteContext) return;
    const sent = await sendPromptToClaudian(plugin.app, noteContext.request);
    if (sent) {
      new Notice('Current note request sent to Claudian.');
      return;
    }
    await copyRequest();
  };

  if (!file) {
    return (
      <div className="knowlery-note">
        <section className="knowlery-counter__hero">
          <div>
            <div className="knowlery-section-label">This note</div>
            <p>Open a Markdown note and Knowlery will suggest one small maintenance move for it.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="knowlery-note">
      <section className="knowlery-counter__hero">
        <div>
          <div className="knowlery-section-label">This note</div>
          <h2>{file.basename}</h2>
          <p>Knowlery is reading the current Obsidian note as the center of this review surface.</p>
        </div>
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Suggested recipe</div>
        <article className="knowlery-counter__thread">
          <div className="knowlery-counter__thread-header">
            <div>
              <h3>Connect current note</h3>
              <span>{file.path}</span>
            </div>
            <span className="knowlery-counter__thread-state">explore + cook</span>
          </div>
          <p>{noteContext?.request}</p>
          <div className="knowlery-counter__report-buttons">
            <button className="knowlery-btn knowlery-btn--outline" onClick={copyRequest}>
              <IconClipboard size={14} />
              <span>Copy note prompt</span>
            </button>
            <button className="knowlery-btn knowlery-btn--outline" onClick={sendRequest}>
              <IconPlay size={14} />
              <span>Send note review</span>
            </button>
          </div>
        </article>
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Related activity</div>
        {noteContext && noteContext.threads.length > 0 ? (
          <div className="knowlery-counter__thread-list">
            {noteContext.threads.map((thread) => (
              <article key={thread.id} className="knowlery-counter__thread">
                <div className="knowlery-counter__thread-header">
                  <div>
                    <h3>{thread.title}</h3>
                    <span>{thread.recordsCount} activity records</span>
                  </div>
                  <span className="knowlery-counter__thread-state">Next: {thread.nextMove}</span>
                </div>
                <p>{thread.nextMoveReason}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="knowlery-counter__empty">No recent Knowlery activity is linked to this note yet.</p>
        )}
      </section>

      <button className="knowlery-btn knowlery-btn--ghost" onClick={() => refresh()}>
        <IconRefresh size={14} />
        <span>Refresh context</span>
      </button>
    </div>
  );
}
