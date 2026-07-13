import type { ActivityRecord, CounterSummary, VaultStats } from '../types';
import { buildCounterSummary } from './activity-model';
import { t, type TranslationKey } from '../i18n';

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
      title: t('today.empty.title'),
      body: t('today.empty.body'),
      primaryAction: { label: t('today.empty.primary'), kind: 'local' },
      secondaryActions: [
        { label: t('today.empty.addReflection'), kind: 'local' },
        { label: t('today.empty.importSource'), kind: 'agent-request' },
      ],
      stats: [
        { label: t('today.stat.knowledgeNotes'), value: String(knowledgeNotes) },
        { label: t('today.stat.activityRecords'), value: '0' },
      ],
      summary,
    };
  }

  return {
    stage: 'first-maintenance',
    title: t('today.first.title'),
    body: t('today.first.body'),
    primaryAction: {
      label: t('today.first.primary'),
      kind: 'agent-request',
      request: buildFirstCookRequest(),
    },
    secondaryActions: [
      { label: t('today.first.scanHealth'), kind: 'local' },
      { label: t('today.first.openMoves'), kind: 'local' },
    ],
    stats: [
      { label: t('today.stat.markdownNotes'), value: String(stats.notesCount) },
      { label: t('today.stat.knowledgeNotes'), value: String(knowledgeNotes) },
      { label: t('today.stat.wikilinks'), value: String(stats.wikilinksCount) },
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
    ? t('today.returning.topicsTwo', { first: firstTheme, second: secondTheme })
    : firstTheme
      ? t('today.returning.topicsOne', { topic: firstTheme })
      : t('today.returning.fallbackTopic');
  return {
    stage: 'returning',
    title: t('today.returning.title', { topics: topicPhrase }),
    body: thread
      ? t('today.returning.threadBody', { reason: thread.nextMoveReason, move: localizedMove(thread.nextMove) })
      : t('today.returning.fallbackBody'),
    primaryAction: {
      label: thread ? t('today.returning.primaryThread') : t('today.returning.primaryReview'),
      kind: 'agent-request',
      request: thread?.suggestedRequest,
    },
    secondaryActions: [
      { label: t('today.returning.generateSummary'), kind: 'report' },
      { label: t('today.returning.openReviewMenu'), kind: 'local' },
    ],
    stats: [
      { label: t('today.stat.activityRecords'), value: String(summary.coverage.recordsLogged) },
      { label: t('today.stat.activeThreads'), value: String(summary.knowledgeThreads.length) },
      { label: t('today.stat.unprocessedNotes'), value: String(summary.unbakedNotes.length) },
    ],
    summary,
  };
}

/** The thread-stage verb, rendered in the current UI language ('connect this
 * thread' / '连接这条线索'). Stage values themselves stay English — they are
 * logic values, not copy. */
function localizedMove(stage: string): string {
  const key = `today.move.${stage.toLowerCase()}` as TranslationKey;
  return t(key);
}

function buildSystemActivityModel(summary: CounterSummary, record: ActivityRecord): TodayModel {
  const followup = record.followups[0];
  return {
    stage: 'returning',
    title: record.type === 'maintenance'
      ? t('today.system.maintenanceTitle')
      : t('today.system.outputTitle'),
    body: followup
      ? `${record.summary} ${followup}`
      : `${record.summary} ${t('today.system.reviewSuffix')}`,
    primaryAction: {
      label: t('today.returning.openReviewMenu'),
      kind: 'local',
    },
    secondaryActions: [
      { label: t('today.returning.generateSummary'), kind: 'report' },
      { label: t('today.returning.openReviewMenu'), kind: 'local' },
    ],
    stats: [
      { label: t('today.stat.activityRecords'), value: String(summary.coverage.recordsLogged) },
      { label: t('today.stat.activeThreads'), value: String(summary.knowledgeThreads.length) },
      { label: t('today.stat.unprocessedNotes'), value: String(summary.unbakedNotes.length) },
    ],
    summary,
  };
}

function isSystemActivityRecord(record: ActivityRecord): boolean {
  if (record.source.surface === 'system') return true;
  if (record.type === 'maintenance') return true;
  return false;
}
