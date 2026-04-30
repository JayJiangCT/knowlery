import { App, Modal, Platform as ObsidianPlatform, ProgressBarComponent } from 'obsidian';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin } from '../context';
import type {
  InstallDetectionResult,
  InstallExecutionState,
  InstallItemId,
  Manifest,
  OptionalInstallSelection,
  Platform,
} from '../types';
import { DEFAULT_OPTIONAL_INSTALL_SELECTION, KNOWLEDGE_DIRS } from '../types';
import { executeSetup, getSetupSteps, readManifest, type SetupStep } from '../core/setup-executor';
import { detectEnvironment, type EnvironmentDetectSnapshot } from '../core/environment-detect';
import { detectNode } from '../core/node-detect';
import { BUNDLED_SKILLS } from '../assets/skills';
import {
  IconCircle, IconCircleDot, IconChevronDown, IconChevronUp,
  IconAlertCircle, IconCheckCircle, IconCode, IconTerminal,
  IconWrench, IconFolder, IconSettings, IconArrowRight, IconRefresh,
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

const INSTALL_ITEM_ORDER: InstallItemId[] = ['platform-cli', 'claudian', 'skills-tooling'];
const INDETERMINATE_PROGRESS_TICK_MS = 120;
const INDETERMINATE_PROGRESS_STEP = 8;

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

function NativeProgressBar(props: {
  value?: number;
  indeterminate?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const componentRef = useRef<ProgressBarComponent | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.replaceChildren();
    const component = new ProgressBarComponent(host);
    componentRef.current = component;
    component.setValue(props.value ?? 0);

    return () => {
      componentRef.current = null;
      host.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const component = componentRef.current;
    if (!component || props.indeterminate) return;

    component.setValue(props.value ?? 0);
  }, [props.indeterminate, props.value]);

  useEffect(() => {
    if (!props.indeterminate) return;

    let progress = 0;
    const interval = window.setInterval(() => {
      progress = (progress + INDETERMINATE_PROGRESS_STEP) % 100;
      componentRef.current?.setValue(progress);
    }, INDETERMINATE_PROGRESS_TICK_MS);

    return () => window.clearInterval(interval);
  }, [props.indeterminate]);

  return <div className="knowlery-wizard__native-progress" ref={hostRef} />;
}

function selectionForItem(selection: OptionalInstallSelection, id: InstallItemId): boolean {
  switch (id) {
    case 'platform-cli':
      return selection.platformCli;
    case 'claudian':
      return selection.claudian;
    case 'skills-tooling':
      return selection.skillsTooling;
  }
}

function withInstallSelection(
  selection: OptionalInstallSelection,
  id: InstallItemId,
  checked: boolean,
): OptionalInstallSelection {
  switch (id) {
    case 'platform-cli':
      return { ...selection, platformCli: checked };
    case 'claudian':
      return { ...selection, claudian: checked };
    case 'skills-tooling':
      return { ...selection, skillsTooling: checked };
  }
}

function detectionIsSelectable(item: InstallDetectionResult): boolean {
  return item.status === 'not-installed' && installUnavailableDetail(item.id) === null;
}

function installUnavailableDetail(id: InstallItemId): string | null {
  if (!ObsidianPlatform.isMobile) {
    return null;
  }

  if (id === 'platform-cli' || id === 'claudian') {
    return 'Desktop only.';
  }

  return null;
}

function syncSelectionWithDetection(
  previous: OptionalInstallSelection,
  snapshot: EnvironmentDetectSnapshot,
  touched: Set<InstallItemId>,
): OptionalInstallSelection {
  let next = previous;
  for (const item of snapshot.items) {
    const selected = detectionIsSelectable(item)
      ? touched.has(item.id)
        ? selectionForItem(previous, item.id)
        : item.selectedByDefault ?? selectionForItem(previous, item.id)
      : false;
    next = withInstallSelection(next, item.id, selected);
  }
  return next;
}

function selectedInstallStates(
  selection: OptionalInstallSelection,
  detections: InstallDetectionResult[],
): InstallExecutionState[] {
  return INSTALL_ITEM_ORDER
    .filter((id) => selectionForItem(selection, id))
    .map((id) => ({
      id,
      status: 'queued',
      detail: `${detections.find((item) => item.id === id)?.label ?? id} queued.`,
    }));
}

function installLabel(id: InstallItemId, platform: Platform): string {
  switch (id) {
    case 'platform-cli':
      return platform === 'claude-code' ? 'Claude Code' : 'OpenCode';
    case 'claudian':
      return 'Claudian';
    case 'skills-tooling':
      return 'Skills tooling';
  }
}

function statusLabel(status: InstallDetectionResult['status'] | InstallExecutionState['status']): string {
  switch (status) {
    case 'checking':
      return 'Checking';
    case 'installed':
      return 'Installed';
    case 'not-installed':
      return 'Not installed';
    case 'missing-dependency':
      return 'Needs Node.js';
    case 'error':
      return 'Error';
    case 'not-selected':
      return 'Not selected';
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'verifying':
      return 'Verifying';
    case 'done':
      return 'Done';
    case 'failed':
      return 'Failed';
    case 'skipped':
      return 'Skipped';
  }
}

function resultTone(status: InstallExecutionState['status']): string {
  if (status === 'done') return ' is-success';
  if (status === 'failed') return ' is-error';
  if (status === 'skipped') return ' is-warning';
  return '';
}

function runIsActive(status: InstallExecutionState['status']): boolean {
  return status === 'queued' || status === 'running' || status === 'verifying';
}

function EnvironmentInstallsSection(props: {
  snapshot: EnvironmentDetectSnapshot | null;
  loading: boolean;
  error: string | null;
  platform: Platform;
  selection: OptionalInstallSelection;
  nodePath: string;
  nodeMessage: string | null;
  nodeDetecting: boolean;
  onSelectionChange: (id: InstallItemId, checked: boolean) => void;
  onNodePathChange: (value: string) => void;
  onNodePathCommit: () => void;
  onAutoDetectNode: () => void;
}) {
  const items: InstallDetectionResult[] = props.snapshot?.items ?? INSTALL_ITEM_ORDER.map((id) => ({
    id,
    label: installLabel(id, props.platform),
    description: 'Checking install status.',
    status: 'checking',
  }));
  const nodeMissing = !props.loading && props.snapshot !== null && !props.snapshot.nodeDetected;

  return (
    <PreviewSection
      title="Detected tools"
      icon={<IconTerminal size={16} />}
      defaultOpen
    >
      <div className="knowlery-wizard__install-list">
        {props.error && (
          <div className="knowlery-wizard__install-note is-error">
            {props.error}
          </div>
        )}

        {items.map((item) => {
          const selectable = !props.loading && detectionIsSelectable(item);
          const checked = selectionForItem(props.selection, item.id);
          const unavailableDetail = installUnavailableDetail(item.id);
          const detail = unavailableDetail ?? item.installedVersion ?? item.detail;
          return (
            <label
              key={item.id}
              className={`knowlery-wizard__install-row${selectable ? '' : ' is-readonly'}`}
            >
              {selectable ? (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => props.onSelectionChange(item.id, event.currentTarget.checked)}
                />
              ) : (
                <span
                  className={`knowlery-wizard__install-leading${item.status === 'installed' ? ' is-installed' : ''}`}
                  aria-hidden="true"
                >
                  {item.status === 'installed' && <IconCheckCircle size={16} />}
                </span>
              )}
              <span className="knowlery-wizard__install-main">
                <span className="knowlery-wizard__install-title">
                  <span>{item.label}</span>
                  {item.recommended && (
                    <span className="knowlery-wizard__install-pill">Recommended</span>
                  )}
                </span>
                <span className="knowlery-wizard__install-desc">{item.description}</span>
                {detail && (
                  <span className="knowlery-wizard__install-detail">
                    {detail}
                  </span>
                )}
              </span>
              <span className={`knowlery-wizard__install-status${unavailableDetail ? ' is-unavailable' : ` is-${item.status}`}`}>
                {props.loading ? 'Checking' : unavailableDetail ? 'Unavailable' : statusLabel(item.status)}
              </span>
            </label>
          );
        })}

        {props.snapshot?.nodeDetected && (
          <div className="knowlery-wizard__node-summary">
            Node.js {props.snapshot.nodeVersion ?? 'detected'} at <code>{props.snapshot.nodePath}</code>
          </div>
        )}

        {nodeMissing && (
          <div className="knowlery-wizard__node-recovery">
            <div>
              <div className="knowlery-wizard__node-title">Node.js was not found</div>
              <p>
                Skills tooling and some CLI installers need Node.js.{' '}
                <a href="https://nodejs.org/en/download" target="_blank" rel="noopener noreferrer">
                  Download Node.js
                </a>
                {' '}first, then enter an absolute path or run auto-detect after updating your shell path.
              </p>
            </div>
            <div className="knowlery-wizard__node-controls">
              <input
                type="text"
                value={props.nodePath}
                placeholder="/usr/local/bin/node"
                onChange={(event) => props.onNodePathChange(event.currentTarget.value)}
                onBlur={props.onNodePathCommit}
              />
              <button
                type="button"
                className="knowlery-btn knowlery-btn--outline"
                onClick={props.onAutoDetectNode}
                disabled={props.nodeDetecting}
              >
                <IconRefresh size={14} />
                {props.nodeDetecting ? 'Detecting...' : 'Auto-detect'}
              </button>
            </div>
            {props.nodeMessage && (
              <div className="knowlery-wizard__node-message">{props.nodeMessage}</div>
            )}
          </div>
        )}
      </div>
    </PreviewSection>
  );
}

