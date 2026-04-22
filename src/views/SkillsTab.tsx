import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlugin } from '../context';
import type { SkillInfo, DashboardRefreshPayload } from '../types';
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GroupConfig {
  id: 'knowledge' | 'tooling' | 'registry' | 'custom';
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ size?: number }>;
}

const GROUPS: GroupConfig[] = [
  {
    id: 'knowledge',
    title: 'Knowledge',
    subtitle: 'Vault management & content workflows',
    Icon: IconBookOpen,
  },
  {
    id: 'tooling',
    title: 'Tooling',
    subtitle: 'Obsidian integrations & format references',
    Icon: IconWrench,
  },
  {
    id: 'registry',
    title: 'Installed',
    subtitle: 'Skills added from the browser registry',
    Icon: IconDownload,
  },
  {
    id: 'custom',
    title: 'Custom',
    subtitle: 'User-defined capabilities for this vault',
    Icon: IconPlus,
  },
];

/* ------------------------------------------------------------------ */
/*  SkillRow                                                           */
/* ------------------------------------------------------------------ */

function SkillRow(props: { skill: SkillInfo; onRefresh: () => void }) {
  const { skill, onRefresh } = props;
  const plugin = usePlugin();

  const badge = skill.disabled
    ? 'disabled'
    : skill.source === 'builtin'
      ? 'built-in'
      : skill.source === 'registry'
        ? 'installed'
        : 'custom';

  const open = () => {
    new SkillDetailModal(plugin.app, plugin, skill, false, onRefresh).open();
  };

  return (
    <button
      type="button"
      className={`knowlery-skill-row-item knowlery-skill-row-item--${skill.kind}${skill.disabled ? ' is-disabled' : ''}`}
      onClick={open}
      aria-label={`Open ${skill.name} details`}
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
      <span className={`knowlery-badge knowlery-badge--${badge}`}>{badge}</span>
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
          {skills.length} {skills.length === 1 ? 'skill' : 'skills'}
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
/*  SkillsTab                                                          */
/* ------------------------------------------------------------------ */

export function SkillsTab() {
  const plugin = usePlugin();
  const [skills, setSkills] = useState<SkillInfo[]>([]);

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const result = await listSkills(plugin.app);
    setSkills(result);
    if (payload) plugin.events.trigger('dashboard-refresh-complete', payload);
  }, [plugin]);

  useEffect(() => {
    refresh();
    const ref = plugin.events.on('dashboard-refresh', (payload?: DashboardRefreshPayload) => {
      refresh(payload);
    });
    return () => plugin.events.offref(ref);
  }, [plugin, refresh]);

  const grouped = useMemo(() => {
    const enabled = skills.filter((s) => !s.disabled);
    const disabled = skills.filter((s) => s.disabled);
    return {
      byKind: GROUPS.map((g) => ({
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
    <div className="knowlery-skills">
      <div className="knowlery-skills__toolbar">
        <div>
          <div className="knowlery-section-label">Skills</div>
          <div className="knowlery-skills__toolbar-desc">
            Agent capabilities installed in this vault.
          </div>
        </div>
        <div className="knowlery-skills__actions">
          <button
            className="knowlery-btn knowlery-btn--outline"
            onClick={() => new SkillEditorModal(plugin.app, plugin, 'create', null, refresh).open()}
          >
            <IconPlus size={14} />
            <span>Create</span>
          </button>
          <button
            className="knowlery-btn knowlery-btn--outline"
            onClick={() => new SkillBrowserModal(plugin.app, plugin, refresh).open()}
          >
            <IconPlus size={14} />
            <span>Browse</span>
          </button>
        </div>
      </div>

      {skills.length === 0 && (
        <div className="knowlery-empty-state">
          <IconInbox size={32} className="knowlery-empty-state__icon" />
          <p className="knowlery-empty-state__text">No skills found</p>
          <p className="knowlery-empty-state__hint">Run the setup wizard to install built-in skills.</p>
        </div>
      )}

      {grouped.byKind.map(({ config, items }) => (
        <SkillGroup
          key={config.id}
          config={config}
          skills={items}
          onRefresh={refresh}
        />
      ))}

      {grouped.disabled.length > 0 && (
        <section className="knowlery-skill-group knowlery-skill-group--disabled">
          <header className="knowlery-skill-group__header">
            <div className="knowlery-skill-group__meta">
              <div className="knowlery-skill-group__title">Disabled</div>
              <div className="knowlery-skill-group__subtitle">Hidden from the agent until re-enabled</div>
            </div>
            <span className="knowlery-skill-group__count">
              {grouped.disabled.length} {grouped.disabled.length === 1 ? 'skill' : 'skills'}
            </span>
          </header>
          <div className="knowlery-skill-list">
            {grouped.disabled.map((s) => (
              <SkillRow key={s.name} skill={s} onRefresh={refresh} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
