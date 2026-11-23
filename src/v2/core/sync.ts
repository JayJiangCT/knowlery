import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { renderConventions } from './conventions';
import { isMissing } from './paths';

const MAX_DIFF_LINES = 40;

export type SyncConventionsState = 'current' | 'outdated' | 'missing' | 'updated' | 'created';

export interface SyncResult {
  conventions: SyncConventionsState;
  removed: string[];
  added: string[];
  removed_more: number;
  added_more: number;
}

function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function diffLines(existing: string, desired: string): { removed: string[]; added: string[]; removedMore: number; addedMore: number } {
  const existingLines = splitLines(existing);
  const desiredLines = splitLines(desired);

  const desiredCounts = new Map<string, number>();
  for (const line of desiredLines) {
    desiredCounts.set(line, (desiredCounts.get(line) ?? 0) + 1);
  }
  const existingCounts = new Map<string, number>();
  for (const line of existingLines) {
    existingCounts.set(line, (existingCounts.get(line) ?? 0) + 1);
  }

  const allRemoved: string[] = [];
  const remDesired = new Map(desiredCounts);
  for (const line of existingLines) {
    const count = remDesired.get(line) ?? 0;
    if (count > 0) {
      remDesired.set(line, count - 1);
    } else {
      allRemoved.push(line);
    }
  }

  const allAdded: string[] = [];
  const remExisting = new Map(existingCounts);
  for (const line of desiredLines) {
    const count = remExisting.get(line) ?? 0;
    if (count > 0) {
      remExisting.set(line, count - 1);
    } else {
      allAdded.push(line);
    }
  }

  const removed = allRemoved.slice(0, MAX_DIFF_LINES);
  const added = allAdded.slice(0, MAX_DIFF_LINES);
  return {
    removed,
    added,
    removedMore: Math.max(0, allRemoved.length - removed.length),
    addedMore: Math.max(0, allAdded.length - added.length),
  };
}

async function writeAtomic(wikiDir: string, targetPath: string, content: string): Promise<void> {
  await mkdir(wikiDir, { recursive: true });
  const tempPath = join(wikiDir, `.CONVENTIONS-${randomUUID()}.tmp`);
  try {
    await writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx' });
    await rename(tempPath, targetPath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

export async function syncKb(root: string, options: { apply?: boolean } = {}): Promise<SyncResult> {
  const apply = options.apply ?? false;
  const wikiDir = join(root, 'wiki');
  const conventionsPath = join(wikiDir, 'CONVENTIONS.md');
  const desired = renderConventions();

  let existing: string | undefined;
  try {
    existing = await readFile(conventionsPath, 'utf8');
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  if (existing === undefined) {
    if (apply) {
      await writeAtomic(wikiDir, conventionsPath, desired);
      return { conventions: 'created', removed: [], added: [], removed_more: 0, added_more: 0 };
    }
    return { conventions: 'missing', removed: [], added: [], removed_more: 0, added_more: 0 };
  }

  if (existing === desired) {
    return { conventions: 'current', removed: [], added: [], removed_more: 0, added_more: 0 };
  }

  if (apply) {
    await writeAtomic(wikiDir, conventionsPath, desired);
    return { conventions: 'updated', removed: [], added: [], removed_more: 0, added_more: 0 };
  }

  const { removed, added, removedMore, addedMore } = diffLines(existing, desired);
  return {
    conventions: 'outdated',
    removed,
    added,
    removed_more: removedMore,
    added_more: addedMore,
  };
}
