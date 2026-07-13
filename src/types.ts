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
  /** Core version that last ran vault sync — the downgrade guard's record (spec 0.7 f5). */
  lastSyncedBy: z.string().optional(),
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
  queryScriptExists: boolean;
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
  /** Dashboard/settings display language; 'auto' follows Obsidian's language. */
  language: 'auto' | 'en' | 'zh';
  onboardingDismissed: boolean;
  activityLoggingEnabled: boolean;
  /** Register this vault in the global KB registry for CLI/agent access (spec 1.0 f1, §4.5). */
  registerVaultGlobally: boolean;
  /** The exact registry name this plugin created — the only name toggle-off may remove. */
  registryOwnedName: string | null;
  lastSyncedVersion: string;
  lastSeenReleaseVersion: string;
  bundleCreatorName: string;
  bundleCreatorUrl: string;
  bundleDefaultLicense: string;
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
  language: 'auto',
  onboardingDismissed: false,
  activityLoggingEnabled: true,
  registerVaultGlobally: true,
  registryOwnedName: null,
  lastSyncedVersion: '',
  lastSeenReleaseVersion: '',
  bundleCreatorName: '',
  bundleCreatorUrl: '',
  bundleDefaultLicense: 'personal',
};

export const DEFAULT_OPTIONAL_INSTALL_SELECTION: OptionalInstallSelection = {
  platformCli: false,
  claudian: true,
  skillsTooling: false,
};

export const KNOWLEDGE_DIRS = ['entities', 'concepts', 'comparisons', 'queries'] as const;
export type KnowledgeDir = typeof KNOWLEDGE_DIRS[number];

export const OkfFrontmatterSchema = z.object({
  type: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  timestamp: z.string().optional(),
}).passthrough();
export type OkfFrontmatter = z.infer<typeof OkfFrontmatterSchema>;

export const BundleManifestSchema = z.object({
  schemaVersion: z.literal(1),
  okfVersion: z.string(),
  id: z.string().min(1),
  title: z.string().min(1),
  version: z.string().min(1),
  creator: z.object({
    name: z.string(),
    url: z.string(),
  }),
  releasedAt: z.string(),
  entrypoint: z.string(),
  contentHash: z.string(),
  license: z.string(),
  knowleryVersion: z.string(),
  conceptCount: z.number().int().nonnegative(),
});
export type BundleManifest = z.infer<typeof BundleManifestSchema>;

export const UnresolvedLinkSchema = z.object({
  from: z.string(),
  raw: z.string(),
});
export type UnresolvedLink = z.infer<typeof UnresolvedLinkSchema>;

export const AgentIndexConceptSchema = z.object({
  id: z.string(),
  path: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string().optional(),
  domain: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.string().optional(),
  timestamp: z.string().optional(),
  daysSinceUpdate: z.number().nullable(),
  backlinks: z.array(z.string()),
  outlinks: z.array(z.string()),
  sources: z.array(z.string()).optional(),
  contradictions: z.array(z.string()).optional(),
});
export type AgentIndexConcept = z.infer<typeof AgentIndexConceptSchema>;

export const AgentIndexSchema = z.object({
  schemaVersion: z.literal(1),
  okfVersion: z.string(),
  generatedAt: z.string(),
  title: z.string(),
  entrypoint: z.string(),
  concepts: z.array(AgentIndexConceptSchema),
  groups: z.object({
    byType: z.record(z.array(z.string())),
    byDomain: z.record(z.array(z.string())),
  }),
  stale: z.array(z.string()),
  unresolvedLinks: z.array(UnresolvedLinkSchema),
  rawSources: z.array(z.object({
    path: z.string(),
    title: z.string(),
    citedBy: z.array(z.string()),
  })),
});
export type AgentIndex = z.infer<typeof AgentIndexSchema>;

export const ConformanceIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
  code: z.string(),
});
export type ConformanceIssue = z.infer<typeof ConformanceIssueSchema>;

export const FieldQualitySummarySchema = z.object({
  missingDescription: z.object({ count: z.number(), pages: z.array(z.string()) }),
  missingTimestamp: z.object({
    count: z.number(),
    pages: z.array(z.object({
      path: z.string(),
      nearMissKey: z.string().optional(),
    })),
  }),
  missingDomain: z.object({ count: z.number(), pages: z.array(z.string()) }),
  typeMismatch: z.object({ count: z.number(), pages: z.array(z.string()) }),
});
export type FieldQualitySummary = z.infer<typeof FieldQualitySummarySchema>;

export const ConformanceReportSchema = z.object({
  conformant: z.boolean(),
  errors: z.array(ConformanceIssueSchema),
  warnings: z.array(ConformanceIssueSchema),
  fieldQuality: FieldQualitySummarySchema,
});
export type ConformanceReport = z.infer<typeof ConformanceReportSchema>;

