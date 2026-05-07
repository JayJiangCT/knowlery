import type {
  ActivityDimension,
  ActivityParseError,
  ActivityRecord,
  ActivityThemeSummary,
  CounterSummary,
  KnowledgeThreadStage,
  KnowledgeThreadSummary,
} from '../types';
import { ActivityRecordSchema } from '../types';

const DIMENSIONS: ActivityDimension[] = [
  'research',
  'creation',
  'building',
  'strategy',
  'reflection',
  'maintenance',
];

export function parseActivityJsonl(
  content: string,
  path: string,
): { records: ActivityRecord[]; errors: ActivityParseError[] } {
  const records: ActivityRecord[] = [];
  const errors: ActivityParseError[] = [];
  let buffer = '';
  let bufferStartLine = 0;

  content.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed && !buffer) return;

    if (buffer) {
      buffer += `\n${line}`;
      if (tryReadActivityRecord(buffer, path, bufferStartLine, records, errors)) {
        buffer = '';
      }
      return;
    }

    if (tryReadActivityRecord(trimmed, path, index + 1, records, errors)) {
      return;
    }

    if (trimmed.startsWith('{')) {
      buffer = line;
      bufferStartLine = index + 1;
      return;
    }

    pushJsonParseError(trimmed, path, index + 1, errors);
  });

  if (buffer) {
    pushJsonParseError(buffer, path, bufferStartLine, errors);
  }

  return { records, errors };
}

function tryReadActivityRecord(
  candidate: string,
  path: string,
  line: number,
  records: ActivityRecord[],
  errors: ActivityParseError[],
): boolean {
  try {
    const parsed = JSON.parse(candidate);
    const result = ActivityRecordSchema.safeParse(parsed);
    if (result.success) {
      records.push(result.data);
    } else {
      errors.push({
        path,
        line,
        message: result.error.issues[0]?.message ?? 'Invalid activity record',
      });
    }
    return true;
  } catch {
    return false;
  }
}

function pushJsonParseError(
  candidate: string,
  path: string,
  line: number,
  errors: ActivityParseError[],
): void {
  try {
    JSON.parse(candidate);
  } catch (error) {
    errors.push({
      path,
      line,
      message: error instanceof Error ? error.message : 'Could not parse JSON',
    });
  }
}

export function buildCounterSummary(
  records: ActivityRecord[],
  malformedRecords = 0,
): CounterSummary {
  const sorted = [...records].sort((a, b) => b.time.localeCompare(a.time));
  const knowledgeRecords = sorted.filter(isKnowledgeActivityRecord);
  const themeMap = new Map<string, ActivityThemeSummary>();
  const tasteProfile = Object.fromEntries(
    DIMENSIONS.map((dimension) => [dimension, 0]),
  ) as Record<ActivityDimension, number>;

  for (const record of sorted) {
    for (const dimension of record.dimensions) {
      tasteProfile[dimension] += 1;
    }
  }

  for (const record of knowledgeRecords) {
    for (const topic of record.topics) {
      const key = normalizeTopic(topic);
      if (!key) continue;

      const existing = themeMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.records += 1;
        if (record.time > existing.lastSeen) existing.lastSeen = record.time;
      } else {
        themeMap.set(key, {
          name: topic.trim(),
          count: 1,
          records: 1,
          lastSeen: record.time,
        });
      }
    }
  }

  return {
    knowledgeThreads: buildKnowledgeThreads(knowledgeRecords),
    recurringThemes: [...themeMap.values()]
      .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))
      .slice(0, 8),
    recentAgentWork: sorted.slice(0, 6),
    unbakedNotes: knowledgeRecords.filter((record) => record.captureState === 'unbaked').slice(0, 5),
    tasteProfile,
    coverage: {
      recordsLogged: records.length,
      malformedRecords,
    },
  };
}

function isKnowledgeActivityRecord(record: ActivityRecord): boolean {
  if (record.source.surface === 'system') return false;
  if (record.type === 'maintenance') return false;
  return !record.dimensions.includes('maintenance');
}

