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
  indexBaseExists: boolean;
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
  activityLoggingEnabled: boolean;
}

export type InstallItemId = 'platform-cli' | 'claudian' | 'skills-tooling';

export type InstallDetectionStatus =
  | 'checking'
  | 'installed'
  | 'not-installed'
  | 'missing-dependency'
  | 'error';

export type InstallRunStatus =
  | 'not-selected'
  | 'queued'
  | 'running'
  | 'verifying'
  | 'done'
  | 'failed'
  | 'skipped';

export interface InstallDetectionResult {
  id: InstallItemId;
  label: string;
  description: string;
  status: InstallDetectionStatus;
  detail?: string;
  recommended?: boolean;
  selectedByDefault?: boolean;
  requiresNode?: boolean;
  installedVersion?: string;
}

export interface InstallExecutionState {
  id: InstallItemId;
  status: InstallRunStatus;
  detail?: string;
}

export interface OptionalInstallSelection {
  platformCli: boolean;
  claudian: boolean;
  skillsTooling: boolean;
}

export interface SetupEnvironmentSummary {
  detections: InstallDetectionResult[];
  runs: InstallExecutionState[];
}

export const DEFAULT_SETTINGS: KnowlerySettings = {
  kbName: 'My Knowledge Base',
  platform: 'claude-code',
  nodePath: '',
  onboardingDismissed: false,
  activityLoggingEnabled: true,
};

export const DEFAULT_OPTIONAL_INSTALL_SELECTION: OptionalInstallSelection = {
  platformCli: false,
  claudian: true,
  skillsTooling: false,
};

export const KNOWLEDGE_DIRS = ['entities', 'concepts', 'comparisons', 'queries'] as const;

export const BUILTIN_SKILL_NAMES = [
  'cook', 'ask', 'explore', 'challenge', 'ideas', 'audit', 'organize',
  'obsidian-cli', 'obsidian-markdown', 'obsidian-bases',
  'json-canvas', 'defuddle', 'vault-conventions',
] as const;

export const ActivityDimensionSchema = z.enum([
  'research',
  'creation',
  'building',
  'strategy',
  'reflection',
  'maintenance',
]);
export type ActivityDimension = z.infer<typeof ActivityDimensionSchema>;

export const ActivityRecordSchema = z.object({
  time: z.string(),
  agent: z.string().min(1),
  type: z.enum(['discussion', 'implementation', 'research', 'reflection', 'maintenance']),
  topics: z.array(z.string()).default([]),
  summary: z.string().min(1),
  dimensions: z.array(ActivityDimensionSchema).default([]),
  questions: z.array(z.string()).default([]),
  learned: z.array(z.string()).default([]),
  thinking: z.array(z.string()).default([]),
  followups: z.array(z.string()).default([]),
  relatedFiles: z.array(z.string()).default([]),
  captureState: z.enum(['unbaked', 'baked', 'ignored']).default('unbaked'),
  source: z.object({
    kind: z.enum(['agent-session', 'manual-reflection', 'imported']),
    visibility: z.enum(['private-summary']),
  }),
});
export type ActivityRecord = z.infer<typeof ActivityRecordSchema>;

export interface ActivityParseError {
  path: string;
  line: number;
  message: string;
}

export interface ActivityThemeSummary {
  name: string;
  count: number;
  lastSeen: string;
  records: number;
}

export interface CounterSummary {
  recurringThemes: ActivityThemeSummary[];
  recentAgentWork: ActivityRecord[];
  unbakedNotes: ActivityRecord[];
  tasteProfile: Record<ActivityDimension, number>;
  coverage: {
    recordsLogged: number;
    malformedRecords: number;
  };
}

export type DashboardTab = 'counter' | 'skills' | 'config' | 'health';

export interface DashboardRefreshPayload {
  tab: DashboardTab;
  requestId: number;
}
