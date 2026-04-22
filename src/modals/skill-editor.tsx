import { App, Modal, Notice } from 'obsidian';
import { StrictMode, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import type KnowleryPlugin from '../main';
import { PluginContext, usePlugin } from '../context';
import type { SkillInfo } from '../types';
import { forkSkill, createSkill, updateSkillContent } from '../core/skill-manager';

/* ------------------------------------------------------------------ */
/*  Modal wrapper                                                      */
/* ------------------------------------------------------------------ */

type EditorMode = 'create' | 'fork' | 'edit';

const SKILL_TEMPLATE = `---
name: my-skill
description: A short description of what this skill does
kind: tooling
---

## What it does

Describe the skill's purpose and behavior.

## Best For

- Use case 1
- Use case 2

## Example

\`\`\`
/knowlery my-skill "example prompt"
\`\`\`
`;

export class SkillEditorModal extends Modal {
  root: Root | null = null;

  constructor(
    app: App,
    private plugin: KnowleryPlugin,
    private mode: EditorMode,
    private skill: SkillInfo | null,
    private onSave: () => void,
  ) {
    super(app);
  }

  onOpen() {
    const titles: Record<EditorMode, string> = {
      create: 'Create skill',
      fork: `Fork: ${this.skill?.name ?? ''}`,
      edit: `Edit: ${this.skill?.name ?? ''}`,
    };
    this.setTitle(titles[this.mode]);
    this.contentEl.addClass('knowlery-modal');
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
  mode: EditorMode;
  skill: SkillInfo | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const plugin = usePlugin();

  const defaultName =
    props.mode === 'create'
      ? ''
      : props.mode === 'fork'
        ? `my-${props.skill?.name ?? ''}`
        : props.skill?.name ?? '';

  const defaultContent =
    props.mode === 'create'
      ? SKILL_TEMPLATE
      : props.skill?.content ?? '';

  const [name, setName] = useState(defaultName);
  const [content, setContent] = useState(defaultContent);

  const showNameField = props.mode === 'create' || props.mode === 'fork';

  const handleSave = async () => {
    const trimmedName = name.trim().replace(/[^a-zA-Z0-9\-_]/g, '');
    if (showNameField && !trimmedName) {
      new Notice('Skill name is required (letters, numbers, hyphens, underscores).');
      return;
    }

    try {
      if (props.mode === 'create') {
        await createSkill(plugin.app, trimmedName, content);
        new Notice(`Created skill "${trimmedName}"`);
      } else if (props.mode === 'fork') {
        await forkSkill(plugin.app, props.skill!.name, trimmedName, content);
        new Notice(`Forked skill "${props.skill!.name}" as "${trimmedName}"`);
      } else {
        await updateSkillContent(plugin.app, props.skill!.name, content);
        new Notice(`Updated skill "${props.skill!.name}"`);
      }
      props.onSave();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Error: ${msg}`);
    }
  };

  const saveLabel =
    props.mode === 'create' ? 'Create' : props.mode === 'fork' ? 'Fork' : 'Save';

  return (
    <div className="knowlery-skill-editor">
      {showNameField && (
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
          disabled={showNameField ? !name.trim() || !content : !content}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
