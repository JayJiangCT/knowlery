import { App, Modal } from 'obsidian';
import { StrictMode } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext } from '../context';
import type { ReleaseNote } from '../assets/release-notes';
import { IconCheckCircle, IconX } from '../views/Icons';

interface ReleaseNotesModalOptions {
  note: ReleaseNote;
  onClose: () => void;
  onOpenDashboard: () => void;
}

export class ReleaseNotesModal extends Modal {
  private root: Root | null = null;

  constructor(
    app: App,
    private plugin: KnowleryPlugin,
    private options: ReleaseNotesModalOptions,
  ) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass('knowlery-release-modal');
    this.modalEl.addClass('mod-no-title');
    this.contentEl.addClass('knowlery-modal');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <ReleaseNotesContent
            note={this.options.note}
            onClose={() => this.close()}
            onOpenDashboard={() => {
              this.close();
              this.options.onOpenDashboard();
            }}
          />
        </PluginContext.Provider>
      </StrictMode>,
    );
  }

  onClose() {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
    this.options.onClose();
  }
}

function ReleaseNotesContent(props: {
  note: ReleaseNote;
  onClose: () => void;
  onOpenDashboard: () => void;
}) {
  const { note, onClose, onOpenDashboard } = props;

  return (
    <div className="knowlery-release">
      <header className="knowlery-release__header">
        <div>
          <div className="knowlery-modal-header__eyebrow">What&apos;s new</div>
          <h2 className="knowlery-release__title">Knowlery {note.version}</h2>
          <p className="knowlery-release__subtitle">{note.title} · {note.date}</p>
        </div>
        <button
          className="knowlery-modal-header__close"
          type="button"
          aria-label="Close release notes"
          onClick={onClose}
        >
          <IconX size={16} />
        </button>
      </header>

      <div className="knowlery-release__hero">
        <div className="knowlery-release__hero-icon">
          <IconCheckCircle size={22} />
        </div>
        <p>{note.summary}</p>
      </div>

      <section className="knowlery-release__section">
        <h3>Highlights</h3>
        <ul className="knowlery-release__list">
          {note.highlights.map((highlight) => (
            <li key={highlight.title}>
              <strong>{highlight.title}</strong>
              <span>{highlight.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="knowlery-release__footer">
        <button className="knowlery-btn knowlery-btn--ghost" type="button" onClick={onClose}>
          Got it
        </button>
        <button className="knowlery-btn knowlery-btn--primary" type="button" onClick={onOpenDashboard}>
          Open dashboard
        </button>
      </footer>
    </div>
  );
}