function buildKnowledgeThreads(records: ActivityRecord[]): KnowledgeThreadSummary[] {
  const groups: Array<{ id: string; keys: Set<string>; records: ActivityRecord[] }> = [];
  for (const record of records) {
    const keys = unique(record.topics.map(normalizeTopic));
    if (keys.length === 0) {
      const fallbackKey = normalizeTopic(record.summary);
      if (fallbackKey) keys.push(fallbackKey);
    }
    if (keys.length === 0) continue;

    const matchingGroups = groups.filter((group) => keys.some((key) => group.keys.has(key)));
    if (matchingGroups.length === 0) {
      groups.push({ id: keys[0], keys: new Set(keys), records: [record] });
      continue;
    }

    const [target, ...rest] = matchingGroups;
    target.records.push(record);
    keys.forEach((key) => target.keys.add(key));

    for (const group of rest) {
      group.records.forEach((groupRecord) => target.records.push(groupRecord));
      group.keys.forEach((key) => target.keys.add(key));
      groups.splice(groups.indexOf(group), 1);
    }
  }

  return groups
    .map(({ id, records: threadRecords }) => {
      const sorted = [...threadRecords].sort((a, b) => b.time.localeCompare(a.time));
      const title = chooseThreadTitle(sorted);
      const stage = inferStage(sorted);
      const nextMove = inferNextMove(stage, sorted);
      const topics = unique(sorted.flatMap((record) => record.topics)).slice(0, 6);
      const relatedFiles = unique(sorted.flatMap((record) => record.relatedFiles)).slice(0, 6);

      return {
        id,
        title,
        summary: summarizeThread(title, sorted, stage),
        stage,
        nextMove,
        nextMoveReason: explainNextMove(stage, nextMove),
        suggestedRequest: buildSuggestedRequest(title, nextMove),
        recordsCount: sorted.length,
        relatedFiles,
        topics,
        lastSeen: sorted[0].time,
      };
    })
    .sort((a, b) => b.recordsCount - a.recordsCount || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, 5);
}

function chooseThreadTitle(records: ActivityRecord[]): string {
  const topicCounts = new Map<string, { title: string; count: number; lastSeen: string }>();
  for (const record of records) {
    for (const topic of record.topics) {
      const key = normalizeTopic(topic);
      if (!key) continue;
      const existing = topicCounts.get(key);
      if (existing) {
        existing.count += 1;
        if (record.time > existing.lastSeen) existing.lastSeen = record.time;
      } else {
        topicCounts.set(key, { title: topic.trim(), count: 1, lastSeen: record.time });
      }
    }
  }

  return [...topicCounts.values()]
    .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))[0]?.title
    ?? records[0]?.summary
    ?? 'Untitled thread';
}

function inferStage(records: ActivityRecord[]): KnowledgeThreadStage {
  const dimensions = records.flatMap((record) => record.dimensions);
  if (records.some((record) => record.captureState === 'unbaked') || dimensions.includes('creation')) {
    return 'Capture';
  }
  if (dimensions.includes('maintenance')) return 'Clean';
  if (dimensions.includes('strategy') || dimensions.includes('reflection')) return 'Reflect';
  if (dimensions.includes('building')) return 'Create';
  if (dimensions.includes('research')) return 'Connect';
  return 'Capture';
}

function inferNextMove(stage: KnowledgeThreadStage, records: ActivityRecord[]): KnowledgeThreadStage {
  if (stage === 'Capture') return 'Connect';
  if (stage === 'Reflect') return 'Question';
  if (stage === 'Connect') return 'Question';
  if (stage === 'Question') return records.some((record) => record.relatedFiles.length > 0) ? 'Create' : 'Capture';
  if (stage === 'Clean') return 'Connect';
  return 'Question';
}

function explainNextMove(stage: KnowledgeThreadStage, nextMove: KnowledgeThreadStage): string {
  if (stage === 'Capture' && nextMove === 'Connect') {
    return 'This thread has useful material, but it will become more reusable once it is linked to older notes and patterns.';
  }
  if (nextMove === 'Question') {
    return 'This thread has enough reflection to start checking assumptions, evidence, and gaps.';
  }
  if (nextMove === 'Create') {
    return 'This thread has enough structure to turn into an output, template, or decision artifact.';
  }
  return 'This thread has recent activity and can benefit from one focused follow-up move.';
}

function buildSuggestedRequest(title: string, nextMove: KnowledgeThreadStage): string {
  if (nextMove === 'Connect') {
    return `Review my recent notes about "${title}". Find connections to older notes, reusable patterns, and parts worth turning into templates.`;
  }
  if (nextMove === 'Question') {
    return `Check my recent discussions about "${title}". Which conclusions lack evidence? Which assumptions should be challenged? What might be outdated?`;
  }
  if (nextMove === 'Clean') {
    return `Check notes related to "${title}" for broken links, duplicates, missing frontmatter, or structural drift, and suggest how to clean them up.`;
  }
  if (nextMove === 'Create') {
    return `Based on my recent knowledge about "${title}", generate a reusable output: an outline, template, plan, or next-step action list.`;
  }
  return `Help me distill recent material about "${title}" into the knowledge base - extract key concepts, related entities, and update the index.`;
}

function summarizeThread(
  title: string,
  records: ActivityRecord[],
  stage: KnowledgeThreadStage,
): string {
  const sourceLabel = records.length === 1 ? '1 activity receipt' : `${records.length} activity receipts`;
  return `${title} is currently in ${stage}. It is based on ${sourceLabel}, with ${unique(records.flatMap((record) => record.relatedFiles)).length} related file(s).`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase();
}
