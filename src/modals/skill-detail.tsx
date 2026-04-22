import { App, Modal, MarkdownRenderer, normalizePath, Notice, Component } from 'obsidian';
import { StrictMode, useState, useEffect, useRef } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin, useSettings } from '../context';
import type { SkillInfo } from '../types';
import { copySkillCommand, runSkillViaCli } from '../core/skill-executor';
import { disableSkill, enableSkill, deleteSkill } from '../core/skill-manager';
import { detectAgentCli } from '../core/cli-detect';
import type { CliDetection } from '../core/cli-detect';
import { SkillEditorModal } from './skill-editor';
import {
  IconX,
  IconCheckCircle,
  IconInfo,
  IconList,
  IconCode,
  IconPlay,
  IconClipboard,
  IconBookOpen,
  SkillIcon,
} from '../views/Icons';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COMPANION_URLS: Record<string, string> = {
  'claude-code': 'https://github.com/YishenTu/claudian',
  'opencode': 'https://github.com/RAIT-09/obsidian-agent-client',
};

/* ------------------------------------------------------------------ */
/*  Modal wrapper                                                      */
/* ------------------------------------------------------------------ */

export class SkillDetailModal extends Modal {
  private root: Root | null = null;

  constructor(
    app: App,
    private plugin: KnowleryPlugin,
    private skill: SkillInfo,
    private scrollToExample = false,
    private onChange?: () => void,
  ) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass('mod-no-title');
    this.contentEl.addClass('knowlery-modal');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <SkillDetailContent
            skill={this.skill}
            scrollToExample={this.scrollToExample}
            onClose={() => this.close()}
            onChange={this.onChange}
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
/*  Content component                                                  */
/* ------------------------------------------------------------------ */

function SkillDetailContent(props: {
  skill: SkillInfo;
  scrollToExample: boolean;
  onClose: () => void;
  onChange?: () => void;
}) {
  const { skill, scrollToExample, onClose, onChange } = props;
  const plugin = usePlugin();
  const [settings] = useSettings();

  const [copied, setCopied] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [cliDetection, setCliDetection] = useState<CliDetection | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const whatItDoesRef = useRef<HTMLDivElement>(null);
  const exampleRef = useRef<HTMLDivElement>(null);

  const bestFor = skill.detail?.bestFor;
  const proTip = skill.detail?.proTip;
  const hasTipPair = (bestFor && bestFor.length > 0) || proTip;
  const parameters = skill.detail?.parameters;
  const whatItDoes = skill.detail?.whatItDoes || skill.description;
  const skillCategoryLabel = skill.source === 'custom'
    ? 'Custom'
    : skill.source === 'registry'
      ? 'Installed'
    : skill.kind === 'knowledge'
      ? 'Knowledge'
      : 'Tooling';

  useEffect(() => {
    detectAgentCli()
      .then(setCliDetection)
      .catch(() => setCliDetection({ claudeCode: { installed: false }, opencode: { installed: false } }));
  }, []);

  useEffect(() => {
    const el = whatItDoesRef.current;
    if (!el || !whatItDoes) return;
    el.replaceChildren();
    const component = new Component();
    component.load();
    void MarkdownRenderer.render(plugin.app, whatItDoes, el, '', component);
    return () => component.unload();
  }, [whatItDoes, plugin.app]);

  useEffect(() => {
    if (!scrollToExample || !exampleRef.current) return;
    const el = exampleRef.current;
    requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }, [scrollToExample]);

  const companionName =
    settings.platform === 'claude-code' ? 'Claudian' : 'obsidian-agent-client';
  const companionUrl = COMPANION_URLS[settings.platform];

  const canRun =
    cliDetection !== null &&
    (settings.platform === 'claude-code'
      ? cliDetection.claudeCode.installed
      : cliDetection.opencode.installed);

  const handleCopy = async () => {
    try {
      await copySkillCommand(skill);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      new Notice('Failed to copy to clipboard.');
    }
  };

  const handleViewSource = async () => {
    const path = normalizePath(`.agents/skills/${skill.name}/SKILL.md`);
    const adapter = plugin.app.vault.adapter;
    if (!(await adapter.exists(path))) {
      new Notice(`SKILL.md not found for "${skill.name}"`);
      return;
    }
    const fullPath = (adapter as any).getFullPath(path) as string;
    // electron is external in esbuild config
    const { shell } = (window as any).require('electron');
    shell.openPath(fullPath);
  };

  const handleRun = () => {
    const cli = settings.platform === 'claude-code' ? 'claude' : 'opencode';
    void runSkillViaCli(skill, cli);
  };

  const handleDisable = async () => {
    await disableSkill(plugin.app, skill.name);
    new Notice(`Disabled skill "${skill.name}"`);
    onChange?.();
    onClose();
  };

  const handleEnable = async () => {
    await enableSkill(plugin.app, skill.name);
    new Notice(`Enabled skill "${skill.name}"`);
    onChange?.();
    onClose();
  };

  const handleFork = () => {
    onClose();
    new SkillEditorModal(plugin.app, plugin, 'fork', skill, () => onChange?.()).open();
  };

  const handleEdit = () => {
    onClose();
    new SkillEditorModal(plugin.app, plugin, 'edit', skill, () => onChange?.()).open();
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteSkill(plugin.app, skill.name);
    new Notice(`Deleted skill "${skill.name}"`);
    onChange?.();
    onClose();
  };

  return (
    <div className="knowlery-skill-detail">
      {/* Header */}
      <div className="knowlery-modal-header">
        <div className="knowlery-modal-header__icon">
          <SkillIcon name={skill.name} size={18} />
        </div>
        <div className="knowlery-modal-header__meta">
          <span className="knowlery-modal-header__eyebrow">
            {skillCategoryLabel} Skill
          </span>
          <span className="knowlery-modal-header__title">{skill.name}</span>
        </div>
      </div>

      {/* Body */}
      <div className="knowlery-modal-body">
        {/* What it does */}
        {whatItDoes && (
          <div>
            <div className="knowlery-skill-detail__section-title">
              <IconInfo size={16} />
              <h3>What it does</h3>
            </div>
            <div className="knowlery-rich-text" ref={whatItDoesRef} />
          </div>
        )}

        {/* Best For + Pro Tip */}
        {hasTipPair && (
          <div>
            <div className="knowlery-tip-pair">
              {bestFor && bestFor.length > 0 && (
                <div className="knowlery-tip-pair__card">
                  <div className="knowlery-tip-pair__header">Best For</div>
                  <ul className="knowlery-tip-pair__list">
                    {bestFor.map((item, i) => (
                      <li key={i}>
                        <IconCheckCircle size={14} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {proTip && (
                <div className="knowlery-tip-pair__card">
                  <div className="knowlery-tip-pair__header">Pro Tip</div>
                  <p className="knowlery-skill-detail__text">{proTip}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Example Usage */}
        {skill.detail?.example && (
          <div ref={exampleRef}>
            <div className="knowlery-skill-detail__section-title">
              <IconCode size={16} />
              <h3>Example prompt</h3>
            </div>
            <div className="knowlery-code-block">
              <div className="knowlery-code-block__header">
                <span className="knowlery-code-block__label">Prompt</span>
                <button
                  type="button"
                  className="knowlery-code-block__copy"
                  onClick={handleCopy}
                >
                  <IconClipboard size={14} />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <pre className="knowlery-code-block__body">{skill.detail.example}</pre>
            </div>
          </div>
        )}

        {/* Parameters */}
        {parameters && parameters.length > 0 && (
          <div>
            <div className="knowlery-skill-detail__section-title">
              <IconList size={16} />
              <h3>Parameters</h3>
            </div>
            <table className="knowlery-params-table">
              <thead>
                <tr>
                  <th>Flag</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {parameters.map((p, i) => (
                  <tr key={i}>
                    <td>{p.flag}</td>
                    <td>{p.type}</td>
                    <td>{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="knowlery-modal-footer">
        <div className="knowlery-modal-footer__status">
          <IconCheckCircle size={14} />
          <span>{skill.source === 'builtin' ? 'Built-in' : skill.source === 'registry' ? 'Installed' : 'Custom'} &middot; v{skill.content.match(/^version:\s*(.+)$/m)?.[1] ?? '1.0.0'}</span>
        </div>
        <div className="knowlery-modal-footer__actions">
          <button
            type="button"
            className="knowlery-btn knowlery-btn--outline"
            onClick={handleViewSource}
          >
            <IconBookOpen size={14} />
            <span>View source</span>
          </button>
          {skill.disabled ? (
            <button
              type="button"
              className="knowlery-btn knowlery-btn--outline"
              onClick={handleEnable}
            >
              Enable
            </button>
          ) : skill.source === 'builtin' ? (
            <>
              <button
                type="button"
                className="knowlery-btn knowlery-btn--outline"
                onClick={handleFork}
              >
                Fork
              </button>
              <button
                type="button"
                className="knowlery-btn knowlery-btn--outline knowlery-btn--danger"
                onClick={handleDisable}
              >
                Disable
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="knowlery-btn knowlery-btn--outline"
                onClick={handleEdit}
              >
                Edit
              </button>
              <button
                type="button"
                className={`knowlery-btn knowlery-btn--outline knowlery-btn--danger${confirmDelete ? ' is-confirming' : ''}`}
                onClick={handleDelete}
              >
                {confirmDelete ? 'Confirm delete' : 'Delete'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Companion banner */}
      {!bannerDismissed && (
        <div className="knowlery-modal-banner">
          <span>
            For best results, paste this command into{' '}
            <strong>{companionName}</strong> — it keeps your conversation in-vault.{' '}
            <a href={companionUrl} target="_blank" rel="noopener noreferrer">Learn more</a>
          </span>
          <button
            type="button"
            className="knowlery-modal-banner__close"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss"
          >
            <IconX size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
