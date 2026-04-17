import { useState, useEffect, useCallback } from 'react';
import { Notice } from 'obsidian';
import { usePlugin, useSettings } from '../context';
import type { SkillInfo } from '../types';
import {
  listSkills,
  disableSkill,
  enableSkill,
  deleteSkill,
} from '../core/skill-manager';
import { SkillEditorModal } from '../modals/skill-editor';

/* ------------------------------------------------------------------ */
/*  SkillRow                                                           */
/* ------------------------------------------------------------------ */

function SkillRow(props: {
  skill: SkillInfo;
  onRefresh: () => void;
}) {
  const plugin = usePlugin();
  const { skill, onRefresh } = props;
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const badge = skill.disabled
    ? 'disabled'
    : skill.source === 'builtin'
      ? 'built-in'
      : 'custom';

  const handleDisable = async () => {
    await disableSkill(plugin.app, skill.name);
    new Notice(`Disabled skill "${skill.name}"`);
    onRefresh();
  };

  const handleEnable = async () => {
    await enableSkill(plugin.app, skill.name);
    new Notice(`Enabled skill "${skill.name}"`);
    onRefresh();
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteSkill(plugin.app, skill.name);
    new Notice(`Deleted skill "${skill.name}"`);
    onRefresh();
  };

  const handleFork = () => {
    new SkillEditorModal(plugin.app, plugin, 'fork', skill, onRefresh).open();
  };

  const handleEdit = () => {
    new SkillEditorModal(plugin.app, plugin, 'edit', skill, onRefresh).open();
  };

  return (
    <div className="knowlery-skill-row">
      <div
        className="knowlery-skill-row__header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded);
        }}
      >
        {skill.emoji && (
          <span className="knowlery-skill-row__emoji">{skill.emoji}</span>
        )}
        <span className="knowlery-skill-row__name">{skill.name}</span>
        {skill.description && (
          <span className="knowlery-skill-row__desc">{skill.description}</span>
        )}
        <span className={`knowlery-badge knowlery-badge--${badge.replace(/\s/g, '-')}`}>
          {badge}
        </span>
      </div>

      {expanded && (
        <div className="knowlery-skill-row__body">
          <pre className="knowlery-skill-row__content">{skill.content}</pre>
          <div className="knowlery-skill-row__actions">
            {skill.disabled ? (
              <button onClick={handleEnable}>Enable</button>
            ) : skill.source === 'builtin' ? (
              <>
                <button onClick={handleFork}>Fork</button>
                <button onClick={handleDisable}>Disable</button>
              </>
            ) : (
              <>
                <button onClick={handleEdit}>Edit</button>
                <button
                  className={confirmDelete ? 'mod-warning' : ''}
                  onClick={handleDelete}
                >
                  {confirmDelete ? 'Confirm delete' : 'Delete'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkillsTab                                                          */
/* ------------------------------------------------------------------ */

export function SkillsTab() {
  const plugin = usePlugin();
  const [skills, setSkills] = useState<SkillInfo[]>([]);

  const refresh = useCallback(async () => {
    const result = await listSkills(plugin.app);
    setSkills(result);
  }, [plugin]);

  useEffect(() => {
    refresh();
    const ref = plugin.events.on('dashboard-refresh', refresh);
    return () => plugin.events.offref(ref);
  }, [plugin, refresh]);

  const enabled = skills.filter((s) => !s.disabled);
  const disabled = skills.filter((s) => s.disabled);

  return (
    <div className="knowlery-skills">
      {enabled.length > 0 && (
        <>
          {enabled.map((s) => (
            <SkillRow key={s.name} skill={s} onRefresh={refresh} />
          ))}
        </>
      )}

      {disabled.length > 0 && (
        <>
          <div className="knowlery-skills__divider">Disabled</div>
          {disabled.map((s) => (
            <SkillRow key={s.name} skill={s} onRefresh={refresh} />
          ))}
        </>
      )}

      {skills.length === 0 && (
        <p>No skills found. Run the setup wizard to install built-in skills.</p>
      )}
    </div>
  );
}
