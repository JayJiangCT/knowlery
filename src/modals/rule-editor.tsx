import { App, Modal } from 'obsidian';
import { StrictMode, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin, useSettings } from '../context';
import type { RuleInfo } from '../types';
import { writeRule, getRuleTemplates } from '../core/rule-manager';
import { IconFileText, IconPlus, IconChevronRight } from '../views/Icons';

/* ------------------------------------------------------------------ */
/*  Modal wrapper                                                      */
/* ------------------------------------------------------------------ */

export class RuleEditorModal extends Modal {
  root: Root | null = null;

  constructor(
    app: App,
    private plugin: KnowleryPlugin,
    private mode: 'view' | 'edit' | 'add',
    private rule: RuleInfo | null,
    private onSave: () => void,
  ) {
    super(app);
  }

  onOpen() {
    const titles = { view: 'View rule', edit: 'Edit rule', add: 'Add rule' };
    this.setTitle(titles[this.mode]);
    this.contentEl.addClass('knowlery-modal');
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <RuleEditorContent
            mode={this.mode}
            rule={this.rule}
            onSave={() => {
              this.onSave();
              this.close();
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
/*  Content component                                                  */
/* ------------------------------------------------------------------ */

function RuleEditorContent(props: {
  mode: 'view' | 'edit' | 'add';
  rule: RuleInfo | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const plugin = usePlugin();
  const [settings] = useSettings();

  const [showTemplates, setShowTemplates] = useState(props.mode === 'add');
  const [filename, setFilename] = useState(props.rule?.filename ?? '');
  const [content, setContent] = useState(props.rule?.content ?? '');

  const templates = getRuleTemplates();

  const handleTemplateSelect = (templateContent: string, templateFilename: string) => {
    setContent(templateContent);
    setFilename(templateFilename);
    setShowTemplates(false);
  };

  const handleCustom = () => {
    setContent('');
    setFilename('');
    setShowTemplates(false);
  };

  const handleSave = async () => {
    const fname = filename.endsWith('.md') ? filename : `${filename}.md`;
    await writeRule(plugin.app, settings.platform, fname, content);
    props.onSave();
  };

  /* ---- view mode ---- */
  if (props.mode === 'view') {
    return (
      <div className="knowlery-rule-editor">
        <pre className="knowlery-rule-editor__preview">{props.rule?.content}</pre>
        <div className="knowlery-rule-editor__actions">
          <button onClick={props.onCancel}>Close</button>
        </div>
      </div>
    );
  }

  /* ---- add mode: template selection ---- */
  if (props.mode === 'add' && showTemplates) {
    return (
      <div className="knowlery-rule-editor">
        <p className="knowlery-rule-editor__prompt">Choose a template or start from scratch:</p>
        <div className="knowlery-rule-editor__templates">
          {templates.map((t) => (
            <button
              key={t.filename}
              className="knowlery-rule-editor__template-btn"
              onClick={() => handleTemplateSelect(t.content, t.filename)}
            >
              <span className="knowlery-rule-editor__template-icon" aria-hidden="true">
                <IconFileText size={16} />
              </span>
              <span className="knowlery-rule-editor__template-body">
                <span className="knowlery-rule-editor__template-name">{t.name}</span>
                <span className="knowlery-rule-editor__template-desc">{t.description}</span>
              </span>
              <span className="knowlery-rule-editor__template-chevron" aria-hidden="true">
                <IconChevronRight size={14} />
              </span>
            </button>
          ))}
          <button
            className="knowlery-rule-editor__template-btn"
            onClick={handleCustom}
          >
            <span className="knowlery-rule-editor__template-icon" aria-hidden="true">
              <IconPlus size={16} />
            </span>
            <span className="knowlery-rule-editor__template-body">
              <span className="knowlery-rule-editor__template-name">Custom (blank)</span>
              <span className="knowlery-rule-editor__template-desc">Start with an empty rule file</span>
            </span>
            <span className="knowlery-rule-editor__template-chevron" aria-hidden="true">
              <IconChevronRight size={14} />
            </span>
          </button>
        </div>
      </div>
    );
  }

  /* ---- add mode (after template) / edit mode ---- */
  return (
    <div className="knowlery-rule-editor">
      {props.mode === 'add' && (
        <div className="knowlery-rule-editor__field">
          <label>Filename</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="my-rule.md"
          />
        </div>
      )}

      <div className="knowlery-rule-editor__field">
        <label>Content</label>
        <textarea
          className="knowlery-rule-editor__textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
        />
      </div>

      <div className="knowlery-rule-editor__actions">
        <button onClick={props.onCancel}>Cancel</button>
        <button
          className="mod-cta"
          onClick={handleSave}
          disabled={!filename || !content}
        >
          Save
        </button>
      </div>
    </div>
  );
}
