import { useState, useEffect, useCallback, useMemo } from 'react';
import { Notice } from 'obsidian';
import { usePlugin } from '../context';
import type { SkillInfo } from '../types';
import { listSkills } from '../core/skill-manager';
import { SkillBrowserModal } from '../modals/skill-browser';
import { SkillDetailModal } from '../modals/skill-detail';
import { SkillEditorModal } from '../modals/skill-editor';
import {
  IconChevronRight,
  IconPlus,
  IconInbox,
  IconBookOpen,
  IconWrench,
  IconDownload,
  SkillIcon,
} from './Icons';
import { t, tCount } from '../i18n';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GroupConfig {
  id: 'knowledge' | 'tooling' | 'registry' | 'custom';
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ size?: number }>;
}

/** Built per render so a language switch re-resolves the copy. */
function getGroups(): GroupConfig[] {
  return [
    {
      id: 'knowledge',
      title: t('skills.group.knowledge.title'),
      subtitle: t('skills.group.knowledge.subtitle'),
      Icon: IconBookOpen,
    },
    {
      id: 'tooling',
      title: t('skills.group.tooling.title'),
      subtitle: t('skills.group.tooling.subtitle'),
      Icon: IconWrench,
    },
    {
      id: 'registry',
      title: t('skills.group.registry.title'),
      subtitle: t('skills.group.registry.subtitle'),
      Icon: IconDownload,
    },
    {
      id: 'custom',
      title: t('skills.group.custom.title'),
      subtitle: t('skills.group.custom.subtitle'),
      Icon: IconPlus,
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  SkillRow                                                           */
/* ------------------------------------------------------------------ */

function SkillRow(props: { skill: SkillInfo; onRefresh: () => void }) {
  const { skill, onRefresh } = props;
  const plugin = usePlugin();

  const badgeClass = skill.disabled
    ? 'disabled'
    : skill.source === 'builtin'
      ? 'built-in'
      : skill.source === 'registry'
        ? 'installed'
        : 'custom';
  const badgeLabel = skill.disabled
    ? t('skills.badge.disabled')
    : skill.source === 'builtin'
      ? t('skills.badge.builtin')
      : skill.source === 'registry'
        ? t('skills.badge.installed')
        : t('skills.badge.custom');

  const open = () => {
    new SkillDetailModal(plugin.app, plugin, skill, false, onRefresh).open();
  };

  return (
    <button
      type="button"
      className={`knowlery-skill-row-item knowlery-skill-row-item--${skill.kind}${skill.disabled ? ' is-disabled' : ''}`}
      onClick={open}
      aria-label={t('skills.openDetails', { name: skill.name })}
    >
      <span className="knowlery-skill-row-item__icon" aria-hidden="true">
        <SkillIcon name={skill.name} size={18} />
      </span>
      <div className="knowlery-skill-row-item__body">
        <span className="knowlery-skill-row-item__name">{skill.name}</span>
        {skill.description && (
          <span className="knowlery-skill-row-item__desc">{skill.description}</span>
        )}
      </div>
      <span className={`knowlery-badge knowlery-badge--${badgeClass}`}>{badgeLabel}</span>
      <span className="knowlery-skill-row-item__chevron" aria-hidden="true">
        <IconChevronRight size={14} />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  SkillGroup                                                         */
/* ------------------------------------------------------------------ */

function SkillGroup(props: {
  config: GroupConfig;
  skills: SkillInfo[];
  onRefresh: () => void;
}) {
  const { config, skills, onRefresh } = props;
  if (skills.length === 0) return null;
  return (
    <section className={`knowlery-skill-group knowlery-skill-group--${config.id}`}>
      <header className="knowlery-skill-group__header">
        <span className="knowlery-skill-group__icon" aria-hidden="true">
          <config.Icon size={16} />
        </span>
        <div className="knowlery-skill-group__meta">
          <div className="knowlery-skill-group__title">{config.title}</div>
          <div className="knowlery-skill-group__subtitle">{config.subtitle}</div>
        </div>
        <span className="knowlery-skill-group__count">
          {tCount('skills.count', skills.length)}
        </span>
      </header>
      <div className="knowlery-skill-list">
        {skills.map((s) => (
          <SkillRow key={s.name} skill={s} onRefresh={onRefresh} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  SkillsLibrary                                                      */
/* ------------------------------------------------------------------ */

export function SkillsLibrary() {
  const plugin = usePlugin();
  const [skills, setSkills] = useState<SkillInfo[]>([]);

  const refresh = useCallback(async () => {
    try {
      setSkills(await listSkills(plugin.fs));
    } catch {
      new Notice(t('skills.loadFailed'));
    }
  }, [plugin]);

  useEffect(() => {
    void refresh();
    const ref = plugin.events.on('dashboard-refresh', () => {
      void refresh();
    });
    return () => plugin.events.offref(ref);
  }, [plugin, refresh]);

  const grouped = useMemo(() => {
    const enabled = skills.filter((s) => !s.disabled);
    const disabled = skills.filter((s) => s.disabled);
    return {
      byKind: getGroups().map((g) => ({
        config: g,
        items: g.id === 'custom'
          ? enabled.filter((s) => s.source === 'custom')
          : g.id === 'registry'
            ? enabled.filter((s) => s.source === 'registry')
            : enabled.filter((s) => s.source === 'builtin' && s.kind === g.id),
      })),
      disabled,
    };
  }, [skills]);

  return (
    <div className="knowlery-skills-library">
      <div className="knowlery-skills__source-toolbar">
        <div>
          <div className="knowlery-section-label">{t('skills.sourceLibrary')}</div>
          <div className="knowlery-skills__toolbar-desc">{t('skills.sourceLibraryDesc')}</div>
        </div>
        <div className="knowlery-skills__actions">
          <button
            className="knowlery-btn knowlery-btn--outline"
            onClick={() => new SkillEditorModal(plugin.app, plugin, 'create', null, () => void refresh()).open()}
          >
            <IconPlus size={14} />
            <span>{t('skills.create')}</span>
          </button>
          <button
            className="knowlery-btn knowlery-btn--outline"
            onClick={() => new SkillBrowserModal(plugin.app, plugin, () => void refresh()).open()}
          >
            <IconPlus size={14} />
            <span>{t('skills.browse')}</span>
          </button>
        </div>
      </div>

      {skills.length === 0 && (
        <div className="knowlery-empty-state">
          <IconInbox size={32} className="knowlery-empty-state__icon" />
          <p className="knowlery-empty-state__text">{t('skills.noneFound')}</p>
          <p className="knowlery-empty-state__hint">{t('skills.noneFoundHint')}</p>
        </div>
      )}

      {grouped.byKind.map(({ config, items }) => (
        <SkillGroup
          key={config.id}
          config={config}
          skills={items}
          onRefresh={() => void refresh()}
        />
      ))}

      {grouped.disabled.length > 0 && (
        <section className="knowlery-skill-group knowlery-skill-group--disabled">
          <header className="knowlery-skill-group__header">
            <div className="knowlery-skill-group__meta">
              <div className="knowlery-skill-group__title">{t('skills.group.disabled.title')}</div>
              <div className="knowlery-skill-group__subtitle">{t('skills.group.disabled.subtitle')}</div>
            </div>
            <span className="knowlery-skill-group__count">
              {tCount('skills.count', grouped.disabled.length)}
            </span>
          </header>
          <div className="knowlery-skill-list">
            {grouped.disabled.map((s) => (
              <SkillRow key={s.name} skill={s} onRefresh={() => void refresh()} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
