import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePlugin } from '../context';
import type { CounterSummary, DashboardRefreshPayload, KnowledgeThreadStage, SkillInfo } from '../types';
import { buildCounterSummary } from '../core/activity-model';
import { readRecentActivityRecords } from '../core/activity-ledger';
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

const MOVE_RECIPES: Record<KnowledgeThreadStage, { label: string; description: string; skills: string }> = {
  Capture: {
    label: 'Capture fresh material',
    description: 'Turn a conversation, source, or rough idea into durable notes before the details fade.',
    skills: 'cook',
  },
  Connect: {
    label: 'Connect to older notes',
    description: 'Look for reusable patterns, related concepts, and places where this thread belongs in the vault.',
    skills: 'explore + cook',
  },
  Question: {
    label: 'Challenge assumptions',
    description: 'Check whether the thread has weak evidence, stale conclusions, or questions worth opening.',
    skills: 'challenge + explore',
  },
  Clean: {
    label: 'Clean the pantry',
    description: 'Find drift, duplicate structure, missing metadata, and notes that need a quieter shape.',
    skills: 'review + fix',
  },
  Create: {
    label: 'Bake an output',
    description: 'Turn the thread into a template, decision, outline, checklist, or other reusable artifact.',
    skills: 'create + cook',
  },
  Reflect: {
    label: 'Review the pattern',
    description: 'Step back and notice how this topic is changing your thinking or knowledge habits.',
    skills: 'review',
  },
};

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
  const [summary, setSummary] = useState<CounterSummary | null>(null);

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const [skillResult, activityResult] = await Promise.all([
      listSkills(plugin.app),
      readRecentActivityRecords(plugin.app, 14),
    ]);
    setSkills(skillResult);
    setSummary(buildCounterSummary(activityResult.records, activityResult.errors.length));
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
          <div className="knowlery-section-label">Pantry</div>
          <div className="knowlery-skills__toolbar-desc">
            Recipes and source skills for working with your knowledge base.
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

      <section className="knowlery-pantry-moves">
        <div className="knowlery-section-label">Suggested moves</div>
        <div className="knowlery-pantry-moves__grid">
          {(summary?.knowledgeThreads ?? []).slice(0, 3).map((thread) => {
            const recipe = MOVE_RECIPES[thread.nextMove];
            return (
              <article key={thread.id} className="knowlery-pantry-move">
                <div className="knowlery-pantry-move__header">
                  <div>
                    <h3>{recipe.label}</h3>
                    <span>{thread.title}</span>
                  </div>
                  <span className="knowlery-pantry-move__skills">{recipe.skills}</span>
                </div>
                <p>{recipe.description}</p>
                <div className="knowlery-pantry-move__request">{thread.suggestedRequest}</div>
              </article>
            );
          })}
          {summary && summary.knowledgeThreads.length === 0 && (
            <p className="knowlery-counter__empty">
              No suggested moves yet. Once agents leave activity receipts, Pantry will recommend what to do next.
            </p>
          )}
        </div>
      </section>

      <div className="knowlery-section-label">Skill source</div>

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
