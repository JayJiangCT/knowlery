import type { ActivityRecord, CounterSummary, VaultStats } from '../types';
import { buildCounterSummary } from './activity-model';

export type TodayStage = 'empty-vault' | 'first-maintenance' | 'returning';

export interface TodayAction {
  label: string;
  request?: string;
  kind: 'local' | 'agent-request' | 'report';
}

export interface TodayModel {
  stage: TodayStage;
  title: string;
  body: string;
  primaryAction: TodayAction;
  secondaryActions: TodayAction[];
  stats: Array<{ label: string; value: string }>;
  summary: CounterSummary;
}

export function buildTodayModel(stats: VaultStats, records: ActivityRecord[]): TodayModel {
  const summary = buildCounterSummary(records);
  if (records.length > 0) {
    return buildReturningModel(summary);
  }

  const knowledgeNotes = stats.entitiesCount + stats.conceptsCount + stats.comparisonsCount + stats.queriesCount;
  if (knowledgeNotes === 0 && stats.notesCount <= 3) {
    return {
      stage: 'empty-vault',
      title: 'Start with one note.',
      body: 'Add one idea, article, question, or conversation worth keeping. Knowlery becomes useful after there is a first piece of material on the counter.',
      primaryAction: { label: 'Add first note', kind: 'local' },
      secondaryActions: [
        { label: 'Add reflection', kind: 'local' },
        { label: 'Import one source', kind: 'agent-request' },
      ],
      stats: [
        { label: 'knowledge notes', value: String(knowledgeNotes) },
        { label: 'activity records', value: '0' },
      ],
      summary,
    };
  }

  return {
    stage: 'first-maintenance',
    title: 'Your vault already has material. Let’s do the first cook.',
    body: 'Pick existing notes and turn them into a more reusable knowledge structure. Knowlery will start with a gentle baseline instead of asking you to rebuild everything.',
    primaryAction: {
      label: 'Prepare first cook',
      kind: 'agent-request',
      request: '请帮我对这个 vault 做第一次知识库维护：选择几篇已有笔记，提炼关键概念、相关实体、结构缺口，并建议如何把它们沉淀成更可复用的知识结构。',
    },
    secondaryActions: [
      { label: 'Scan vault health', kind: 'local' },
      { label: 'Open recipes', kind: 'local' },
    ],
    stats: [
      { label: 'markdown notes', value: String(stats.notesCount) },
      { label: 'knowledge notes', value: String(knowledgeNotes) },
      { label: 'wikilinks', value: String(stats.wikilinksCount) },
    ],
    summary,
  };
}

function buildReturningModel(summary: CounterSummary): TodayModel {
  const firstTheme = summary.recurringThemes[0]?.name;
  const secondTheme = summary.recurringThemes[1]?.name;
  const topicPhrase = firstTheme && secondTheme
    ? `「${firstTheme}」 and 「${secondTheme}」`
    : firstTheme
      ? `「${firstTheme}」`
      : 'recent knowledge work';
  const thread = summary.knowledgeThreads[0];

  return {
    stage: 'returning',
    title: `Recently you have been shaping ${topicPhrase}.`,
    body: thread
      ? `${thread.nextMoveReason} A small next move is enough: ${thread.nextMove.toLowerCase()} this thread before adding more material.`
      : 'Your recent activity is ready for a quiet review. Look for one note or thread that is worth baking into a reusable shape.',
    primaryAction: {
      label: thread ? 'Prepare next move' : 'Review recent work',
      kind: 'agent-request',
      request: thread?.suggestedRequest,
    },
    secondaryActions: [
      { label: 'Generate Weekly Atlas', kind: 'report' },
      { label: 'Open review menu', kind: 'local' },
    ],
    stats: [
      { label: 'activity records', value: String(summary.coverage.recordsLogged) },
      { label: 'active threads', value: String(summary.knowledgeThreads.length) },
      { label: 'unbaked notes', value: String(summary.unbakedNotes.length) },
    ],
    summary,
  };
}
