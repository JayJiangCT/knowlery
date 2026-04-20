import { App, Modal } from 'obsidian';
import { StrictMode, useEffect, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin } from '../context';
import type { Manifest, Platform } from '../types';
import { KNOWLEDGE_DIRS } from '../types';
import { executeSetup, getSetupSteps, readManifest, type SetupStep } from '../core/setup-executor';
import { BUNDLED_SKILLS } from '../assets/skills';
import {
  IconCircle, IconCircleDot, IconChevronRight, IconChevronDown,
  IconAlertCircle, IconCheckCircle, IconCode, IconTerminal,
} from '../views/Icons';

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

type WizardPhase = 'preview' | 'running' | 'done';

/* ------------------------------------------------------------------ */
/*  Phase step indicator                                               */
/* ------------------------------------------------------------------ */

const PHASES: { key: WizardPhase; label: string }[] = [
  { key: 'preview', label: 'Preview' },
  { key: 'running', label: 'Running' },
  { key: 'done', label: 'Done' },
];

function PhaseSteps(props: { current: WizardPhase }) {
  const currentIndex = PHASES.findIndex((p) => p.key === props.current);
  return (
    <div className="knowlery-wizard__phase-steps">
      {PHASES.map((p, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        let modifier = '';
        if (isDone) modifier = ' is-done';
        else if (isActive) modifier = ' is-active';
        return (
          <div key={p.key} className="knowlery-wizard__phase-step-wrapper">
            {i > 0 && <div className="knowlery-wizard__phase-step-separator" />}
            <div className={`knowlery-wizard__phase-step${modifier}`}>
              <span className="knowlery-wizard__phase-step-dot">
                {isDone ? <IconCheckCircle size={14} /> : isActive ? <IconCircleDot size={14} /> : <IconCircle size={14} />}
              </span>
              <span className="knowlery-wizard__phase-step-label">{p.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PreviewSection(props: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <div className="knowlery-wizard__preview-section">
      <button
        type="button"
        className="knowlery-wizard__preview-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="knowlery-icon-chevron">
          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </span>
        <span>{props.title}</span>
      </button>
      {open && <div className="knowlery-wizard__preview-body">{props.children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Platform selection card                                            */
/* ------------------------------------------------------------------ */

interface PlatformOption {
  value: Platform;
  label: string;
  description: string;
  Icon: React.ComponentType<{ size?: number }>;
}

const PLATFORM_OPTIONS: PlatformOption[] = [
  {
    value: 'claude-code',
    label: 'Claude Code',
    description: "Anthropic's hosted AI coding CLI",
    Icon: IconCode,
  },
  {
    value: 'opencode',
    label: 'OpenCode',
    description: 'Open-source, self-hostable alternative',
    Icon: IconTerminal,
  },
];

function PlatformGrid(props: {
  value: Platform;
  onChange: (p: Platform) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = PLATFORM_OPTIONS.findIndex((o) => o.value === props.value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      props.onChange(PLATFORM_OPTIONS[(idx + 1) % PLATFORM_OPTIONS.length].value);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      props.onChange(PLATFORM_OPTIONS[(idx - 1 + PLATFORM_OPTIONS.length) % PLATFORM_OPTIONS.length].value);
    }
  };

  return (
    <div>
      <div className="knowlery-section-label">Agent Engine</div>
      <div
        className="knowlery-wizard__platform-grid"
        role="radiogroup"
        aria-label="Agent Engine"
        onKeyDown={handleKeyDown}
      >
        {PLATFORM_OPTIONS.map((opt) => {
          const selected = props.value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`knowlery-wizard__platform-card${selected ? ' is-selected' : ''}`}
              onClick={() => props.onChange(opt.value)}
              tabIndex={selected ? 0 : -1}
            >
              {selected && (
                <span className="knowlery-wizard__platform-card__check">
                  <IconCheckCircle size={14} />
                </span>
              )}
              <span className="knowlery-wizard__platform-card__icon">
                <opt.Icon size={20} />
              </span>
              <span className="knowlery-wizard__platform-card__name">{opt.label}</span>
              <span className="knowlery-wizard__platform-card__desc">{opt.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main wizard content                                                */
/* ------------------------------------------------------------------ */

function SetupWizardContent(props: { onComplete: () => void }) {
  const plugin = usePlugin();

  const [existingManifest, setExistingManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<WizardPhase>('preview');
  const [platform, setPlatform] = useState<Platform>('claude-code');
  const [completedSteps, setCompletedSteps] = useState<Set<SetupStep>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readManifest(plugin.app).then((m) => {
      if (m) {
        setExistingManifest(m);
        setPlatform(m.platform);
      }
      setLoading(false);
    });
  }, []);

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

  const isReinstall = existingManifest !== null;

  /* ---- loading ---- */
  if (loading) {
    return (
      <div className="knowlery-wizard__phase">
        <p className="knowlery-wizard__intro">Checking vault state…</p>
      </div>
    );
  }

  /* ---- phase: preview ---- */
  if (phase === 'preview') {
    const companionName =
      platform === 'claude-code' ? 'Claudian' : 'obsidian-agent-client';

    return (
      <div className="knowlery-wizard__phase">
        <PhaseSteps current="preview" />

        <p className="knowlery-wizard__intro">
          {isReinstall
            ? 'Review what Knowlery will update in your vault. Existing files will be overwritten.'
            : 'Review what Knowlery will create in your vault.'}
        </p>

        {error && (
          <div className="knowlery-wizard__error">
            <span className="knowlery-wizard__error-icon">
              <IconAlertCircle size={16} />
            </span>
            <span>{error}</span>
          </div>
        )}

        <PlatformGrid value={platform} onChange={setPlatform} />

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
              ? 'Creates .claude/CLAUDE.md with @includes for KNOWLEDGE.md and SCHEMA.md, plus rules in .claude/rules/'
              : 'Creates opencode.json with instructions referencing KNOWLEDGE.md and SCHEMA.md, plus rules in .agents/rules/'}
          </p>
        </PreviewSection>

        <PreviewSection title="Recommended companion">
          <p>
            For the best experience with {platform === 'claude-code' ? 'Claude Code' : 'OpenCode'},
            install the <strong>{companionName}</strong> Obsidian plugin.
          </p>
        </PreviewSection>

        <div className="knowlery-wizard__actions">
          <button type="button" className="mod-cta" onClick={handleSetup}>
            {isReinstall ? 'Update vault' : 'Set up vault'}
          </button>
        </div>
      </div>
    );
  }

  /* ---- phase: running ---- */
  if (phase === 'running') {
    const steps = getSetupSteps();
    const totalSteps = steps.length;
    return (
      <div className="knowlery-wizard__phase">
        <PhaseSteps current="running" />

        <div>
          <div
            className="knowlery-wizard__progress-track"
            style={{ '--knowlery-progress': `${(completedSteps.size / totalSteps) * 100}%` } as React.CSSProperties}
          >
            <div className="knowlery-wizard__progress-fill" />
          </div>
          <span className="knowlery-wizard__progress-label">
            Step {completedSteps.size} of {totalSteps}
          </span>
        </div>

        <ul className="knowlery-wizard__progress-list">
          {steps.map((s) => {
            const done = completedSteps.has(s.step);
            return (
              <li key={s.step} className={done ? 'is-done' : ''}>
                <span className="knowlery-wizard__step-icon">
                  {done ? <IconCheckCircle size={16} /> : <IconCircle size={16} />}
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
      <PhaseSteps current="done" />

      <div className="knowlery-wizard__success-icon">
        <IconCheckCircle size={40} />
      </div>
      <p className="knowlery-wizard__success">
        {isReinstall ? 'Vault updated!' : 'Your vault is ready!'}
      </p>
      <p>
        Knowlery has {isReinstall ? 'updated' : 'installed'} {BUNDLED_SKILLS.length} skills
        and configured your vault for {platform === 'claude-code' ? 'Claude Code' : 'OpenCode'}.
      </p>

      <div className="knowlery-wizard__next-steps knowlery-card">
        <div className="knowlery-section-label">What to do next</div>
        <ol className="knowlery-wizard__next-steps-list">
          <li>Open <strong>KNOWLEDGE.md</strong> in the Config tab and describe your knowledge base</li>
          <li>Try the <strong>cook</strong> skill — ask Claude Code to cook a new note</li>
          <li>Browse installed skills in the <strong>Skills tab</strong></li>
        </ol>
      </div>

      <div className="knowlery-wizard__actions">
        <button type="button" className="mod-cta" onClick={props.onComplete}>
          Open dashboard
        </button>
      </div>
    </div>
  );
}
