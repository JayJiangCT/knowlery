import { App, Modal, Notice } from 'obsidian';
import { StrictMode, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin } from '../context';
import type { SkillInfo } from '../types';
import { forkSkill, updateSkillContent } from '../core/skill-manager';

/* ------------------------------------------------------------------ */
/*  Modal wrapper                                                      */
/* ------------------------------------------------------------------ */

export class SkillEditorModal extends Modal {
  root: Root | null = null;

  constructor(
    app: App,
    private plugin: KnowleryPlugin,
    private mode: 'fork' | 'edit',
    private skill: SkillInfo,
    private onSave: () => void,
  ) {
    super(app);
  }

  onOpen() {
    this.setTitle(
      this.mode === 'fork'
        ? `Fork: ${this.skill.name}`
        : `Edit: ${this.skill.name}`,
    );
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <PluginContext.Provider value={this.plugin}>
          <SkillEditorContent
            mode={this.mode}
            skill={this.skill}
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

function SkillEditorContent(props: {
  mode: 'fork' | 'edit';
  skill: SkillInfo;
  onSave: () => void;
  onCancel: () => void;
}) {
  const plugin = usePlugin();

  const [name, setName] = useState(
    props.mode === 'fork' ? `my-${props.skill.name}` : props.skill.name,
  );
  const [content, setContent] = useState(props.skill.content);

  const handleSave = async () => {
    try {
      if (props.mode === 'fork') {
        await forkSkill(plugin.app, props.skill.name, name, content);
        new Notice(`Forked skill "${props.skill.name}" as "${name}"`);
      } else {
        await updateSkillContent(plugin.app, props.skill.name, content);
        new Notice(`Updated skill "${props.skill.name}"`);
      }
      props.onSave();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Error: ${msg}`);
    }
  };

  return (
    <div className="knowlery-skill-editor">
      {props.mode === 'fork' && (
        <div className="knowlery-skill-editor__field">
          <label>Skill name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-skill-name"
          />
        </div>
      )}

      <div className="knowlery-skill-editor__field">
        <label>Content</label>
        <textarea
          className="knowlery-skill-editor__textarea"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
        />
      </div>

      <div className="knowlery-skill-editor__actions">
        <button onClick={props.onCancel}>Cancel</button>
        <button
          className="mod-cta"
          onClick={handleSave}
          disabled={!name || !content}
        >
          {props.mode === 'fork' ? 'Fork' : 'Save'}
        </button>
      </div>
    </div>
  );
}
