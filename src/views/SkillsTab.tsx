import { useState, useEffect, useCallback } from 'react';
import { Notice } from 'obsidian';
import { usePlugin } from '../context';
import type { CounterSummary, DashboardRefreshPayload, KnowledgeThreadStage } from '../types';
import { buildCounterSummary } from '../core/activity-model';
import { sendPromptToClaudian } from '../core/claudian-bridge';
import { withActivityLedgerReminder } from '../core/agent-request';
import { readRecentActivityRecords } from '../core/activity-ledger';
import { RECIPE_BOOK } from '../core/moves';
import {
  IconChevronRight,
  IconChevronDown,
  IconClipboard,
  IconPlay,
} from './Icons';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

// PantryRecipe shape is now DashboardMove in src/core/moves.ts.
// RECIPE_BOOK is imported from there; keep a local alias for the
// SkillsTab rendering until this file is deleted in Task 3.5.
type PantryRecipe = {
  id: string;
  title: string;
  threadLabel: string;
  description: string;
  request: string;
  skills: string;
};

// Map the shared DashboardMove shape to the local PantryRecipe shape used
// by the existing SkillsTab rendering below.
const RECIPE_BOOK_LOCAL: PantryRecipe[] = RECIPE_BOOK.map((m) => ({
  id: m.id,
  title: m.title,
  threadLabel: m.meta,
  description: m.description,
  request: m.prompt,
  skills: m.skillTag,
}));

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
          {RECIPE_BOOK_LOCAL.map((recipe) => (
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
