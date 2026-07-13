import { useEffect, useState } from 'react';
import { usePlugin } from '../context';
import type { ActivityRecord, DashboardMove, DashboardScreen } from '../types';
import { getRecipeBook } from '../core/moves';
import { readRecentActivityRecords } from '../core/activity-ledger';
import { buildRecookPrompt, computeStaleness, type StalenessReport } from '../core/query/staleness';
import { sendPromptToAgent, copyPrompt } from './request-actions';
import { IconChevronLeft, IconChevronRight, IconClipboard } from './Icons';
import { t } from '../i18n';

function Back(props: { navigate: (s: DashboardScreen, payload?: unknown) => void; label: string; ariaDestination?: string }) {
  return (
    <button
      type="button"
      className="knowlery-screen__back"
      onClick={() => props.navigate('home')}
      aria-label={t('screens.backTo', { destination: props.ariaDestination ?? props.label })}
    >
      <IconChevronLeft size={16} />
      {props.label}
    </button>
  );
}

function AllMovesScreen(props: { navigate: (s: DashboardScreen, payload?: unknown) => void }) {
  return (
    <div className="knowlery-screen">
      <Back navigate={props.navigate} label={t('home.suggestedMoves')} />
      <section className="knowlery-home__moves">
        {getRecipeBook().map((move) => (
          <button
            key={move.id}
            type="button"
            className="knowlery-home__move"
            onClick={() => props.navigate('move-detail', move)}
          >
            <div className="knowlery-home__move-body">
              <span className="knowlery-home__move-title">{move.title}</span>
              <span className="knowlery-home__move-meta">{move.meta}</span>
            </div>
            <IconChevronRight size={14} />
          </button>
        ))}
      </section>
    </div>
  );
}

function AllActivityScreen(props: { navigate: (s: DashboardScreen, payload?: unknown) => void }) {
  const plugin = usePlugin();
  const [records, setRecords] = useState<ActivityRecord[]>([]);

  useEffect(() => {
    void readRecentActivityRecords(plugin.fs, 50).then(({ records: loaded }) => {
      setRecords(loaded);
    });
  }, [plugin]);

  return (
    <div className="knowlery-screen">
      <Back navigate={props.navigate} label={t('home.recentActivity')} />
      <section className="knowlery-home__activity">
        {records.length === 0 ? (
          <p className="knowlery-screen__empty">{t('screens.noActivity')}</p>
        ) : (
          records.map((record, index) => (
            <div key={`${record.time}-${index}`} className="knowlery-home__act">
              <span className="knowlery-home__act-summary">{record.summary}</span>
              <span className="knowlery-home__act-meta">{record.time.slice(0, 10)}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function MoveDetailScreen(props: {
  payload: unknown;
  navigate: (s: DashboardScreen, payload?: unknown) => void;
}) {
  const plugin = usePlugin();
  const move = props.payload as DashboardMove | null | undefined;

  if (!move?.id) return null;

  const handleSend = async () => {
    await sendPromptToAgent(plugin.app, move.prompt);
  };

  const handleCopy = async () => {
    await copyPrompt(move.prompt);
  };

  return (
    <div className="knowlery-screen">
      <Back navigate={props.navigate} label={t('common.back')} ariaDestination={t('screens.home')} />
      <section className="knowlery-screen__detail">
        <h2 className="knowlery-screen__detail-title">{move.title}</h2>
        {move.skillTag && (
          <span className="knowlery-screen__skill-tag">{move.skillTag}</span>
        )}
        <p className="knowlery-screen__detail-desc">{move.description}</p>
        <pre className="knowlery-screen__prompt">{move.prompt}</pre>
        <div className="knowlery-screen__detail-actions">
          <button
            type="button"
            className="knowlery-btn knowlery-btn--primary"
            onClick={() => { void handleSend(); }}
          >
            <span>{t('common.sendToAgent')}</span>
          </button>
          <button
            type="button"
            className="knowlery-btn knowlery-btn--outline"
            onClick={() => { void handleCopy(); }}
          >
            <IconClipboard size={14} />
            <span>{t('common.copyPrompt')}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function KnowledgeHealthScreen(props: { navigate: (s: DashboardScreen, payload?: unknown) => void }) {
  const plugin = usePlugin();
  const snapshot = plugin.liveSnapshot?.snapshot() ?? null;
  const report: StalenessReport | null = snapshot ? computeStaleness(snapshot) : null;

  return (
    <div className="knowlery-screen">
      <Back navigate={props.navigate} label={t('home.knowledgeHealth')} />
      {!report ? (
        <p className="knowlery-screen__empty">{t('screens.snapshotWarming')}</p>
      ) : (
        <>
          <section className="knowlery-home__activity" aria-label={t('screens.stalePages', { count: report.stalePages.length })}>
            <div className="knowlery-section-label">{t('screens.stalePages', { count: report.stalePages.length })}</div>
            {report.stalePages.length === 0 ? (
              <p className="knowlery-screen__empty">{t('screens.noStalePages')}</p>
            ) : (
              <>
                {report.stalePages.map((finding) => (
                  <div key={finding.path} className="knowlery-home__act">
                    <span className="knowlery-home__act-summary">
                      {finding.path}
                      {finding.changedSources.map((source) => (
                        <span key={source.path} className="knowlery-home__act-meta"> ← {source.path}</span>
                      ))}
                    </span>
                  </div>
                ))}
                <button
                  type="button"
                  className="knowlery-btn knowlery-btn--outline"
                  onClick={() => { void copyPrompt(buildRecookPrompt(report)); }}
                >
                  <IconClipboard size={14} />
                  <span>{t('home.health.copyRecook')}</span>
                </button>
              </>
            )}
          </section>
          <section className="knowlery-home__activity" aria-label={t('screens.uncookedNotes', { count: report.uncookedNotes.length })}>
            <div className="knowlery-section-label">{t('screens.uncookedNotes', { count: report.uncookedNotes.length })}</div>
            {report.uncookedNotes.length === 0 ? (
              <p className="knowlery-screen__empty">{t('screens.allCited')}</p>
            ) : (
              report.uncookedNotes.map((note) => (
                <div key={note.path} className="knowlery-home__act">
                  <span className="knowlery-home__act-summary">{note.path}</span>
                  <span className="knowlery-home__act-meta">{new Date(note.mtimeMs).toISOString().slice(0, 10)}</span>
                </div>
              ))
            )}
          </section>
          {report.danglingSources.length > 0 && (
            <section className="knowlery-home__activity" aria-label={t('screens.danglingSources', { count: report.danglingSources.length })}>
              <div className="knowlery-section-label">{t('screens.danglingSources', { count: report.danglingSources.length })}</div>
              {report.danglingSources.map((dangling) => (
                <div key={`${dangling.page}-${dangling.source}`} className="knowlery-home__act">
                  <span className="knowlery-home__act-summary">{dangling.page}</span>
                  <span className="knowlery-home__act-meta">{t('screens.citesMissing', { path: dangling.source })}</span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export function DashboardScreens(props: {
  screen: DashboardScreen;
  payload: unknown;
  navigate: (screen: DashboardScreen, payload?: unknown) => void;
}) {
  if (props.screen === 'all-moves') {
    return <AllMovesScreen navigate={props.navigate} />;
  }
  if (props.screen === 'all-activity') {
    return <AllActivityScreen navigate={props.navigate} />;
  }
  if (props.screen === 'move-detail') {
    return <MoveDetailScreen payload={props.payload} navigate={props.navigate} />;
  }
  if (props.screen === 'knowledge-health') {
    return <KnowledgeHealthScreen navigate={props.navigate} />;
  }
  return null;
}