function OptionalInstallRunList(props: {
  runs: InstallExecutionState[];
  platform: Platform;
  showLabel?: boolean;
}) {
  if (props.runs.length === 0) {
    return null;
  }

  return (
    <div className="knowlery-wizard__run-installs">
      {props.showLabel !== false && (
        <div className="knowlery-section-label">Optional installs</div>
      )}
      <ul className="knowlery-wizard__run-install-list">
        {props.runs.map((run) => (
          <li key={run.id} className={`knowlery-wizard__run-install-item${resultTone(run.status)}`}>
            <span className="knowlery-wizard__run-install-name">{installLabel(run.id, props.platform)}</span>
            <span className="knowlery-wizard__run-install-status">{statusLabel(run.status)}</span>
            {run.detail && <span className="knowlery-wizard__run-install-detail">{run.detail}</span>}
            {runIsActive(run.status) && (
              <NativeProgressBar indeterminate />
            )}
          </li>
        ))}
      </ul>
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
  const [environment, setEnvironment] = useState<EnvironmentDetectSnapshot | null>(null);
  const [environmentLoading, setEnvironmentLoading] = useState(false);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [optionalInstalls, setOptionalInstalls] = useState<OptionalInstallSelection>(
    DEFAULT_OPTIONAL_INSTALL_SELECTION,
  );
  const [installSelectionTouched, setInstallSelectionTouched] = useState<Set<InstallItemId>>(new Set());
  const [optionalInstallRuns, setOptionalInstallRuns] = useState<InstallExecutionState[]>([]);
  const [nodePath, setNodePath] = useState(plugin.settings.nodePath);
  const [nodeMessage, setNodeMessage] = useState<string | null>(null);
  const [nodeDetecting, setNodeDetecting] = useState(false);
  const [environmentRefreshKey, setEnvironmentRefreshKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const installSelectionTouchedRef = useRef(installSelectionTouched);

  useEffect(() => {
    installSelectionTouchedRef.current = installSelectionTouched;
  }, [installSelectionTouched]);

  useEffect(() => {
    readManifest(plugin.app).then((m) => {
      if (m) {
        setExistingManifest(m);
        setPlatform(m.platform);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading || phase !== 'preview') {
      return;
    }

    let cancelled = false;
    setEnvironmentLoading(true);
    setEnvironmentError(null);

    detectEnvironment({ app: plugin.app, platform, nodePath })
      .then((snapshot) => {
        if (cancelled) return;
        setEnvironment(snapshot);
        setOptionalInstalls((prev) => syncSelectionWithDetection(prev, snapshot, installSelectionTouchedRef.current));
      })
      .catch((e) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setEnvironmentError(`Could not check environment: ${message}`);
      })
      .finally(() => {
        if (!cancelled) {
          setEnvironmentLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [environmentRefreshKey, loading, phase, platform, plugin.app]);

  /* ---- setup handler ---- */
  const handleSetup = async () => {
    setError(null);
    setPhase('running');
    setCompletedSteps(new Set());
    setOptionalInstallRuns(selectedInstallStates(optionalInstalls, environment?.items ?? []));

    try {
      const result = await executeSetup(
        plugin.app,
        platform,
        plugin.settings.kbName,
        (step) => {
          setCompletedSteps((prev) => new Set(prev).add(step));
        },
        {
          optionalInstalls,
          nodePath,
          onOptionalInstallUpdate: (state) => {
            setOptionalInstallRuns((prev) => {
              const next = prev.filter((run) => run.id !== state.id);
              next.push(state);
              return INSTALL_ITEM_ORDER
                .map((id) => next.find((run) => run.id === id))
                .filter((run): run is InstallExecutionState => run !== undefined);
            });
          },
        },
      );

      plugin.settings.platform = platform;
      plugin.settings.nodePath = nodePath;
      await plugin.saveSettings();

      setOptionalInstallRuns(result.optionalInstallRuns);
      setPhase('done');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setPhase('preview');
    }
  };

  const handleInstallSelectionChange = (id: InstallItemId, checked: boolean) => {
    setInstallSelectionTouched((prev) => new Set(prev).add(id));
    setOptionalInstalls((prev) => withInstallSelection(prev, id, checked));
  };

  const handlePlatformChange = (nextPlatform: Platform) => {
    setPlatform(nextPlatform);
    setEnvironment(null);
    setInstallSelectionTouched((prev) => {
      const next = new Set(prev);
      next.delete('platform-cli');
      return next;
    });
  };

  const handleNodePathChange = (value: string) => {
    setNodePath(value);
    setNodeMessage(null);
    plugin.settings.nodePath = value;
    void plugin.saveSettings();
  };

  const handleNodePathCommit = () => {
    setEnvironmentRefreshKey((value) => value + 1);
  };

  const handleAutoDetectNode = async () => {
    setNodeDetecting(true);
    setNodeMessage(null);
    try {
      const result = await detectNode();
      if (result.detected && result.path) {
        setNodePath(result.path);
        plugin.settings.nodePath = result.path;
        await plugin.saveSettings();
        setNodeMessage(`Detected Node.js ${result.version ?? ''} at ${result.path}`.trim());
        setEnvironmentRefreshKey((value) => value + 1);
      } else {
        setNodeMessage('Node.js was not found. Install Node.js or enter its absolute path.');
      }
    } catch (error) {
      setNodeMessage(`Could not detect Node.js: ${formatWizardError(error)}`);
    } finally {
      setNodeDetecting(false);
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

          <PlatformGrid value={platform} onChange={handlePlatformChange} />

          <div>
            <div className="knowlery-section-label">Environment & installs</div>
            <div className="knowlery-wizard__preview-list">
              <EnvironmentInstallsSection
                snapshot={environment}
                loading={environmentLoading}
                error={environmentError}
                platform={platform}
                selection={optionalInstalls}
                nodePath={nodePath}
                nodeMessage={nodeMessage}
                nodeDetecting={nodeDetecting}
                onSelectionChange={handleInstallSelectionChange}
                onNodePathChange={handleNodePathChange}
                onNodePathCommit={handleNodePathCommit}
                onAutoDetectNode={handleAutoDetectNode}
              />
            </div>
          </div>

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
                  <li>
                    <code>INDEX.base</code>
                  </li>
                </ul>
              </PreviewSection>

              <PreviewSection
                title="Agent config"
                icon={<IconSettings size={16} />}
              >
                <p className="knowlery-wizard__config-summary">
                  {platform === 'claude-code'
                    ? <>Creates <code>.claude/CLAUDE.md</code> with @includes for KNOWLEDGE.md, SCHEMA.md, and INDEX.base, plus rules in <code>.claude/rules/</code></>
                    : <>Creates <code>opencode.json</code> with instructions referencing KNOWLEDGE.md, SCHEMA.md, and INDEX.base, plus rules in <code>.agents/rules/</code></>}
                </p>
              </PreviewSection>
            </div>
          </div>
        </div>

        <div className="knowlery-wizard__footer">
          <button type="button" className="knowlery-btn knowlery-btn--ghost" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="knowlery-btn knowlery-btn--primary"
            onClick={handleSetup}
            disabled={environmentLoading}
          >
            {environmentLoading ? 'Checking environment' : isReinstall ? 'Update vault' : 'Set up vault'}
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
    const setupProgress = (completedSteps.size / totalSteps) * 100;
    return (
      <div className="knowlery-wizard__phase">
        <PhaseSteps current="running" />

        <div className="knowlery-wizard__body">
          <div>
            <NativeProgressBar value={setupProgress} />
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

          <OptionalInstallRunList runs={optionalInstallRuns} platform={platform} />
        </div>

        <div className="knowlery-wizard__footer">
          <span className="knowlery-wizard__footer-hint">Setting up your vault...</span>
        </div>
      </div>
    );
  }

  /* ---- phase: done ---- */
  const optionalInstallIssues = optionalInstallRuns.some((run) => (
    run.status === 'failed' || run.status === 'skipped'
  ));
  const platformCliDetection = environment?.items.find((item) => item.id === 'platform-cli');
  const platformCliRun = optionalInstallRuns.find((run) => run.id === 'platform-cli');
  const claudianRun = optionalInstallRuns.find((run) => run.id === 'claudian');
  const needsPlatformCliStep = platformCliDetection?.status === 'not-installed'
    && platformCliRun?.status !== 'done';

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

          <div className="knowlery-wizard__install-summary">
            <div className="knowlery-section-label">Optional install outcomes</div>
            {optionalInstallRuns.length > 0 ? (
              <OptionalInstallRunList runs={optionalInstallRuns} platform={platform} showLabel={false} />
            ) : (
              <p>No optional installs were selected.</p>
            )}
          </div>

          <div className="knowlery-wizard__next-steps">
            <div className="knowlery-section-label">What to do next</div>
            <ol>
              {optionalInstallIssues && (
                <li>Review optional install messages above and retry anything that was skipped or failed</li>
              )}
              {needsPlatformCliStep && (
                <li>Install {platform === 'claude-code' ? 'Claude Code' : 'OpenCode'} before running agent workflows</li>
              )}
              {claudianRun?.status === 'done' && (
                <li>Reload Obsidian if Claudian does not appear in Community plugins</li>
              )}
              <li>Open <strong>KNOWLEDGE.md</strong> in the Config tab and describe your knowledge base</li>
              <li>Try the <strong>cook</strong> skill with {platform === 'claude-code' ? 'Claude Code' : 'OpenCode'}</li>
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

function formatWizardError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
