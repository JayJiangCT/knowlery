import { z } from 'zod';

export const PLUGIN_ID = 'knowlery';
export const VIEW_TYPE_DASHBOARD = 'knowlery-dashboard';

export type Platform = 'claude-code' | 'opencode';

export const ManifestSchema = z.object({
  version: z.string(),
  platform: z.enum(['claude-code', 'opencode']),
  kbName: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const SkillLockEntrySchema = z.object({
  source: z.enum(['builtin', 'registry', 'custom']),
  version: z.string(),
  disabled: z.boolean(),
  forkedFrom: z.string().optional(),
  registryIdentifier: z.string().optional(),
});
export type SkillLockEntry = z.infer<typeof SkillLockEntrySchema>;

export const SkillsLockSchema = z.object({
  version: z.string(),
  skills: z.record(z.string(), SkillLockEntrySchema),
});
export type SkillsLock = z.infer<typeof SkillsLockSchema>;

export type SkillKind = 'knowledge' | 'tooling';

export interface SkillParameter {
  flag: string;
  type: string;
  description: string;
}

export interface SkillDetail {
  whatItDoes?: string;
  bestFor?: string[];
  proTip?: string;
  example?: string;
  parameters?: SkillParameter[];
}

export interface SkillInfo {
  name: string;
  source: 'builtin' | 'registry' | 'custom';
  disabled: boolean;
  forkedFrom?: string;
  registryIdentifier?: string;
  description: string;
  emoji: string;
  content: string;
  kind: SkillKind;
  detail?: SkillDetail;
}

export interface RuleInfo {
  name: string;
  filename: string;
  content: string;
}

export interface VaultStats {
  notesCount: number;
  wikilinksCount: number;
  entitiesCount: number;
  conceptsCount: number;
  comparisonsCount: number;
  queriesCount: number;
}

export interface DiagnosisResult {
  orphanNotes: string[];
  brokenWikilinks: { file: string; link: string }[];
  missingFrontmatter: { file: string; missingFields: string[] }[];
}

export interface ConfigIntegrity {
  knowledgeMdExists: boolean;
  schemaMdExists: boolean;
  knowledgeDirsComplete: { exists: string[]; missing: string[] };
  agentConfigExists: boolean;
  rulesConfigured: boolean;
  skillsComplete: { present: string[]; missing: string[] };
  obsidianCli: boolean;
  claudeCodeCli: boolean;
  opencodeCli: boolean;
  platform: Platform;
}

export interface KnowlerySettings {
  kbName: string;
  platform: Platform;
  nodePath: string;
  onboardingDismissed: boolean;
}

export const DEFAULT_SETTINGS: KnowlerySettings = {
  kbName: 'My Knowledge Base',
  platform: 'claude-code',
  nodePath: '',
  onboardingDismissed: false,
};

export const KNOWLEDGE_DIRS = ['entities', 'concepts', 'comparisons', 'queries'] as const;

export const BUILTIN_SKILL_NAMES = [
  'cook', 'ask', 'explore', 'challenge', 'ideas', 'audit', 'organize',
  'obsidian-cli', 'obsidian-markdown', 'obsidian-bases',
  'json-canvas', 'defuddle', 'vault-conventions',
] as const;

export type DashboardTab = 'skills' | 'config' | 'health';

export interface DashboardRefreshPayload {
  tab: DashboardTab;
  requestId: number;
}
