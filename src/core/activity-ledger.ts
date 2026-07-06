import type { ActivityParseError, ActivityRecord } from '../types';
import type { VaultFs } from './vault-fs';
import { normalizeVaultPath } from './vault-fs';
import { parseActivityJsonl } from './activity-model';

export const ACTIVITY_DIR = '.knowlery/activity';
export const ACTIVITY_DISABLED_PATH = '.knowlery/activity-disabled';

export interface ActivityLedgerReadResult {
  records: ActivityRecord[];
  errors: ActivityParseError[];
}

export async function isActivityLoggingEnabled(fs: VaultFs): Promise<boolean> {
  return !(await fs.exists(normalizeVaultPath(ACTIVITY_DISABLED_PATH)));
}

export async function setActivityLoggingEnabled(fs: VaultFs, enabled: boolean): Promise<void> {
  const markerPath = normalizeVaultPath(ACTIVITY_DISABLED_PATH);
  if (enabled) {
    if (await fs.exists(markerPath)) {
      await fs.remove(markerPath);
    }
    return;
  }

  await fs.mkdir('.knowlery');
  await fs.write(markerPath, 'Activity logging disabled by Knowlery settings.\n');
}

export async function appendActivityRecord(fs: VaultFs, record: ActivityRecord): Promise<void> {
  if (!(await isActivityLoggingEnabled(fs))) return;

  await fs.mkdir(ACTIVITY_DIR);
  const date = record.time.slice(0, 10);
  const path = normalizeVaultPath(`${ACTIVITY_DIR}/${date}.jsonl`);
  const existing = await fs.exists(path)
    ? await fs.read(path)
    : '';
  const next = `${existing}${existing.endsWith('\n') || existing.length === 0 ? '' : '\n'}${JSON.stringify(record)}\n`;
  await fs.write(path, next);
}

export async function readRecentActivityRecords(
  fs: VaultFs,
  days = 14,
  now = new Date(),
): Promise<ActivityLedgerReadResult> {
  const dir = normalizeVaultPath(ACTIVITY_DIR);
  if (!(await fs.exists(dir))) return { records: [], errors: [] };

  const wanted = new Set<string>();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    wanted.add(`${date.toISOString().slice(0, 10)}.jsonl`);
  }

  const listing = await fs.list(dir);
  const records: ActivityRecord[] = [];
  const errors: ActivityParseError[] = [];

  for (const filePath of listing.files) {
    const filename = filePath.split('/').pop();
    if (!filename || !wanted.has(filename)) continue;

    const content = await fs.read(normalizeVaultPath(filePath));
    const parsed = parseActivityJsonl(content, filePath);
    records.push(...parsed.records);
    errors.push(...parsed.errors);
  }

  records.sort((a, b) => b.time.localeCompare(a.time));
  return { records, errors };
}
