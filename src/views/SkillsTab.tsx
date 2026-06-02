import { useState, useEffect, useCallback } from 'react';
import { Notice } from 'obsidian';
import { usePlugin } from '../context';
import type { CounterSummary, DashboardRefreshPayload, KnowledgeThreadStage } from '../types';
import { buildCounterSummary } from '../core/activity-model';
import { sendPromptToClaudian } from '../core/claudian-bridge';
import { withActivityLedgerReminder } from '../core/agent-request';
import { readRecentActivityRecords } from '../core/activity-ledger';
import {
  IconChevronRight,
  IconChevronDown,
  IconClipboard,
  IconPlay,
} from './Icons';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PantryRecipe {
  id: string;
  title: string;
  threadLabel: string;
  description: string;
  request: string;
  skills: string;
}

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
    request: 'Help me distill recently added or unprocessed material into the knowledge base — extract key concepts, related entities, reusable structures, and update the necessary indexes.',
    skills: 'cook',
  },
  {
    id: 'connect-thread',
    title: 'Connect a thread',
    threadLabel: 'A topic that keeps coming back',
    description: 'Find older notes, adjacent themes, and reusable patterns around one active topic.',
    request: 'Pick a topic that keeps coming back recently. Review related older notes, find connections, reusable patterns, structural gaps, and parts worth distilling further.',
    skills: 'explore + cook',
  },
  {
    id: 'pressure-test',
    title: 'Pressure-test an idea',
    threadLabel: 'A belief, plan, or conclusion',
    description: 'Check assumptions, missing evidence, counterexamples, and open questions.',
    request: 'Help me pressure-test a recent important idea: which conclusions lack evidence, which assumptions should be challenged, and which counterexamples or risks are worth recording in the knowledge base.',
    skills: 'challenge + ask',
  },
  {
    id: 'clean-pantry',
    title: 'Clean the pantry',
    threadLabel: 'Vault structure and metadata',
    description: 'Review drift, duplicates, frontmatter gaps, broken links, and index hygiene.',
    request: 'Check the current structural health of the knowledge base: broken links, duplicate content, frontmatter gaps, index drift, and directories or notes that need organizing.',
    skills: 'audit + organize',
  },
  {
    id: 'bake-output',
    title: 'Create an output',
    threadLabel: 'Reusable artifact or decision',
    description: 'Turn existing notes into a checklist, outline, template, proposal, or decision memo.',
    request: 'Based on my knowledge base content, help me turn a mature topic into a reusable output: an outline, template, checklist, proposal, or decision memo.',
    skills: 'ask + ideas + cook',
  },
];

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
  const [summary, setSummary] = useState<CounterSummary | null>(null);
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);

  const refresh = useCallback(async (payload?: DashboardRefreshPayload) => {
    const activityResult = await readRecentActivityRecords(plugin.app, 14);
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

  const writeMoveRequestToClipboard = async (request: string) => {
    await navigator.clipboard.writeText(withActivityLedgerReminder(request));
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
      const sent = await sendPromptToClaudian(plugin.app, withActivityLedgerReminder(request));
      if (sent) {
        new Notice('Move request sent to claudian.');
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

    </div>
  );
}
