import { useEffect, useState } from 'react';
import { usePlugin } from '../context';
import type { ActivityRecord, DashboardMove, DashboardScreen } from '../types';
import { RECIPE_BOOK } from '../core/moves';
import { readRecentActivityRecords } from '../core/activity-ledger';
import { sendPromptToAgent, copyPrompt } from './request-actions';
import { IconChevronLeft, IconChevronRight, IconClipboard } from './Icons';

function Back(props: { navigate: (s: DashboardScreen, payload?: unknown) => void; label: string; ariaDestination?: string }) {
  return (
    <button
      type="button"
      className="knowlery-screen__back"
      onClick={() => props.navigate('home')}
      aria-label={`Back to ${props.ariaDestination ?? props.label}`}
    >
      <IconChevronLeft size={16} />
      {props.label}
    </button>
  );
}

function AllMovesScreen(props: { navigate: (s: DashboardScreen, payload?: unknown) => void }) {
  return (
    <div className="knowlery-screen">
      <Back navigate={props.navigate} label="Suggested moves" />
      <section className="knowlery-home__moves">
        {RECIPE_BOOK.map((move) => (
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
    readRecentActivityRecords(plugin.app, 50).then(({ records: loaded }) => {
      setRecords(loaded);
    });
  }, [plugin]);

  return (
    <div className="knowlery-screen">
      <Back navigate={props.navigate} label="Recent activity" />
      <section className="knowlery-home__activity">
        {records.length === 0 ? (
          <p className="knowlery-screen__empty">No activity recorded yet.</p>
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
      <Back navigate={props.navigate} label="Back" ariaDestination="home" />
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
            <span>Send to agent</span>
          </button>
          <button
            type="button"
            className="knowlery-btn knowlery-btn--outline"
            onClick={() => { void handleCopy(); }}
          >
            <IconClipboard size={14} />
            <span>Copy prompt</span>
          </button>
        </div>
      </section>
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
  return null;
}
