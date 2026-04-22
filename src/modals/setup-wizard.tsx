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
  IconCircle, IconCircleDot, IconChevronDown, IconChevronUp,
  IconAlertCircle, IconCheckCircle, IconCode, IconTerminal,
  IconWrench, IconFolder, IconSettings, IconArrowRight,
  SkillIcon,
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
    this.modalEl.addClass('knowlery-wizard-modal');
    this.contentEl.addClass('knowlery-modal');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <SetupWizardContent
            onComplete={() => {
              this.close();
              this.onComplete();
            }}
            onCancel={() => this.close()}
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
          <div key={p.key} className="knowlery-wizard__phase-wrapper">
            {i > 0 && <div className="knowlery-wizard__phase-separator" />}
            <div className={`knowlery-wizard__phase-step${modifier}`}>
              <span className="knowlery-wizard__phase-dot">
                {isDone ? <IconCheckCircle size={14} /> : isActive ? <IconCircleDot size={14} /> : <IconCircle size={14} />}
              </span>
              <span>{p.label}</span>
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
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <div className={`knowlery-wizard__preview-section${open ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="knowlery-wizard__preview-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {props.icon && (
          <span className="knowlery-wizard__preview-header-icon">{props.icon}</span>
        )}
        <span>{props.title}</span>
        <span className="knowlery-wizard__preview-chevron">
          {open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </span>
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
      <div className="knowlery-section-label">Select agent engine</div>
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
                <span className="knowlery-wizard__platform-check">
                  <IconCheckCircle size={14} />
                </span>
              )}
              <span className="knowlery-wizard__platform-icon">
                <opt.Icon size={20} />
              </span>
              <span className="knowlery-wizard__platform-name">{opt.label}</span>
              <span className="knowlery-wizard__platform-desc">{opt.description}</span>
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

function SetupWizardContent(props: { onComplete: () => void; onCancel: () => void }) {
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
    return (
      <div className="knowlery-wizard__phase">
        <PhaseSteps current="preview" />

        <div className="knowlery-wizard__body">
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

          <div>
            <div className="knowlery-section-label">Execution preview</div>
            <div className="knowlery-wizard__preview-list">
              <PreviewSection
                title={`Skills to install (${BUNDLED_SKILLS.length})`}
                icon={<IconWrench size={16} />}
                defaultOpen
              >
                <div className="knowlery-wizard__skill-grid">
                  {BUNDLED_SKILLS.slice(0, 6).map((s) => (
                    <div key={s.name} className="knowlery-wizard__skill-item">
                      <span className="knowlery-wizard__skill-icon"><SkillIcon name={s.name} size={14} /></span>
                      <span>{s.name}</span>
                    </div>
                  ))}
                  {BUNDLED_SKILLS.length > 6 && (
                    <div className="knowlery-wizard__skill-more">
                      ... and {BUNDLED_SKILLS.length - 6} more
                    </div>
                  )}
                </div>
              </PreviewSection>

              <PreviewSection
                title="Directories to create"
                icon={<IconFolder size={16} />}
              >
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

              <PreviewSection
                title="Agent config"
                icon={<IconSettings size={16} />}
              >
                <p className="knowlery-wizard__config-summary">
                  {platform === 'claude-code'
                    ? <>Creates <code>.claude/CLAUDE.md</code> with @includes for KNOWLEDGE.md and SCHEMA.md, plus rules in <code>.claude/rules/</code></>
                    : <>Creates <code>opencode.json</code> with instructions referencing KNOWLEDGE.md and SCHEMA.md, plus rules in <code>.agents/rules/</code></>}
                </p>
              </PreviewSection>
            </div>
          </div>
        </div>

        <div className="knowlery-wizard__footer">
          <button type="button" className="knowlery-btn knowlery-btn--ghost" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="button" className="knowlery-btn knowlery-btn--primary" onClick={handleSetup}>
            {isReinstall ? 'Update vault' : 'Set up vault'}
            <IconArrowRight size={14} />
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

        <div className="knowlery-wizard__body">
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

          <ul className="knowlery-wizard__step-list">
            {steps.map((s) => {
              const done = completedSteps.has(s.step);
              return (
                <li key={s.step} className={`knowlery-wizard__step-item${done ? ' is-done' : ''}`}>
                  <span className="knowlery-wizard__step-icon">
                    {done ? <IconCheckCircle size={16} /> : <IconCircle size={16} />}
                  </span>
                  {s.label}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="knowlery-wizard__footer">
          <span className="knowlery-wizard__footer-hint">Setting up your vault...</span>
        </div>
      </div>
    );
  }

  /* ---- phase: done ---- */
  return (
    <div className="knowlery-wizard__phase">
      <PhaseSteps current="done" />

      <div className="knowlery-wizard__body">
        <div className="knowlery-wizard__done-content">
          <div className="knowlery-wizard__done-icon">
            <IconCheckCircle size={48} />
          </div>
          <p className="knowlery-wizard__done-title">
            {isReinstall ? 'Vault updated!' : 'Your vault is ready!'}
          </p>
          <p className="knowlery-wizard__done-desc">
            Knowlery has {isReinstall ? 'updated' : 'installed'} {BUNDLED_SKILLS.length} skills
            and configured your vault for {platform === 'claude-code' ? 'Claude Code' : 'OpenCode'}.
          </p>

          <div className="knowlery-wizard__next-steps">
            <div className="knowlery-section-label">What to do next</div>
            <ol>
              <li>Open <strong>KNOWLEDGE.md</strong> in the Config tab and describe your knowledge base</li>
              <li>Try the <strong>cook</strong> skill — ask Claude Code to cook a new note</li>
              <li>Browse installed skills in the <strong>Skills tab</strong></li>
            </ol>
          </div>
        </div>
      </div>

      <div className="knowlery-wizard__footer">
        <button type="button" className="knowlery-btn knowlery-btn--primary" onClick={props.onComplete}>
          Open dashboard
          <IconArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
