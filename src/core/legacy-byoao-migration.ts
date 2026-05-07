import type { App } from 'obsidian';
import type { SkillsLock } from '../types';

export interface LegacySignalInput {
  byoaoManifestExists: boolean;
  opencodeSkillsExists: boolean;
  agentsMdContent: string | null;
  existingKnowledgeDirs: string[];
}

export interface LegacySignalResult {
  isLegacyByoao: boolean;
  signals: string[];
}

export interface SkillMergeInput {
  existingAgentsSkills: string[];
  existingOpenCodeSkills: string[];
  bundledSkillNames: string[];
}

export interface SkillConflict {
  name: string;
  kept: '.agents/skills';
  skipped: '.opencode/skills';
}

export interface SkillMergePlan {
  preserveAgents: string[];
  importFromOpenCode: string[];
  installBundled: string[];
  conflicts: SkillConflict[];
  finalSkillNames: string[];
}

export function classifyByoaoLegacySignals(input: LegacySignalInput): LegacySignalResult {
  const signals: string[] = [];
  if (input.byoaoManifestExists) signals.push('.byoao/manifest.json');
  if (input.opencodeSkillsExists) signals.push('.opencode/skills/');
  if (input.agentsMdContent && /\bBYOAO\b/i.test(input.agentsMdContent)) {
    signals.push('AGENTS.md mentions BYOAO');
  }
  if (input.existingKnowledgeDirs.length > 0) {
    signals.push('knowledge directories exist');
  }

  return {
    isLegacyByoao: signals.length > 0,
    signals,
  };
}

export function buildSkillMergePlan(input: SkillMergeInput): SkillMergePlan {
  const agents = sortedUnique(input.existingAgentsSkills);
  const opencode = sortedUnique(input.existingOpenCodeSkills);
  const bundled = sortedUnique(input.bundledSkillNames);
  const finalSkillNames: string[] = [...agents];
  const importFromOpenCode: string[] = [];
  const conflicts: SkillConflict[] = [];

  for (const name of opencode) {
    if (agents.includes(name)) {
      conflicts.push({ name, kept: '.agents/skills', skipped: '.opencode/skills' });
      continue;
    }
    importFromOpenCode.push(name);
    finalSkillNames.push(name);
  }

  const installBundled = bundled.filter((name) => !finalSkillNames.includes(name));
  finalSkillNames.push(...installBundled);

  return {
    preserveAgents: agents,
    importFromOpenCode,
    installBundled,
    conflicts,
    finalSkillNames,
  };
}

export function normalizeLegacySkillsLock(options: {
  existingLock: unknown;
  finalSkillNames: string[];
  bundledSkillNames: string[];
}): SkillsLock {
  const bundled = new Set(options.bundledSkillNames);
  const legacySkills = readLegacyLockSkills(options.existingLock);
  const skills: SkillsLock['skills'] = {};

  for (const name of options.finalSkillNames) {
    const legacyEntry = legacySkills[name];
    if (bundled.has(name)) {
      skills[name] = { source: 'builtin', version: '1.0.0', disabled: false };
    } else if (legacyEntry?.sourceType === 'github' && typeof legacyEntry.source === 'string') {
      skills[name] = {
        source: 'registry',
        version: '1.0.0',
        disabled: false,
        registryIdentifier: legacyEntry.source,
      };
    } else {
      skills[name] = { source: 'custom', version: '1.0.0', disabled: false };
    }
  }

  return { version: '1.0.0', skills };
}

function readLegacyLockSkills(lock: unknown): Record<string, { source?: unknown; sourceType?: unknown }> {
  if (!lock || typeof lock !== 'object') return {};
  const skills = (lock as { skills?: unknown }).skills;
  if (!skills || typeof skills !== 'object') return {};
  return skills as Record<string, { source?: unknown; sourceType?: unknown }>;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function normalizeLegacyPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export async function detectByoaoLegacyVault(app: App): Promise<LegacySignalResult> {
  const adapter = app.vault.adapter;
  const agentsMdPath = normalizeLegacyPath('AGENTS.md');
  const agentsMdContent = await adapter.exists(agentsMdPath)
    ? await adapter.read(agentsMdPath)
    : null;

  const existingKnowledgeDirs: string[] = [];
  for (const dir of ['entities', 'concepts', 'comparisons', 'queries']) {
    if (await adapter.exists(normalizeLegacyPath(dir))) existingKnowledgeDirs.push(dir);
  }

  return classifyByoaoLegacySignals({
    byoaoManifestExists: await adapter.exists(normalizeLegacyPath('.byoao/manifest.json')),
    opencodeSkillsExists: await adapter.exists(normalizeLegacyPath('.opencode/skills')),
    agentsMdContent,
    existingKnowledgeDirs,
  });
}
