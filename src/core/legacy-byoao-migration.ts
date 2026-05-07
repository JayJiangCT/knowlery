import type { App } from 'obsidian';
import { KNOWLEDGE_DIRS, type Manifest, type SkillsLock } from '../types';
import { BUNDLED_SKILLS } from '../assets/skills';
import { RULE_TEMPLATES } from '../assets/rules';
import {
  generateClaudeMd,
  generateIndexBase,
  generateKnowledgeMd,
  generateSchemaMd,
} from '../assets/templates';
import { ensureDir, writeFile } from './vault-io';

const KNOWLERY_DIR = '.knowlery';
const KNOWLERY_MANIFEST_PATH = `${KNOWLERY_DIR}/manifest.json`;
const AGENTS_SKILLS_DIR = '.agents/skills';
const CLAUDE_SKILLS_DIR = '.claude/skills';
const OPENCODE_SKILLS_DIR = '.opencode/skills';
const SKILLS_LOCK_PATH = 'skills-lock.json';
const ROOT_FILES = [
  { path: 'KNOWLEDGE.md', content: (kbName: string) => generateKnowledgeMd(kbName) },
  { path: 'SCHEMA.md', content: () => generateSchemaMd() },
  { path: 'INDEX.base', content: () => generateIndexBase() },
] as const;

export interface ByoaoMigrationPreview {
  detected: boolean;
  signals: string[];
  preserve: string[];
  importSkills: string[];
  installSkills: string[];
  create: string[];
  skip: string[];
  warnings: string[];
}

export interface ExecuteByoaoMigrationOptions {
  kbName: string;
}

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

export async function buildByoaoMigrationPreview(app: App): Promise<ByoaoMigrationPreview> {
  const detection = await detectByoaoLegacyVault(app);
  const adapter = app.vault.adapter;
  const preserve: string[] = [];
  const create: string[] = [];
  const skip: string[] = [];
  const warnings: string[] = [];

  for (const path of ['.byoao', '.opencode', 'AGENTS.md', ...ROOT_FILES.map((file) => file.path)]) {
    if (await adapter.exists(normalizeLegacyPath(path))) preserve.push(path);
  }

  const byoaoManifest = await readJsonBestEffort(app, '.byoao/manifest.json');
  if (byoaoManifest.parseFailed) {
    warnings.push('Could not parse .byoao/manifest.json; migration will continue.');
  }

  const existingLock = await readJsonBestEffort(app, SKILLS_LOCK_PATH);
  if (existingLock.parseFailed) {
    warnings.push('Could not parse skills-lock.json; Knowlery will rebuild it.');
  }

  const existingAgentsSkills = await listSkillNames(app, AGENTS_SKILLS_DIR);
  const existingOpenCodeSkills = await listSkillNames(app, OPENCODE_SKILLS_DIR);
  const bundledSkillNames = BUNDLED_SKILLS.map((skill) => skill.name);
  const mergePlan = buildSkillMergePlan({
    existingAgentsSkills,
    existingOpenCodeSkills,
    bundledSkillNames,
  });

  for (const conflict of mergePlan.conflicts) {
    skip.push(`${conflict.name} exists in .agents/skills; skipped .opencode/skills copy`);
  }

  for (const file of ROOT_FILES) {
    if (!(await adapter.exists(normalizeLegacyPath(file.path)))) create.push(file.path);
  }

  if (!(await adapter.exists(normalizeLegacyPath(KNOWLERY_MANIFEST_PATH)))) {
    create.push(KNOWLERY_MANIFEST_PATH);
  }
  if (!(await adapter.exists(normalizeLegacyPath('.claude/CLAUDE.md')))) {
    create.push('.claude/CLAUDE.md');
  }

  for (const template of RULE_TEMPLATES) {
    const path = `.claude/rules/${template.filename}`;
    if (!(await adapter.exists(normalizeLegacyPath(path)))) create.push(path);
  }

  for (const name of [...mergePlan.importFromOpenCode, ...mergePlan.installBundled]) {
    const claudePath = `${CLAUDE_SKILLS_DIR}/${name}/SKILL.md`;
    if (!(await adapter.exists(normalizeLegacyPath(claudePath)))) create.push(claudePath);
  }

  return {
    detected: detection.isLegacyByoao,
    signals: detection.signals,
    preserve: sortedUnique(preserve),
    importSkills: mergePlan.importFromOpenCode,
    installSkills: mergePlan.installBundled,
    create: sortedUnique(create),
    skip,
    warnings,
  };
}

