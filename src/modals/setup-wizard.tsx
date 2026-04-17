import { App, Modal } from 'obsidian';
import { StrictMode, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin } from '../context';
import type { Platform } from '../types';
import { KNOWLEDGE_DIRS } from '../types';
import { executeSetup, getSetupSteps, type SetupStep } from '../core/setup-executor';
import { BUNDLED_SKILLS } from '../assets/skills';

/* ------------------------------------------------------------------ */
/*  Modal wrapper                                                      */
/* ------------------------------------------------------------------ */

export class SetupWizardModal extends Modal {
  root: Root | null = null;

  constructor(
    app: App,
    private plugin: KnowleryPlugin,
    private onComplete: () => void,
  ) {
    super(app);
  }

  onOpen() {
    this.setTitle('Set up Knowlery');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <SetupWizardContent
            onComplete={() => {
              this.close();
              this.onComplete();
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type WizardPhase = 'choose-platform' | 'preview' | 'running' | 'done';

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PlatformOption(props: {
  value: Platform;
  label: string;
  description: string;
  selected: boolean;
  onSelect: (p: Platform) => void;
}) {
  return (
    <div
      className={`knowlery-wizard__platform-option ${props.selected ? 'is-selected' : ''}`}
      onClick={() => props.onSelect(props.value)}
      role="radio"
      aria-checked={props.selected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') props.onSelect(props.value);
      }}
    >
      <span className="knowlery-wizard__radio">
        {props.selected ? '\u25C9' : '\u25CB'}
      </span>
      <div className="knowlery-wizard__platform-label">
        <strong>{props.label}</strong>
        <span className="knowlery-wizard__platform-desc">{props.description}</span>
      </div>
    </div>
  );
}

function PreviewSection(props: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <div className="knowlery-wizard__preview-section">
      <div
        className="knowlery-wizard__preview-header"
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen(!open);
        }}
      >
        <span className="knowlery-wizard__chevron">{open ? '\u25BC' : '\u25B6'}</span>
        <span>{props.title}</span>
      </div>
      {open && <div className="knowlery-wizard__preview-body">{props.children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main wizard content                                                */
/* ------------------------------------------------------------------ */

function SetupWizardContent(props: { onComplete: () => void }) {
  const plugin = usePlugin();

  const [phase, setPhase] = useState<WizardPhase>('choose-platform');
  const [platform, setPlatform] = useState<Platform>('claude-code');
  const [completedSteps, setCompletedSteps] = useState<Set<SetupStep>>(new Set());
  const [error, setError] = useState<string | null>(null);

  /* ---- setup handler ---- */
  const handleSetup = async () => {
    setError(null);
    setPhase('running');
    setCompletedSteps(new Set());

    try {
      await executeSetup(plugin.app, platform, plugin.settings.kbName, (step) => {
        setCompletedSteps((prev) => new Set(prev).add(step));
      });

      plugin.settings.platform = platform;
      await plugin.saveSettings();

      setPhase('done');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setPhase('preview');
    }
  };

  /* ---- phase: choose-platform ---- */
  if (phase === 'choose-platform') {
    return (
      <div className="knowlery-wizard__phase">
        <p className="knowlery-wizard__intro">
          Choose which AI coding agent you use. This determines how Knowlery
          writes its configuration files.
        </p>

        <div className="knowlery-wizard__platform-list">
          <PlatformOption
            value="claude-code"
            label="Claude Code"
            description="Anthropic's CLI agent (CLAUDE.md + .claude/commands)"
            selected={platform === 'claude-code'}
            onSelect={setPlatform}
          />
          <PlatformOption
            value="opencode"
            label="OpenCode"
            description="Open-source alternative (AGENTS.md + .opencode/commands)"
            selected={platform === 'opencode'}
            onSelect={setPlatform}
          />
        </div>

        <div className="knowlery-wizard__actions">
          <button className="mod-cta" onClick={() => setPhase('preview')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  /* ---- phase: preview ---- */
  if (phase === 'preview') {
    const companionName =
      platform === 'claude-code' ? 'Claudian' : 'obsidian-agent-client';

    return (
      <div className="knowlery-wizard__phase">
        <p className="knowlery-wizard__intro">
          Review what Knowlery will create in your vault.
        </p>

        {error && (
          <div className="knowlery-wizard__error">
            <span className="knowlery-wizard__error-icon">{'\u2715'}</span>
            {error}
          </div>
        )}

        <PreviewSection title={`Skills (${BUNDLED_SKILLS.length})`} defaultOpen>
          <ul className="knowlery-wizard__skill-list">
            {BUNDLED_SKILLS.map((s) => (
              <li key={s.name}>
                <span>{s.emoji}</span> <strong>{s.name}</strong> &mdash;{' '}
                {s.description}
              </li>
            ))}
          </ul>
        </PreviewSection>

        <PreviewSection title="Vault structure">
          <ul className="knowlery-wizard__dir-list">
            {KNOWLEDGE_DIRS.map((d) => (
              <li key={d}>
                <code>{d}/</code>
              </li>
            ))}
            <li>
              <code>KNOWLEDGE.md</code>
            </li>
            <li>
              <code>SCHEMA.md</code>
            </li>
          </ul>
        </PreviewSection>

        <PreviewSection title="Agent configuration">
          <p>
            {platform === 'claude-code'
              ? 'Creates CLAUDE.md with knowledge-base instructions and skill commands in .claude/commands/'
              : 'Creates AGENTS.md with knowledge-base instructions and skill commands in .opencode/commands/'}
          </p>
        </PreviewSection>

        <PreviewSection title="Recommended companion">
          <p>
            For the best experience with {platform === 'claude-code' ? 'Claude Code' : 'OpenCode'},
            install the <strong>{companionName}</strong> Obsidian plugin.
          </p>
        </PreviewSection>

        <div className="knowlery-wizard__actions">
          <button onClick={() => setPhase('choose-platform')}>Back</button>
          <button className="mod-cta" onClick={handleSetup}>
            Set up vault
          </button>
        </div>
      </div>
    );
  }

  /* ---- phase: running ---- */
  if (phase === 'running') {
    const steps = getSetupSteps();
    return (
      <div className="knowlery-wizard__phase">
        <p className="knowlery-wizard__intro">Setting up your vault...</p>
        <ul className="knowlery-wizard__progress-list">
          {steps.map((s) => {
            const done = completedSteps.has(s.step);
            return (
              <li key={s.step} className={done ? 'is-done' : ''}>
                <span className="knowlery-wizard__step-icon">
                  {done ? '\u2713' : '\u25CB'}
                </span>
                {s.label}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  /* ---- phase: done ---- */
  return (
    <div className="knowlery-wizard__phase knowlery-wizard__done">
      <p className="knowlery-wizard__success">Your vault is ready!</p>
      <p>
        Knowlery has installed {BUNDLED_SKILLS.length} skills and configured your
        vault for {platform === 'claude-code' ? 'Claude Code' : 'OpenCode'}.
      </p>
      <div className="knowlery-wizard__actions">
        <button className="mod-cta" onClick={props.onComplete}>
          Open dashboard
        </button>
      </div>
    </div>
  );
}
