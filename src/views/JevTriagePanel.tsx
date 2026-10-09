import { useState, type JSX } from 'react';
import { Notice, requestUrl } from 'obsidian';
import { usePlugin } from '../context';
import type { UncookedNote } from '../core/query/staleness';
import { JEV_PRICE_PER_MTOK, JevError, type JevTransport } from '../core/jev/client';
import {
  buildTriagePrompt,
  CONFIDENT_NO,
  CONFIDENT_YES,
  TRIAGE_CAP,
  triageUncookedNotes,
  type TriageOutcome,
  type TriageScore,
} from '../core/jev/triage';
import { copyPrompt } from './request-actions';
import { IconClipboard, IconSparkles } from './Icons';
import { t } from '../i18n';

/** Plugin-shell transport: requestUrl bypasses renderer CORS, as every other remote call here does. */
const obsidianJevTransport: JevTransport = async (url, headers, body) => {
  const response = await requestUrl({ url, method: 'POST', headers, body, throw: false });
  return { status: response.status, text: response.text };
};

type PanelState =
  | { kind: 'idle' }
  | { kind: 'running'; done: number; total: number }
  | { kind: 'done'; outcome: TriageOutcome }
  | { kind: 'error'; message: string };

function describeError(error: unknown): string {
  if (error instanceof JevError) {
    switch (error.kind) {
      case 'unauthorized':
        return t('jev.error.unauthorized');
      case 'rate-limited':
        return t('jev.error.rateLimited');
      case 'http':
        return t('jev.error.http', { status: error.status ?? 0 });
      case 'malformed':
        return t('jev.error.malformed');
      default: {
        const exhaustive: never = error.kind;
        return String(exhaustive);
      }
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function worthClass(worth: number): string {
  if (worth >= CONFIDENT_YES) return 'knowlery-jev__score--yes';
  if (worth <= CONFIDENT_NO) return 'knowlery-jev__score--no';
  return 'knowlery-jev__score--mid';
}

/**
 * Optional Jev ranking over the uncooked list. Renders nothing more than a hint when
 * no key is configured; the mechanical list underneath is always shown unchanged.
 */
export function JevTriagePanel(props: { uncooked: UncookedNote[]; renderPlainList: () => JSX.Element }) {
  const plugin = usePlugin();
  const [state, setState] = useState<PanelState>({ kind: 'idle' });
  const apiKey = plugin.settings.jevApiKey;

  if (props.uncooked.length === 0) return props.renderPlainList();

  if (!apiKey) {
    return (
      <>
        <div className="knowlery-jev__hint">
          <IconSparkles size={14} />
          <span>{t('jev.hint.noKey')}</span>
          <button type="button" className="knowlery-home__viewall" onClick={() => plugin.openSettingsTab()}>
            {t('jev.hint.openSettings')}
          </button>
        </div>
        {props.renderPlainList()}
      </>
    );
  }

  const run = async () => {
    const snapshot = plugin.liveSnapshot?.snapshot();
    if (!snapshot) return;
    setState({ kind: 'running', done: 0, total: Math.min(props.uncooked.length, TRIAGE_CAP) });
    try {
      const outcome = await triageUncookedNotes(props.uncooked, {
        snapshot,
        apiKey,
        transport: obsidianJevTransport,
        cache: plugin.jevTriageCache,
        readNote: async (path) => {
          const file = plugin.app.vault.getFileByPath(path);
          if (!file) throw new Error(t('jev.error.noteMissing', { path }));
          return plugin.app.vault.cachedRead(file);
        },
        onProgress: (done, total) => setState({ kind: 'running', done, total }),
      });
      if (outcome.scores.length === 0 && outcome.failures.length > 0) {
        setState({ kind: 'error', message: outcome.failures[0].message });
        return;
      }
      setState({ kind: 'done', outcome });
    } catch (error) {
      const message = describeError(error);
      new Notice(message);
      setState({ kind: 'error', message });
    }
  };

  switch (state.kind) {
    case 'idle':
      return (
        <>
          <div className="knowlery-home__note-actions">
            <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={() => { void run(); }}>
              <IconSparkles size={14} />
              <span>{t('jev.action.rank', { count: Math.min(props.uncooked.length, TRIAGE_CAP) })}</span>
            </button>
          </div>
          {props.renderPlainList()}
        </>
      );
    case 'running':
      return (
        <>
          <p className="knowlery-screen__empty">{t('jev.status.running', { done: state.done, total: state.total })}</p>
          {props.renderPlainList()}
        </>
      );
    case 'error':
      return (
        <>
          <div className="knowlery-jev__hint knowlery-jev__hint--error">
            <span>{state.message}</span>
            <button type="button" className="knowlery-home__viewall" onClick={() => { void run(); }}>
              {t('jev.action.retry')}
            </button>
          </div>
          {props.renderPlainList()}
        </>
      );
    case 'done':
      return <RankedList outcome={state.outcome} onRerun={() => { void run(); }} />;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function RankedList(props: { outcome: TriageOutcome; onRerun: () => void }) {
  const { outcome } = props;
  const tokens = outcome.scores.reduce((sum, score) => sum + score.inputTokens, 0);
  const cost = (tokens / 1e6) * JEV_PRICE_PER_MTOK;
  return (
    <>
      <div className="knowlery-jev__hint">
        <IconSparkles size={14} />
        <span>
          {t('jev.status.ranked', { count: outcome.scores.length })}
          {outcome.skipped > 0 ? ` · ${t('jev.status.skipped', { count: outcome.skipped })}` : ''}
          {outcome.failures.length > 0 ? ` · ${t('jev.status.failed', { count: outcome.failures.length })}` : ''}
          {tokens > 0 ? ` · ${t('jev.status.cost', { cost: cost < 0.0001 ? '<0.0001' : cost.toFixed(4) })}` : ''}
        </span>
      </div>
      {outcome.scores.map((score) => <ScoreRow key={score.path} score={score} />)}
      <div className="knowlery-home__note-actions">
        <button
          type="button"
          className="knowlery-btn knowlery-btn--outline"
          onClick={() => { void copyPrompt(buildTriagePrompt(outcome.scores)); }}
        >
          <IconClipboard size={14} />
          <span>{t('jev.action.copyPrompt')}</span>
        </button>
        <button type="button" className="knowlery-home__viewall" onClick={props.onRerun}>
          {t('jev.action.rerun')}
        </button>
      </div>
    </>
  );
}

function ScoreRow(props: { score: TriageScore }) {
  const { score } = props;
  return (
    <div className="knowlery-home__act knowlery-jev__row">
      <span className={`knowlery-jev__score ${worthClass(score.worth)}`} title={t('jev.score.title')}>
        {score.worth.toFixed(2)}
      </span>
      <span className="knowlery-home__act-summary">
        {score.path}
        <span className="knowlery-home__act-meta">
          {' → '}
          {score.target ? t('jev.target.update', { path: score.target.path }) : t('jev.target.new')}
        </span>
      </span>
      <span className="knowlery-home__act-meta">{new Date(score.mtimeMs).toISOString().slice(0, 10)}</span>
    </div>
  );
}
