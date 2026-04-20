import { useState, useEffect, useCallback } from 'react';
import { Notice } from 'obsidian';
import { usePlugin } from '../context';
import type { SkillInfo } from '../types';
import {
  listSkills,
  disableSkill,
  enableSkill,
  deleteSkill,
} from '../core/skill-manager';
import { SkillEditorModal } from '../modals/skill-editor';
import { SkillBrowserModal } from '../modals/skill-browser';
import { SkillDetailModal } from '../modals/skill-detail';
import {
  IconChevronRight,
  IconPlus,
  IconInbox,
  IconCheckCircle,
  IconLightbulb,
} from './Icons';

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

  const hasTipCard =
    skill.kind === 'knowledge' &&
    ((skill.detail?.bestFor && skill.detail.bestFor.length > 0) ||
      skill.detail?.proTip);

  const bestForFirst = skill.detail?.bestFor?.[0];
  const proTip = skill.detail?.proTip
    ? skill.detail.proTip.slice(0, 60) + (skill.detail.proTip.length > 60 ? '…' : '')
    : undefined;

  return (
    <div className={`knowlery-accordion${expanded ? ' is-expanded' : ''}${skill.disabled ? ' is-disabled' : ''}`}>
      <button
        type="button"
        className="knowlery-accordion__header"
        onClick={() => setExpanded((v) => { if (v) setConfirmDelete(false); return !v; })}
        aria-expanded={expanded}
      >
        <span className="knowlery-accordion__chevron">
          <IconChevronRight size={14} />
        </span>
        {skill.emoji && (
          <span className="knowlery-skill-row__emoji" aria-hidden="true">{skill.emoji}</span>
        )}
        {skill.kind === 'knowledge' ? (
          <button
            className="knowlery-skill-row__name is-knowledge"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              new SkillDetailModal(plugin.app, plugin, skill, false).open();
            }}
          >
            {skill.name}
          </button>
        ) : (
          <span className="knowlery-skill-row__name">{skill.name}</span>
        )}
        {skill.description && (
          <span className="knowlery-skill-row__desc">{skill.description}</span>
        )}
        <span className={`knowlery-badge knowlery-badge--${badge.replace(/\s/g, '-')}`}>
          {badge}
        </span>
      </button>

      {expanded && (
        <div className="knowlery-accordion__body">
          <div className="knowlery-skill-row__code">
            {skill.content}
          </div>

          {hasTipCard && (
            <div className="knowlery-tip-card">
              {bestForFirst && (
                <div className="knowlery-tip-card__row">
                  <IconCheckCircle size={14} />
                  <span>Best For: {bestForFirst}</span>
                </div>
              )}
              {proTip && (
                <div className="knowlery-tip-card__row">
                  <IconLightbulb size={14} />
                  <span>Pro Tip: {proTip}</span>
                </div>
              )}
              <button
                type="button"
                className="knowlery-tip-card__link"
                onClick={() => { new SkillDetailModal(plugin.app, plugin, skill, true).open(); }}
              >
                Example Prompt →
              </button>
            </div>
          )}

          <div className="knowlery-skill-row__actions">
            {skill.disabled ? (
              <button
                className="knowlery-btn knowlery-btn--outline"
                onClick={handleEnable}
              >
                Enable
              </button>
            ) : skill.source === 'builtin' ? (
              <>
                <button
                  className="knowlery-btn knowlery-btn--outline"
                  onClick={handleFork}
                >
                  Fork
                </button>
                <button
                  className="knowlery-btn knowlery-btn--outline knowlery-btn--danger"
                  onClick={handleDisable}
                >
                  Disable
                </button>
              </>
            ) : (
              <>
                <button
                  className="knowlery-btn knowlery-btn--outline"
                  onClick={handleEdit}
                >
                  Edit
                </button>
                <button
                  className={`knowlery-btn knowlery-btn--outline knowlery-btn--danger${confirmDelete ? ' is-confirming' : ''}`}
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
      {skills.length === 0 && (
        <div className="knowlery-empty-state">
          <IconInbox size={32} className="knowlery-empty-state__icon" />
          <p className="knowlery-empty-state__text">No skills found</p>
          <p className="knowlery-empty-state__hint">Run the setup wizard to install built-in skills.</p>
        </div>
      )}

      {enabled.length > 0 && (
        <>
          <div className="knowlery-section-label">
            <span>Active Skills ({enabled.length})</span>
          </div>
          {enabled.map((s) => (
            <SkillRow key={s.name} skill={s} onRefresh={refresh} />
          ))}
        </>
      )}

      {disabled.length > 0 && (
        <>
          <div className="knowlery-section-label">
            <span>Disabled ({disabled.length})</span>
          </div>
          {disabled.map((s) => (
            <SkillRow key={s.name} skill={s} onRefresh={refresh} />
          ))}
        </>
      )}

      <button
        className="knowlery-btn knowlery-btn--outline is-full-width knowlery-skills__browse"
        onClick={() => new SkillBrowserModal(plugin.app, plugin).open()}
      >
        <IconPlus size={14} />
        <span>Browse more skills</span>
      </button>
    </div>
  );
}
