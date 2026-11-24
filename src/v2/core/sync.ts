import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SKILLS } from '../skills';
import { renderConventions } from './conventions';
import { AGENTS_LINES, BETA1_AGENTS_LINES, hasAllAgentsLines, resolveSkillsDir } from './init';
import { isMissing, WIKI_DIR } from './paths';

const MAX_DIFF_LINES = 40;

export type SyncFileState = 'current' | 'outdated' | 'missing' | 'updated' | 'created';
export type SyncConventionsState = SyncFileState;
export type SyncAgentsState = SyncFileState | 'incomplete';

export interface SyncSkillEntry {
  name: string;
  path: string;
  state: SyncFileState;
  removed?: string[];
  added?: string[];
  removed_more?: number;
  added_more?: number;
}

export interface SyncAgentsEntry {
  state: SyncAgentsState;
  removed: string[];
  added: string[];
  removed_more: number;
  added_more: number;
}

export interface SyncResult {
  conventions: SyncConventionsState;
  removed: string[];
  added: string[];
  removed_more: number;
  added_more: number;
  agents: SyncAgentsEntry;
  skills: SyncSkillEntry[];
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

async function writeAtomic(targetPath: string, content: string): Promise<void> {
  const dir = dirname(targetPath);
  await mkdir(dir, { recursive: true });
  const tempPath = join(dir, `.sync-${randomUUID()}.tmp`);
  try {
    await writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx' });
    await rename(tempPath, targetPath);
  } finally {
    await rm(tempPath, { force: true }).catch(() => {});
  }
}

async function syncFile(
  targetPath: string,
  desired: string,
  apply: boolean,
): Promise<{ state: SyncFileState; removed: string[]; added: string[]; removed_more: number; added_more: number }> {
  let existing: string | undefined;
  try {
    existing = await readFile(targetPath, 'utf8');
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  if (existing === undefined) {
    if (apply) {
      await writeAtomic(targetPath, desired);
      return { state: 'created', removed: [], added: [], removed_more: 0, added_more: 0 };
    }
    return { state: 'missing', removed: [], added: [], removed_more: 0, added_more: 0 };
  }

  if (existing === desired) {
    return { state: 'current', removed: [], added: [], removed_more: 0, added_more: 0 };
  }

  if (apply) {
    await writeAtomic(targetPath, desired);
    return { state: 'updated', removed: [], added: [], removed_more: 0, added_more: 0 };
  }

  const { removed, added, removedMore, addedMore } = diffLines(existing, desired);
  return {
    state: 'outdated',
    removed,
    added,
    removed_more: removedMore,
    added_more: addedMore,
  };
}

async function syncAgents(root: string, apply: boolean): Promise<SyncAgentsEntry> {
  const agentsPath = join(root, 'AGENTS.md');
  const desired = `${AGENTS_LINES.join('\n')}\n`;
  const beta1Exact = `${BETA1_AGENTS_LINES.join('\n')}\n`;

  let existing: string | undefined;
  try {
    existing = await readFile(agentsPath, 'utf8');
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  if (existing === undefined) {
    if (apply) {
      await writeAtomic(agentsPath, desired);
      return { state: 'created', removed: [], added: [], removed_more: 0, added_more: 0 };
    }
    return { state: 'missing', removed: [], added: [], removed_more: 0, added_more: 0 };
  }

  if (existing === beta1Exact) {
    if (apply) {
      await writeAtomic(agentsPath, desired);
      return { state: 'updated', removed: [], added: [], removed_more: 0, added_more: 0 };
    }
    const { removed, added, removedMore, addedMore } = diffLines(existing, desired);
    return {
      state: 'outdated',
      removed,
      added,
      removed_more: removedMore,
      added_more: addedMore,
    };
  }

  if (hasAllAgentsLines(existing)) {
    return { state: 'current', removed: [], added: [], removed_more: 0, added_more: 0 };
  }

  return { state: 'incomplete', removed: [], added: [], removed_more: 0, added_more: 0 };
}

export async function syncKb(root: string, options: { apply?: boolean; skillsDir?: string } = {}): Promise<SyncResult> {
  const apply = options.apply ?? false;
  const skillsTarget = await resolveSkillsDir(root, options.skillsDir);

  const conventionsPath = join(root, WIKI_DIR, 'CONVENTIONS.md');
  const conv = await syncFile(conventionsPath, renderConventions(), apply);
  const agents = await syncAgents(root, apply);

  const skills: SyncSkillEntry[] = [];
  for (const skill of SKILLS) {
    const relPath = `${skillsTarget.rel}/${skill.name}/SKILL.md`;
    const skillPath = join(skillsTarget.abs, skill.name, 'SKILL.md');
    const synced = await syncFile(skillPath, skill.text, apply);
    const entry: SyncSkillEntry = {
      name: skill.name,
      path: relPath,
      state: synced.state,
    };
    if (synced.state === 'outdated') {
      entry.removed = synced.removed;
      entry.added = synced.added;
      entry.removed_more = synced.removed_more;
      entry.added_more = synced.added_more;
    }
    skills.push(entry);
  }

  return {
    conventions: conv.state,
    removed: conv.removed,
    added: conv.added,
    removed_more: conv.removed_more,
    added_more: conv.added_more,
    agents,
    skills,
  };
}
