import type {
  ActivityDimension,
  ActivityParseError,
  ActivityRecord,
  ActivityThemeSummary,
  CounterSummary,
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

  content.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed);
      const result = ActivityRecordSchema.safeParse(parsed);
      if (result.success) {
        records.push(result.data);
      } else {
        errors.push({
          path,
          line: index + 1,
          message: result.error.issues[0]?.message ?? 'Invalid activity record',
        });
      }
    } catch (error) {
      errors.push({
        path,
        line: index + 1,
        message: error instanceof Error ? error.message : 'Could not parse JSON',
      });
    }
  });

  return { records, errors };
}

export function buildCounterSummary(
  records: ActivityRecord[],
  malformedRecords = 0,
): CounterSummary {
  const sorted = [...records].sort((a, b) => b.time.localeCompare(a.time));
  const themeMap = new Map<string, ActivityThemeSummary>();
  const tasteProfile = Object.fromEntries(
    DIMENSIONS.map((dimension) => [dimension, 0]),
  ) as Record<ActivityDimension, number>;

  for (const record of sorted) {
    for (const dimension of record.dimensions) {
      tasteProfile[dimension] += 1;
    }

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
    recurringThemes: [...themeMap.values()]
      .sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))
      .slice(0, 8),
    recentAgentWork: sorted.slice(0, 6),
    unbakedNotes: sorted.filter((record) => record.captureState === 'unbaked').slice(0, 5),
    tasteProfile,
    coverage: {
      recordsLogged: records.length,
      malformedRecords,
    },
  };
}

function normalizeTopic(topic: string): string {
  return topic.trim().toLowerCase();
}