export async function executeByoaoMigration(
  app: App,
  options: ExecuteByoaoMigrationOptions,
): Promise<void> {
  for (const dir of KNOWLEDGE_DIRS) {
    await ensureMigrationDir(app, dir);
  }

  for (const file of ROOT_FILES) {
    await writeFileIfMissing(app, file.path, file.content(options.kbName));
  }

  await ensureMigrationDir(app, '.claude');
  await ensureMigrationDir(app, '.claude/rules');
  await writeFileIfMissing(app, '.claude/CLAUDE.md', generateClaudeMd());
  await installMissingDefaultRules(app);

  await ensureMigrationDir(app, AGENTS_SKILLS_DIR);
  await ensureMigrationDir(app, CLAUDE_SKILLS_DIR);

  const existingAgentsSkills = await listSkillNames(app, AGENTS_SKILLS_DIR);
  const existingOpenCodeSkills = await listSkillNames(app, OPENCODE_SKILLS_DIR);
  const bundledSkillNames = BUNDLED_SKILLS.map((skill) => skill.name);
  const mergePlan = buildSkillMergePlan({
    existingAgentsSkills,
    existingOpenCodeSkills,
    bundledSkillNames,
  });

  for (const name of mergePlan.importFromOpenCode) {
    const sourcePath = `${OPENCODE_SKILLS_DIR}/${name}/SKILL.md`;
    const targetPath = `${AGENTS_SKILLS_DIR}/${name}/SKILL.md`;
    if (await app.vault.adapter.exists(normalizeLegacyPath(sourcePath))) {
      const content = await app.vault.adapter.read(normalizeLegacyPath(sourcePath));
      await writeFileIfMissing(app, targetPath, content);
    }
  }

  for (const skill of BUNDLED_SKILLS) {
    const path = `${AGENTS_SKILLS_DIR}/${skill.name}/SKILL.md`;
    await writeFileIfMissing(app, path, skill.content);
  }

  const finalSkillNames = await listSkillNames(app, AGENTS_SKILLS_DIR);
  for (const name of finalSkillNames) {
    const sourcePath = `${AGENTS_SKILLS_DIR}/${name}/SKILL.md`;
    if (!(await app.vault.adapter.exists(normalizeLegacyPath(sourcePath)))) continue;
    const content = await app.vault.adapter.read(normalizeLegacyPath(sourcePath));
    await writeMigrationFile(app, `${CLAUDE_SKILLS_DIR}/${name}/SKILL.md`, content);
  }

  const existingLock = await readJsonBestEffort(app, SKILLS_LOCK_PATH);
  const lock = normalizeLegacySkillsLock({
    existingLock: existingLock.value,
    finalSkillNames,
    bundledSkillNames,
  });
  await writeMigrationFile(app, SKILLS_LOCK_PATH, JSON.stringify(lock, null, 2));

  await writeMigrationManifest(app, options.kbName);
}

export async function installMissingDefaultRules(app: App): Promise<void> {
  await ensureMigrationDir(app, '.claude/rules');
  for (const template of RULE_TEMPLATES) {
    await writeFileIfMissing(app, `.claude/rules/${template.filename}`, template.content);
  }
}

export async function writeFileIfMissing(app: App, path: string, content: string): Promise<boolean> {
  const normalized = normalizeLegacyPath(path);
  if (await app.vault.adapter.exists(normalized)) return false;
  await ensureParentDirs(app, normalized);
  await writeFile(app, normalized, content);
  return true;
}

export async function listSkillNames(app: App, dir: string): Promise<string[]> {
  const normalizedDir = normalizeLegacyPath(dir);
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(normalizedDir))) return [];

  const listing = await adapter.list(normalizedDir);
  const names: string[] = [];
  for (const folderPath of listing.folders) {
    const name = folderPath.split('/').pop();
    if (!name) continue;
    const skillPath = normalizeLegacyPath(`${folderPath}/SKILL.md`);
    if (await adapter.exists(skillPath)) names.push(name);
  }

  return sortedUnique(names);
}

export async function readJsonBestEffort(
  app: App,
  path: string,
): Promise<{ value: unknown; parseFailed: boolean }> {
  const normalized = normalizeLegacyPath(path);
  const adapter = app.vault.adapter;
  if (!(await adapter.exists(normalized))) return { value: null, parseFailed: false };

  try {
    return { value: JSON.parse(await adapter.read(normalized)), parseFailed: false };
  } catch {
    return { value: null, parseFailed: true };
  }
}

async function writeMigrationManifest(app: App, kbName: string): Promise<void> {
  await ensureMigrationDir(app, KNOWLERY_DIR);
  const existing = await readJsonBestEffort(app, KNOWLERY_MANIFEST_PATH);
  const existingManifest = existing.value && typeof existing.value === 'object'
    ? existing.value as Partial<Manifest>
    : null;
  const now = new Date().toISOString();
  const manifest: Manifest = {
    version: '0.1.0',
    platform: 'claude-code',
    kbName,
    createdAt: typeof existingManifest?.createdAt === 'string' ? existingManifest.createdAt : now,
    updatedAt: now,
  };

  await writeMigrationFile(app, KNOWLERY_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

async function ensureParentDirs(app: App, path: string): Promise<void> {
  const parts = normalizeLegacyPath(path).split('/');
  for (let i = 1; i < parts.length; i += 1) {
    await ensureMigrationDir(app, parts.slice(0, i).join('/'));
  }
}

async function ensureMigrationDir(app: App, path: string): Promise<void> {
  const normalized = normalizeLegacyPath(path);
  try {
    await ensureDir(app, normalized);
  } catch {
    await app.vault.adapter.mkdir(normalized);
  }
}

async function writeMigrationFile(app: App, path: string, content: string): Promise<void> {
  const normalized = normalizeLegacyPath(path);
  await ensureParentDirs(app, normalized);
  try {
    await writeFile(app, normalized, content);
  } catch {
    await app.vault.adapter.write(normalized, content);
  }
}
