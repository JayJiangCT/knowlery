import { App, normalizePath } from 'obsidian';
import type { ActivityParseError, ActivityRecord } from '../types';
import { ensureDir } from './vault-io';
import { parseActivityJsonl } from './activity-model';

export const ACTIVITY_DIR = '.knowlery/activity';
export const ACTIVITY_DISABLED_PATH = '.knowlery/activity-disabled';

export interface ActivityLedgerReadResult {
  records: ActivityRecord[];
  errors: ActivityParseError[];
}

export async function isActivityLoggingEnabled(app: App): Promise<boolean> {
  return !(await app.vault.adapter.exists(normalizePath(ACTIVITY_DISABLED_PATH)));
}

export async function setActivityLoggingEnabled(app: App, enabled: boolean): Promise<void> {
  const markerPath = normalizePath(ACTIVITY_DISABLED_PATH);
  if (enabled) {
    if (await app.vault.adapter.exists(markerPath)) {
      await app.vault.adapter.remove(markerPath);
    }
    return;
  }

  await ensureDir(app, '.knowlery');
  await app.vault.adapter.write(markerPath, 'Activity logging disabled by Knowlery settings.\n');
}

export async function appendActivityRecord(app: App, record: ActivityRecord): Promise<void> {
  if (!(await isActivityLoggingEnabled(app))) return;

  await ensureDir(app, ACTIVITY_DIR);
  const date = record.time.slice(0, 10);
  const path = normalizePath(`${ACTIVITY_DIR}/${date}.jsonl`);
  const existing = await app.vault.adapter.exists(path)
    ? await app.vault.adapter.read(path)
    : '';
  const next = `${existing}${existing.endsWith('\n') || existing.length === 0 ? '' : '\n'}${JSON.stringify(record)}\n`;
  await app.vault.adapter.write(path, next);
}

export async function readRecentActivityRecords(
  app: App,
  days = 14,
  now = new Date(),
): Promise<ActivityLedgerReadResult> {
  const adapter = app.vault.adapter;
  const dir = normalizePath(ACTIVITY_DIR);
  if (!(await adapter.exists(dir))) return { records: [], errors: [] };

  const wanted = new Set<string>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    wanted.add(`${date.toISOString().slice(0, 10)}.jsonl`);
  }

  const listing = await adapter.list(dir);
  const records: ActivityRecord[] = [];
  const errors: ActivityParseError[] = [];

  for (const filePath of listing.files) {
    const filename = filePath.split('/').pop();
    if (!filename || !wanted.has(filename)) continue;

    const content = await adapter.read(normalizePath(filePath));
    const parsed = parseActivityJsonl(content, filePath);
    records.push(...parsed.records);
    errors.push(...parsed.errors);
  }

  records.sort((a, b) => b.time.localeCompare(a.time));
  return { records, errors };
}
