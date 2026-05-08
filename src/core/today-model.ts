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
      request: buildFirstCookRequest(),
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

function buildFirstCookRequest(): string {
  return [
    'Run a first knowledge base maintenance pass on this vault:',
    '',
    '1. Pick a handful of existing notes that have the most potential for reuse.',
    '2. Extract key concepts, related entities, and structural gaps.',
    '3. Suggest how to turn them into a more reusable knowledge structure (entities, concepts, comparisons, or queries).',
    '4. Summarize your findings in the chat, with concrete recommendations.',
    '',
    'Do not create new vault notes unless I explicitly ask for a persistent report or knowledge pages.',
    'The private Activity Ledger receipt is allowed if that vault rule is enabled; it is not a report or knowledge page.',
  ].join('\n');
}

function buildReturningModel(summary: CounterSummary): TodayModel {
  const thread = summary.knowledgeThreads[0];
  if (!thread) {
    const latestSystemActivity = summary.recentAgentWork.find(isSystemActivityRecord);
    if (latestSystemActivity) {
      return buildSystemActivityModel(summary, latestSystemActivity);
    }
  }

  const firstTheme = summary.recurringThemes[0]?.name;
  const secondTheme = summary.recurringThemes[1]?.name;
  const topicPhrase = firstTheme && secondTheme
    ? `「${firstTheme}」 and 「${secondTheme}」`
    : firstTheme
      ? `「${firstTheme}」`
      : 'recent knowledge work';
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

function buildSystemActivityModel(summary: CounterSummary, record: ActivityRecord): TodayModel {
  const followup = record.followups[0];
  return {
    stage: 'returning',
    title: record.type === 'maintenance'
      ? 'Latest maintenance pass completed.'
      : 'Latest agent output is ready for review.',
    body: followup
      ? `${record.summary} ${followup}`
      : `${record.summary} Review it before turning any findings into knowledge pages.`,
    primaryAction: {
      label: 'Open review menu',
      kind: 'local',
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

function isSystemActivityRecord(record: ActivityRecord): boolean {
  if (record.source.surface === 'system') return true;
  if (record.type === 'maintenance') return true;
  return false;
}
