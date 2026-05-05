import { useState, useEffect, useCallback, useMemo } from 'react';
import { Notice } from 'obsidian';
import { usePlugin } from '../context';
import type { CounterSummary, DashboardRefreshPayload, KnowledgeThreadStage, SkillInfo } from '../types';
import { buildCounterSummary } from '../core/activity-model';
import { sendPromptToClaudian } from '../core/claudian-bridge';
import { readRecentActivityRecords } from '../core/activity-ledger';
import { listSkills } from '../core/skill-manager';
import { SkillBrowserModal } from '../modals/skill-browser';
import { SkillDetailModal } from '../modals/skill-detail';
import { SkillEditorModal } from '../modals/skill-editor';
import {
  IconChevronRight,
  IconChevronDown,
  IconPlus,
  IconInbox,
  IconBookOpen,
  IconClipboard,
  IconWrench,
  IconDownload,
  IconPlay,
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

interface PantryRecipe {
  id: string;
  title: string;
  threadLabel: string;
  description: string;
  request: string;
  skills: string;
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
    label: 'Create an output',
    description: 'Turn the thread into a template, decision, outline, checklist, or other reusable artifact.',
    skills: 'create + cook',
  },
  Reflect: {
    label: 'Review the pattern',
    description: 'Step back and notice how this topic is changing your thinking or knowledge habits.',
    skills: 'review',
  },
};

