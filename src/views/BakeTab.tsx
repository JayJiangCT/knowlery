import { normalizePath, Notice } from 'obsidian';
import { useCallback, useEffect, useState } from 'react';
import { usePlugin } from '../context';
import type { DashboardRefreshPayload } from '../types';
import type { DailyReviewParseResult, DailyReviewRequest } from '../core/agent-review';
import { readRecentActivityRecords } from '../core/activity-ledger';
import {
  buildDailyReviewRequest,
  readDailyReviewResult,
  writeDailyReviewRequest,
} from '../core/agent-review';
import { sendPromptToClaudian } from '../core/claudian-bridge';
import { buildWeeklyBakeModel, REPORT_DIR, writeWeeklyBakeReport } from '../core/weekly-bake';
import { IconBookOpen, IconExternalLink, IconRefresh, IconPlay } from './Icons';

const LATEST_REPORT_PATH = `${REPORT_DIR}/latest.html`;

export function BakeTab() {
  const plugin = usePlugin();
  const [generating, setGenerating] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [latestReportExists, setLatestReportExists] = useState(false);
  const [dailyReview, setDailyReview] = useState<{
    request: DailyReviewRequest;
    requestExists: boolean;
    result: DailyReviewParseResult | null;
  } | null>(null);
  const [recordCount, setRecordCount] = useState(0);

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const activity = await readRecentActivityRecords(plugin.app, 14);
    const request = buildDailyReviewRequest(activity.records);
    setRecordCount(activity.records.length);
    setLatestReportExists(await plugin.app.vault.adapter.exists(normalizePath(LATEST_REPORT_PATH)));
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

  const generateReport = async () => {
    setGenerating(true);
    try {
      const result = await readRecentActivityRecords(plugin.app, 7);
      const written = await writeWeeklyBakeReport(plugin.app, buildWeeklyBakeModel(result.records));
      setLatestReportExists(true);
      new Notice(`Weekly Atlas generated: ${written.latestPath}`);
      await refresh();
    } finally {
      setGenerating(false);
    }
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
        new Notice('Review polish request sent to Claudian.');
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

  const openLatestReport = async () => {
    const path = normalizePath(LATEST_REPORT_PATH);
    const adapter = plugin.app.vault.adapter;
    if (!(await adapter.exists(path))) {
      new Notice('No Weekly Atlas has been generated yet.');
      setLatestReportExists(false);
      return;
    }

    const fullPath = (adapter as any).getFullPath(path) as string | undefined;
    if (!fullPath) {
      new Notice(`Weekly Atlas is at ${path}`);
      return;
    }

    const { shell } = (window as any).require('electron');
    shell.openPath(fullPath);
  };

  return (
    <div className="knowlery-bake">
      <section className="knowlery-counter__hero">
        <div>
          <div className="knowlery-section-label">Weekly Review</div>
          <p>Turn recent knowledge activity into a local atlas first. Use an agent only when you explicitly want a more polished written review.</p>
        </div>
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Knowledge Atlas</div>
        <div className="knowlery-counter__report-actions">
          <div className="knowlery-counter__report-buttons">
            <button className="knowlery-btn knowlery-btn--outline" onClick={generateReport} disabled={generating}>
              {generating ? <IconRefresh size={14} /> : <IconBookOpen size={14} />}
              <span>{generating ? 'Generating...' : 'Generate atlas'}</span>
            </button>
            <button className="knowlery-btn knowlery-btn--outline" onClick={openLatestReport} disabled={!latestReportExists}>
              <IconExternalLink size={14} />
              <span>Open latest</span>
            </button>
          </div>
          <span className="knowlery-counter__coverage">{recordCount} records</span>
        </div>
      </section>

      <section className="knowlery-counter__section">
        <div className="knowlery-section-label">Polish with agent</div>
        <div className="knowlery-counter__review">
          <DailyReviewStatus dailyReview={dailyReview} />
          <div className="knowlery-counter__report-buttons">
            <button className="knowlery-btn knowlery-btn--outline" onClick={polishWithAgent} disabled={polishing}>
              {polishing ? <IconRefresh size={14} /> : <IconPlay size={14} />}
              <span>{polishing ? 'Preparing...' : 'Send polish request'}</span>
            </button>
            <button className="knowlery-btn knowlery-btn--outline" onClick={() => refresh()}>
              <IconRefresh size={14} />
              <span>Check result</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function DailyReviewStatus(props: {
  dailyReview: {
    request: DailyReviewRequest;
    requestExists: boolean;
    result: DailyReviewParseResult | null;
  } | null;
}) {
  if (!props.dailyReview) return <p className="knowlery-counter__empty">No review context loaded yet.</p>;

  const { request, requestExists, result } = props.dailyReview;
  if (result?.ok) {
    return (
      <article className="knowlery-counter__review-result">
        <h3>{result.result.title}</h3>
        <p>{result.result.summary}</p>
        <span>Next recipe: {result.result.nextRecipe}</span>
      </article>
    );
  }

  if (result && !result.ok) {
    return <p className="knowlery-counter__review-state">Result file exists, but the JSON is malformed: {result.error}</p>;
  }

  if (requestExists) {
    return <p className="knowlery-counter__review-state">Request created. Waiting for agent result at {request.resultPath}.</p>;
  }

  return <p className="knowlery-counter__review-state">Create a request when you want Claudian to write a more polished review.</p>;
}
