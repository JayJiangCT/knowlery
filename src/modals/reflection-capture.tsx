import { App, Modal, Notice } from 'obsidian';
import { StrictMode, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import KnowleryPlugin from '../main';
import { PluginContext } from '../context';
import type { ActivityDimension, ActivityRecord } from '../types';
import { appendActivityRecord } from '../core/activity-ledger';

const DIMENSIONS: ActivityDimension[] = [
  'research',
  'creation',
  'building',
  'strategy',
  'reflection',
  'maintenance',
];

export class ReflectionCaptureModal extends Modal {
  private root: Root | null = null;

  constructor(
    app: App,
    private plugin: KnowleryPlugin,
    private onSaved?: () => void,
  ) {
    super(app);
  }

  onOpen() {
    this.contentEl.addClass('knowlery-modal');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <ReflectionCaptureForm
            onCancel={() => this.close()}
            onSave={async (record) => {
              await appendActivityRecord(this.app, record);
              new Notice('Reflection added to Knowlery activity.');
              this.onSaved?.();
              this.close();
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
  }
}

function ReflectionCaptureForm(props: {
  onCancel: () => void;
  onSave: (record: ActivityRecord) => Promise<void>;
}) {
  const [summary, setSummary] = useState('');
  const [topics, setTopics] = useState('');
  const [questions, setQuestions] = useState('');
  const [learned, setLearned] = useState('');
  const [thinking, setThinking] = useState('');
  const [dimensions, setDimensions] = useState<ActivityDimension[]>(['reflection']);
  const [saving, setSaving] = useState(false);

  const toggleDimension = (dimension: ActivityDimension) => {
    setDimensions((current) => current.includes(dimension)
      ? current.filter((item) => item !== dimension)
      : [...current, dimension]);
  };

  const save = async () => {
    if (!summary.trim()) return;
    setSaving(true);
    await props.onSave({
      time: new Date().toISOString(),
      agent: 'manual',
      type: 'reflection',
      topics: splitLinesOrCommas(topics),
      summary: summary.trim(),
      dimensions,
      questions: splitLines(questions),
      learned: splitLines(learned),
      thinking: splitLines(thinking),
      followups: [],
      relatedFiles: [],
      captureState: 'unbaked',
      source: { kind: 'manual-reflection', visibility: 'private-summary', surface: 'knowledge' },
    });
    setSaving(false);
  };

  return (
    <div className="knowlery-reflection">
      <h2>Add reflection</h2>
      <label>
        <span>Summary</span>
        <textarea value={summary} onChange={(event) => setSummary(event.currentTarget.value)} />
      </label>
      <label>
        <span>Topics</span>
        <input value={topics} onChange={(event) => setTopics(event.currentTarget.value)} placeholder="Knowlery, Product Strategy" />
      </label>
      <label>
        <span>Questions</span>
        <textarea value={questions} onChange={(event) => setQuestions(event.currentTarget.value)} />
      </label>
      <label>
        <span>Learned</span>
        <textarea value={learned} onChange={(event) => setLearned(event.currentTarget.value)} />
      </label>
      <label>
        <span>Thinking</span>
        <textarea value={thinking} onChange={(event) => setThinking(event.currentTarget.value)} />
      </label>
      <div className="knowlery-reflection__dimensions">
        {DIMENSIONS.map((dimension) => (
          <label key={dimension}>
            <input
              type="checkbox"
              checked={dimensions.includes(dimension)}
              onChange={() => toggleDimension(dimension)}
            />
            <span>{dimension}</span>
          </label>
        ))}
      </div>
      <div className="knowlery-modal__actions">
        <button onClick={props.onCancel}>Cancel</button>
        <button className="mod-cta" disabled={!summary.trim() || saving} onClick={save}>
          {saving ? 'Saving...' : 'Save reflection'}
        </button>
      </div>
    </div>
  );
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function splitLinesOrCommas(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}
