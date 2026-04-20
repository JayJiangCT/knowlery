import { App, Modal, MarkdownRenderer, normalizePath, Notice, Component } from 'obsidian';
import { StrictMode, useState, useEffect, useRef } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin, useSettings } from '../context';
import type { SkillInfo } from '../types';
import { copySkillCommand, runSkillViaCli } from '../core/skill-executor';
import { detectAgentCli } from '../core/cli-detect';
import type { CliDetection } from '../core/cli-detect';
import {
  IconX,
  IconCheckCircle,
  IconInfo,
  IconList,
  IconCode,
  IconPlay,
  IconClipboard,
  IconBookOpen,
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
}) {
  const { skill, scrollToExample, onClose } = props;
  const plugin = usePlugin();
  const [settings] = useSettings();

  const [copied, setCopied] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [cliDetection, setCliDetection] = useState<CliDetection | null>(null);

  const whatItDoesRef = useRef<HTMLDivElement>(null);
  const exampleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    detectAgentCli()
      .then(setCliDetection)
      .catch(() => setCliDetection({ claudeCode: { installed: false }, opencode: { installed: false } }));
  }, []);

  useEffect(() => {
    const el = whatItDoesRef.current;
    if (!el || !skill.detail?.whatItDoes) return;
    el.replaceChildren();
    const component = new Component();
    component.load();
    void MarkdownRenderer.render(plugin.app, skill.detail.whatItDoes, el, '', component);
    return () => component.unload();
  }, [skill.detail?.whatItDoes, plugin.app]);

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

  const handleViewSource = () => {
    const path = normalizePath(`.agents/skills/${skill.name}/SKILL.md`);
    const file = plugin.app.vault.getFileByPath(path);
    if (!file) { new Notice(`SKILL.md not found for "${skill.name}"`); return; }
    const leaf = plugin.app.workspace.getLeaf(false);
    if (!leaf) { new Notice('No open pane available.'); return; }
    void leaf.openFile(file);
    onClose();
  };

  const handleRun = () => {
    const cli = settings.platform === 'claude-code' ? 'claude' : 'opencode';
    void runSkillViaCli(skill, cli);
  };

  const bestFor = skill.detail?.bestFor;
  const proTip = skill.detail?.proTip;
  const hasTipPair = (bestFor && bestFor.length > 0) || proTip;
  const parameters = skill.detail?.parameters;

  return (
    <div className="knowlery-skill-detail">
      {/* Header */}
      <div className="knowlery-modal-header">
        <div className="knowlery-modal-header__meta">
          <span className="knowlery-modal-header__eyebrow">
            {skill.emoji} Skill
          </span>
          <span className="knowlery-modal-header__title">{skill.name}</span>
        </div>
        <button
          type="button"
          className="knowlery-modal-header__close"
          onClick={onClose}
          aria-label="Close"
        >
          <IconX size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="knowlery-modal__body">
        {/* What it does */}
        {skill.detail?.whatItDoes && (
          <div>
            <div className="knowlery-section-heading">
              <IconInfo size={16} />
              <h3>What it does</h3>
            </div>
            <div className="knowlery-rich-text" ref={whatItDoesRef} />
          </div>
        )}

        {/* Best For + Pro Tip */}
        {hasTipPair && (
          <div>
            <div className="knowlery-section-heading">
              <IconList size={16} />
              <h3>Usage Tips</h3>
            </div>
            <div className="knowlery-tip-pair">
              {bestFor && bestFor.length > 0 && (
                <div className="knowlery-tip-pair__card">
                  <div className="knowlery-tip-pair__header">Best For</div>
                  <ul className="knowlery-tip-pair__list">
                    {bestFor.map((item, i) => (
                      <li key={i}>
                        <IconCheckCircle size={13} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {proTip && (
                <div className="knowlery-tip-pair__card">
                  <div className="knowlery-tip-pair__header">Pro Tip ★</div>
                  <p className="knowlery-tip-pair__text">{proTip}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Example Usage */}
        {skill.detail?.example && (
          <div ref={exampleRef}>
            <div className="knowlery-section-heading">
              <IconCode size={16} />
              <h3>Example Usage</h3>
            </div>
            <div className="knowlery-code-block">
              <div className="knowlery-code-block__header">
                <span className="knowlery-code-block__label">Example Usage</span>
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
            <div className="knowlery-section-heading">
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
      <div className="knowlery-modal__footer">
        {!bannerDismissed && (
          <div className="knowlery-modal__banner">
            <span className="knowlery-modal__banner-text">
              💡 For best results, paste this command into{' '}
              <strong>{companionName}</strong> — it keeps your conversation in-vault.{' '}
              <a href={companionUrl} target="_blank" rel="noopener noreferrer">Learn more</a>
            </span>
            <button
              type="button"
              className="knowlery-modal__banner-close"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss"
            >
              <IconX size={14} />
            </button>
          </div>
        )}

        <div className="knowlery-modal__footer-row">
          <button
            type="button"
            className="knowlery-btn knowlery-btn--ghost"
            onClick={handleViewSource}
          >
            <IconBookOpen size={14} />
            <span>View source</span>
          </button>
          <div className="knowlery-modal__footer-actions">
            <button
              type="button"
              className="knowlery-btn knowlery-btn--outline"
              onClick={handleCopy}
            >
              <IconClipboard size={14} />
              <span>{copied ? 'Copied!' : 'Copy command'}</span>
            </button>
            <button
              type="button"
              className="knowlery-btn knowlery-btn--primary"
              onClick={handleRun}
              disabled={!canRun}
              title={
                canRun
                  ? undefined
                  : `Install ${settings.platform === 'claude-code' ? 'Claude Code' : 'OpenCode'} CLI to run this skill directly`
              }
            >
              <IconPlay size={14} />
              <span>Run skill</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
