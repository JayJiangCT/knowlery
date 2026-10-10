import { useState, type JSX } from 'react';
import { Notice } from 'obsidian';
import { usePlugin } from '../context';
import type { StalenessReport, UncookedNote } from '../core/query/staleness';
import { JEV_PRICE_PER_MTOK, JevError } from '../core/jev/client';
import { CONFIDENT_NO, CONFIDENT_YES, type TriageOutcome } from '../core/jev/triage';
import { buildTriagePrompt, scoredNotesOf, unscoredNotes } from '../core/jev/triage-store';
import { copyPrompt } from './request-actions';
import { IconClipboard, IconSparkles } from './Icons';
import { t } from '../i18n';

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

export function worthClass(worth: number): string {
  if (worth >= CONFIDENT_YES) return 'knowlery-jev__score--yes';
  if (worth <= CONFIDENT_NO) return 'knowlery-jev__score--no';
  return 'knowlery-jev__score--mid';
}

/** Score badge for an annotated uncooked note; the list renderer places it before the path. */
export function JevScore(props: { note: UncookedNote }) {
  const { jev } = props.note;
  if (!jev) return null;
  return (
    <span className={`knowlery-jev__score ${worthClass(jev.worth)}`} title={t('jev.score.title')}>
      {jev.worth.toFixed(2)}
    </span>
  );
}

/** Suggested target page for an annotated note; rendered after the path. */
export function JevTarget(props: { note: UncookedNote }) {
  const { jev } = props.note;
  if (!jev) return null;
  return (
    <span className="knowlery-home__act-meta">
      {' → '}
      {jev.target ? t('jev.target.update', { path: jev.target.path }) : t('jev.target.new')}
    </span>
  );
}

/**
 * Optional Jev ranking over the uncooked list. The list itself is rendered by the
 * parent from the staleness report, which already carries scores from
 * `.knowlery/triage.json` — so whatever scored the notes (this button, the background
 * scorer, or `knowlery stale` with a key) shows up here identically. This panel only
 * adds the controls: score what is unscored, copy the ranked prompt, or point at
 * settings when no key exists. The mechanical list underneath is never hidden.
 */
export function JevTriagePanel(props: { report: StalenessReport; renderList: () => JSX.Element }) {
  const plugin = usePlugin();
  const [state, setState] = useState<PanelState>({ kind: 'idle' });
  const apiKey = plugin.settings.jevApiKey;
  const { uncookedNotes } = props.report;

  if (uncookedNotes.length === 0) return props.renderList();

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
        {props.renderList()}
      </>
    );
  }

  const scored = scoredNotesOf(props.report);
  const snapshot = plugin.liveSnapshot?.snapshot();
  const pending = snapshot?.triage ? unscoredNotes(uncookedNotes, snapshot.triage).length : uncookedNotes.length;

  const run = async () => {
    setState({ kind: 'running', done: 0, total: pending });
    try {
      // Rank scores the whole backlog; the background top-up stays capped per pass.
      const result = await plugin.jevScorer.runAll((done, total) => setState({ kind: 'running', done, total }));
      if (!result) {
        setState({ kind: 'idle' });
        return;
      }
      if (result.scores.length === 0 && result.failures.length > 0) {
        setState({ kind: 'error', message: result.failures[0].message });
        return;
      }
      setState({ kind: 'done', outcome: { scores: result.scores, failures: result.failures, skipped: result.remaining } });
    } catch (error) {
      const message = describeError(error);
      new Notice(message);
      setState({ kind: 'error', message });
    }
  };

  const copy = () => { void copyPrompt(buildTriagePrompt(scored)); };

  const status = (() => {
    switch (state.kind) {
      case 'idle':
        return null;
      case 'running':
        return <p className="knowlery-screen__empty">{t('jev.status.running', { done: state.done, total: state.total })}</p>;
      case 'error':
        return (
          <div className="knowlery-jev__hint knowlery-jev__hint--error">
            <span>{state.message}</span>
            <button type="button" className="knowlery-home__viewall" onClick={() => { void run(); }}>
              {t('jev.action.retry')}
            </button>
          </div>
        );
      case 'done':
        return <RunSummary outcome={state.outcome} />;
      default: {
        const exhaustive: never = state;
        return exhaustive;
      }
    }
  })();

  return (
    <>
      {scored.length > 0 && state.kind !== 'done' && (
        <div className="knowlery-jev__hint">
          <IconSparkles size={14} />
          <span>
            {t('jev.status.scoredOf', { scored: scored.length, total: uncookedNotes.length })}
            {plugin.settings.jevAutoRank ? ` · ${t('jev.status.autoOn')}` : ''}
          </span>
        </div>
      )}
      {status}
      <div className="knowlery-home__note-actions">
        {pending > 0 && state.kind !== 'running' && (
          <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={() => { void run(); }}>
            <IconSparkles size={14} />
            <span>{t('jev.action.rank', { count: pending })}</span>
          </button>
        )}
        {scored.length > 0 && (
          <button type="button" className="knowlery-btn knowlery-btn--outline" onClick={copy}>
            <IconClipboard size={14} />
            <span>{t('jev.action.copyPrompt')}</span>
          </button>
        )}
      </div>
      {props.renderList()}
    </>
  );
}

function RunSummary(props: { outcome: TriageOutcome }) {
  const { outcome } = props;
  const tokens = outcome.scores.reduce((sum, score) => sum + score.inputTokens, 0);
  const cost = (tokens / 1e6) * JEV_PRICE_PER_MTOK;
  return (
    <div className="knowlery-jev__hint">
      <IconSparkles size={14} />
      <span>
        {t('jev.status.ranked', { count: outcome.scores.length })}
        {outcome.skipped > 0 ? ` · ${t('jev.status.skipped', { count: outcome.skipped })}` : ''}
        {outcome.failures.length > 0 ? ` · ${t('jev.status.failed', { count: outcome.failures.length })}` : ''}
        {tokens > 0 ? ` · ${t('jev.status.cost', { cost: cost < 0.0001 ? '<0.0001' : cost.toFixed(4) })}` : ''}
      </span>
    </div>
  );
}