export const ReviewStatusSchema = z.enum(['unreviewed', 'approved', 'flagged']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const PublishConfigSchema = z.object({
  repo: z.string().min(1),
  visibility: z.enum(['private', 'public']),
});
export type PublishConfig = z.infer<typeof PublishConfigSchema>;

export const ExportScopeFileSchema = z.object({
  schemaVersion: z.literal(1),
  bundles: z.record(z.object({
    title: z.string().optional(),
    seeds: z.array(z.string()),
    maxCompiledHops: z.number().int().min(0).default(1),
    /** Version of the last export — publish re-uses it (spec 0.9 f2, §4.1 step 2). */
    lastVersion: z.string().optional(),
    /** Publish target, remembered per bundle (spec 0.9 f2, §4.2). */
    publish: PublishConfigSchema.optional(),
    items: z.record(z.object({
      status: ReviewStatusSchema,
      contentHashAtReview: z.string().nullable(),
    })),
  })),
});
export type ExportScopeFile = z.infer<typeof ExportScopeFileSchema>;

export const InstalledBundleEntrySchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  source: z.string(),
  installedAt: z.string(),
  libraryPath: z.string().min(1),
  manifestContentHash: z.string(),
  installedContentHash: z.string(),
  /**
   * Per-file hashes of the installed .md entries (spec 0.9 f3 §4.3.3 — lets the
   * local-modification check name exactly which files changed). Optional:
   * pre-0.9 installs lack it and fall back to the aggregate hash.
   */
  fileHashes: z.record(z.string()).optional(),
  conformance: z.enum(['passed', 'failed', 'skipped']),
  conformanceErrorCount: z.number().int().nonnegative(),
});
export type InstalledBundleEntry = z.infer<typeof InstalledBundleEntrySchema>;

export const InstalledBundlesFileSchema = z.object({
  schemaVersion: z.literal(1),
  bundles: z.record(InstalledBundleEntrySchema),
});
export type InstalledBundlesFile = z.infer<typeof InstalledBundlesFileSchema>;

export const RiskHintSchema = z.object({
  itemId: z.string(),
  kind: z.enum([
    'email', 'sensitive-url', 'person-page', 'meeting-like-path',
    // 0.9 f2 §4.4 — highest-cost-if-public patterns.
    'credential', 'private-ip', 'phone-number',
  ]),
  evidence: z.string(),
});
export type RiskHint = z.infer<typeof RiskHintSchema>;

export const CompileOptionsSchema = z.object({
  targetDir: z.string().min(1),
  bundleId: z.string().min(1),
  title: z.string().min(1),
  version: z.string().min(1),
  license: z.string().min(1),
  creator: z.object({
    name: z.string(),
    url: z.string(),
  }),
  staleThresholdDays: z.number().int().positive().optional(),
  includeSchema: z.boolean().default(true),
  includeFullLog: z.boolean().default(false),
  includeSources: z.boolean().default(false),
  approvedConceptIds: z.array(z.string()).default([]),
  approvedRawPaths: z.array(z.string()).default([]),
  overwrite: z.boolean().default(false),
});
export type CompileOptions = z.infer<typeof CompileOptionsSchema>;

export const CompileResultSchema = z.object({
  manifest: BundleManifestSchema,
  conformance: ConformanceReportSchema,
  conceptCount: z.number().int().nonnegative(),
  rawSourceCount: z.number().int().nonnegative(),
  wikilinksConverted: z.number().int().nonnegative(),
  unresolvedLinks: z.array(UnresolvedLinkSchema),
  staleCount: z.number().int().nonnegative(),
  targetDir: z.string(),
});
export type CompileResult = z.infer<typeof CompileResultSchema>;

export const KbRegistrySchema = z.object({
  schemaVersion: z.literal(1),
  kbs: z.record(z.object({
    path: z.string().min(1),
  })),
});
export type KbRegistry = z.infer<typeof KbRegistrySchema>;

export const BUILTIN_SKILL_NAMES = [
  'cook', 'ask', 'explore', 'challenge', 'ideas', 'audit', 'organize',
  'obsidian-cli', 'knowlery-cli', 'knowlery-mcp', 'obsidian-markdown', 'obsidian-bases',
  'json-canvas', 'defuddle', 'vault-conventions',
] as const;

export const ActivityDimensionSchema = z.enum([
  'analysis',
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
  type: z.enum(['discussion', 'implementation', 'analysis', 'research', 'creation', 'reflection', 'maintenance']),
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
    surface: z.enum(['knowledge', 'system']).default('knowledge'),
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

export type KnowledgeThreadStage = 'Capture' | 'Connect' | 'Question' | 'Clean' | 'Create' | 'Reflect';

export interface KnowledgeThreadSummary {
  id: string;
  title: string;
  summary: string;
  stage: KnowledgeThreadStage;
  nextMove: KnowledgeThreadStage;
  nextMoveReason: string;
  suggestedRequest: string;
  recordsCount: number;
  relatedFiles: string[];
  topics: string[];
  lastSeen: string;
}

export interface CounterSummary {
  knowledgeThreads: KnowledgeThreadSummary[];
  recurringThemes: ActivityThemeSummary[];
  recentAgentWork: ActivityRecord[];
  unbakedNotes: ActivityRecord[];
  tasteProfile: Record<ActivityDimension, number>;
  coverage: {
    recordsLogged: number;
    malformedRecords: number;
  };
}

export type DashboardScreen = 'home' | 'all-moves' | 'all-activity' | 'move-detail' | 'knowledge-health';

export interface DashboardMove {
  id: string;
  title: string;
  meta: string;
  description: string;
  prompt: string;
  skillTag: string;
}

export interface DashboardRefreshPayload {
  requestId: number;
}