const RECIPE_BOOK: PantryRecipe[] = [
  {
    id: 'digest-new-material',
    title: 'Digest new material',
    threadLabel: 'Fresh notes, clips, or conversations',
    description: 'Turn rough material into durable notes, concepts, and index updates.',
    request: '请帮我把最近新增或未整理的材料沉淀进知识库，提炼关键概念、相关实体、可复用结构，并更新必要的索引。',
    skills: 'cook',
  },
  {
    id: 'connect-thread',
    title: 'Connect a thread',
    threadLabel: 'A topic that keeps coming back',
    description: 'Find older notes, adjacent themes, and reusable patterns around one active topic.',
    request: '请帮我选择一个最近反复出现的主题，回看相关旧笔记，找出连接、复用经验、结构缺口，以及值得进一步沉淀的部分。',
    skills: 'explore + cook',
  },
  {
    id: 'pressure-test',
    title: 'Pressure-test an idea',
    threadLabel: 'A belief, plan, or conclusion',
    description: 'Check assumptions, missing evidence, counterexamples, and open questions.',
    request: '请帮我检查最近一个重要想法：哪些结论缺少证据，哪些假设需要挑战，哪些反例或风险值得记录进知识库。',
    skills: 'challenge + ask',
  },
  {
    id: 'clean-pantry',
    title: 'Clean the pantry',
    threadLabel: 'Vault structure and metadata',
    description: 'Review drift, duplicates, frontmatter gaps, broken links, and index hygiene.',
    request: '请帮我检查知识库当前的结构健康：断链、重复内容、frontmatter 缺口、索引漂移，以及需要整理的目录或笔记。',
    skills: 'audit + organize',
  },
  {
    id: 'bake-output',
    title: 'Create an output',
    threadLabel: 'Reusable artifact or decision',
    description: 'Turn existing notes into a checklist, outline, template, proposal, or decision memo.',
    request: '请基于我的知识库内容，帮我把一个成熟主题转成可复用输出：提纲、模板、清单、方案或决策记录。',
    skills: 'ask + ideas + cook',
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

function PantryMoveActions(props: {
  request: string;
  onCopy: (request: string) => void;
  onSend: (request: string) => void;
}) {
  return (
    <div className="knowlery-pantry-move__actions">
      <button
        type="button"
      className="knowlery-btn knowlery-btn--outline"
        onClick={() => props.onCopy(props.request)}
      >
        <IconClipboard size={14} />
        <span>Copy recipe prompt</span>
      </button>
      <button
        type="button"
        className="knowlery-btn knowlery-btn--outline"
        onClick={() => props.onSend(props.request)}
      >
        <IconPlay size={14} />
        <span>Send recipe to agent</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkillsTab                                                          */
/* ------------------------------------------------------------------ */

export function SkillsTab() {
  const plugin = usePlugin();
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [summary, setSummary] = useState<CounterSummary | null>(null);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);

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

  const writeMoveRequestToClipboard = async (request: string) => {
    await navigator.clipboard.writeText(request);
  };

  const copyMoveRequest = async (request: string) => {
    try {
      await writeMoveRequestToClipboard(request);
      new Notice('Move request copied.');
    } catch {
      new Notice('Failed to copy move request.');
    }
  };

  const sendMoveRequest = async (request: string) => {
    try {
      const sent = await sendPromptToClaudian(plugin.app, request);
      if (sent) {
        new Notice('Move request sent to Claudian.');
        return;
      }
    } catch {
      // Fall through to the clipboard fallback below.
    }

    try {
      await writeMoveRequestToClipboard(request);
      new Notice('Claudian is not available. Request copied instead.');
    } catch {
      new Notice('Claudian is not available and the request could not be copied.');
    }
  };

  return (
    <div className="knowlery-skills">
      <div className="knowlery-skills__toolbar">
        <div>
          <div className="knowlery-section-label">Review Menu</div>
          <div className="knowlery-skills__toolbar-desc">
            Natural language moves for keeping your knowledge base alive.
          </div>
        </div>
      </div>

      <section className="knowlery-pantry-moves">
        <div className="knowlery-section-label">Suggested next moves</div>
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
                <div className="knowlery-pantry-move__request">
                  <span>{thread.suggestedRequest}</span>
                  <PantryMoveActions
                    request={thread.suggestedRequest}
                    onCopy={copyMoveRequest}
                    onSend={sendMoveRequest}
                  />
                </div>
              </article>
            );
          })}
          {summary && summary.knowledgeThreads.length === 0 && (
            <p className="knowlery-counter__empty">
              No suggested moves yet. Once agents leave activity receipts, Knowlery will recommend what to do next.
            </p>
          )}
        </div>
      </section>

      <section className="knowlery-pantry-moves">
        <div className="knowlery-section-label">Review moves</div>
        <div className="knowlery-pantry-moves__grid">
          {RECIPE_BOOK.map((recipe) => (
            <article key={recipe.id} className={`knowlery-pantry-move knowlery-pantry-move--recipe${openRecipeId === recipe.id ? ' is-open' : ''}`}>
              <button
                type="button"
                className="knowlery-pantry-move__summary"
                onClick={() => setOpenRecipeId((current) => current === recipe.id ? null : recipe.id)}
                aria-expanded={openRecipeId === recipe.id}
              >
                <div>
                  <h3>{recipe.title}</h3>
                  <span>{recipe.threadLabel}</span>
                </div>
                <span className="knowlery-pantry-move__summary-meta">
                  <span className="knowlery-pantry-move__skills">{recipe.skills}</span>
                  {openRecipeId === recipe.id ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                </span>
              </button>
              {openRecipeId === recipe.id && (
                <div className="knowlery-pantry-move__details">
                  <p>{recipe.description}</p>
                  <div className="knowlery-pantry-move__request">
                    <span>{recipe.request}</span>
                    <PantryMoveActions
                      request={recipe.request}
                      onCopy={copyMoveRequest}
                      onSend={sendMoveRequest}
                    />
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="knowlery-source-disclosure">
        <div className="knowlery-source-disclosure__header">
          <div>
            <div className="knowlery-section-label">Source skills</div>
            <div className="knowlery-skills__toolbar-desc">
              Advanced source prompts behind the review menu.
            </div>
          </div>
          <button
            type="button"
            className="knowlery-btn knowlery-btn--outline"
            onClick={() => setSourceExpanded((expanded) => !expanded)}
            aria-expanded={sourceExpanded}
          >
            <IconBookOpen size={14} />
            <span>{sourceExpanded ? 'Hide source skills' : 'View source skills'}</span>
          </button>
        </div>

        {sourceExpanded && (
          <>
            <div className="knowlery-skills__source-toolbar">
            <div>
              <div className="knowlery-section-label">Skill source library</div>
              <div className="knowlery-skills__toolbar-desc">Create, browse, and inspect the canonical skill prompts.</div>
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
          </>
        )}
      </section>
    </div>
  );
}
