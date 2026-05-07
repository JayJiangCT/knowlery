# BYOAO Conservative Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a one-click conservative BYOAO-to-Knowlery migration path that preserves existing user files and makes Claude Code / Claudian the primary target.

**Architecture:** Add a focused `legacy-byoao-migration` core module that owns detection, preview generation, idempotent file writes, skill import, and lock normalization. Extend the setup wizard to show a migration path when a legacy BYOAO vault is detected, while keeping the normal setup path available for empty vaults. Tests target pure merge/normalization behavior plus a mocked vault adapter for idempotent execution.

**Tech Stack:** TypeScript, React 18, Obsidian Vault Adapter APIs, Vitest, existing Knowlery helpers in `vault-io`, `templates`, `rules`, and `skill-manager`.

---

## File Structure

- Create `src/core/legacy-byoao-migration.ts`
  - Detect legacy BYOAO signals.
  - Build a preview model for the setup wizard.
  - Execute conservative migration without overwriting protected files.
  - Normalize legacy `skills-lock.json`.
  - Sync `.agents/skills` to `.claude/skills`.

- Create `tests/core/legacy-byoao-migration.test.ts`
  - Cover pure detection, skill merge order, lock normalization, conflict reporting, and mocked idempotent migration.

- Modify `src/modals/setup-wizard.tsx`
  - Load migration preview during initial vault state check.
  - Show `Migrate from BYOAO` preview when legacy signals exist and Knowlery manifest is absent.
  - Run `executeByoaoMigration()` instead of `executeSetup()` for migration mode.
  - Keep normal setup reachable as an explicit alternative.

- Modify `src/types.ts`
  - Only if shared UI/core types are clearer there. Prefer keeping migration-specific types inside `legacy-byoao-migration.ts`.

- Modify `styles.css`
  - Only if existing wizard styles cannot express preview warnings and migration summary. Prefer reusing current wizard classes.

---

### Task 1: Add Pure Migration Types and Helper Tests

**Files:**
- Create: `tests/core/legacy-byoao-migration.test.ts`
- Create: `src/core/legacy-byoao-migration.ts`

- [ ] **Step 1: Write failing tests for legacy signal detection and skill merge order**

Create `tests/core/legacy-byoao-migration.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildSkillMergePlan,
  classifyByoaoLegacySignals,
  normalizeLegacySkillsLock,
} from '../../src/core/legacy-byoao-migration';

describe('classifyByoaoLegacySignals', () => {
  it('detects BYOAO from manifest, OpenCode skills, AGENTS.md, and knowledge directories', () => {
    const result = classifyByoaoLegacySignals({
      byoaoManifestExists: true,
      opencodeSkillsExists: true,
      agentsMdContent: '# Vault\n\nThis vault uses BYOAO commands.',
      existingKnowledgeDirs: ['entities', 'queries'],
    });

    expect(result.isLegacyByoao).toBe(true);
    expect(result.signals).toEqual([
      '.byoao/manifest.json',
      '.opencode/skills/',
      'AGENTS.md mentions BYOAO',
      'knowledge directories exist',
    ]);
  });

  it('does not classify a normal empty vault as BYOAO', () => {
    const result = classifyByoaoLegacySignals({
      byoaoManifestExists: false,
      opencodeSkillsExists: false,
      agentsMdContent: null,
      existingKnowledgeDirs: [],
    });

    expect(result.isLegacyByoao).toBe(false);
    expect(result.signals).toEqual([]);
  });
});

describe('buildSkillMergePlan', () => {
  it('keeps existing .agents skills, imports missing OpenCode skills, and adds missing bundled skills', () => {
    const plan = buildSkillMergePlan({
      existingAgentsSkills: ['ask', 'cook', 'custom-local'],
      existingOpenCodeSkills: ['ask', 'trace'],
      bundledSkillNames: ['ask', 'cook', 'explore'],
    });

    expect(plan.preserveAgents).toEqual(['ask', 'cook', 'custom-local']);
    expect(plan.importFromOpenCode).toEqual(['trace']);
    expect(plan.installBundled).toEqual(['explore']);
    expect(plan.conflicts).toEqual([{ name: 'ask', kept: '.agents/skills', skipped: '.opencode/skills' }]);
    expect(plan.finalSkillNames).toEqual(['ask', 'cook', 'custom-local', 'trace', 'explore']);
  });
});

describe('normalizeLegacySkillsLock', () => {
  it('rewrites a legacy skills lock into Knowlery shape', () => {
    const lock = normalizeLegacySkillsLock({
      existingLock: {
        version: 1,
        skills: {
          'excalidraw-diagram-generator': {
            source: 'github/awesome-copilot',
            sourceType: 'github',
            computedHash: 'abc123',
          },
        },
      },
      finalSkillNames: ['ask', 'trace', 'excalidraw-diagram-generator'],
      bundledSkillNames: ['ask'],
    });

    expect(lock).toEqual({
      version: '1.0.0',
      skills: {
        ask: { source: 'builtin', version: '1.0.0', disabled: false },
        trace: { source: 'custom', version: '1.0.0', disabled: false },
        'excalidraw-diagram-generator': {
          source: 'registry',
          version: '1.0.0',
          disabled: false,
          registryIdentifier: 'github/awesome-copilot',
        },
      },
    });
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- tests/core/legacy-byoao-migration.test.ts
```

Expected: FAIL because `src/core/legacy-byoao-migration.ts` does not exist.

- [ ] **Step 3: Add minimal pure helpers and exported types**

Create `src/core/legacy-byoao-migration.ts` with:

```ts
import { App, normalizePath } from 'obsidian';
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

export async function detectByoaoLegacyVault(app: App): Promise<LegacySignalResult> {
  const adapter = app.vault.adapter;
  const agentsMdPath = normalizePath('AGENTS.md');
  const agentsMdContent = await adapter.exists(agentsMdPath)
    ? await adapter.read(agentsMdPath)
    : null;

  const existingKnowledgeDirs: string[] = [];
  for (const dir of ['entities', 'concepts', 'comparisons', 'queries']) {
    if (await adapter.exists(normalizePath(dir))) existingKnowledgeDirs.push(dir);
  }

  return classifyByoaoLegacySignals({
    byoaoManifestExists: await adapter.exists(normalizePath('.byoao/manifest.json')),
    opencodeSkillsExists: await adapter.exists(normalizePath('.opencode/skills')),
    agentsMdContent,
    existingKnowledgeDirs,
  });
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
npm test -- tests/core/legacy-byoao-migration.test.ts
```

Expected: PASS for the three helper tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/core/legacy-byoao-migration.ts tests/core/legacy-byoao-migration.test.ts
git commit -m "test: cover byoao migration helpers"
```

---

### Task 2: Add Preview Builder and Idempotent Execution Tests

**Files:**
- Modify: `tests/core/legacy-byoao-migration.test.ts`
- Modify: `src/core/legacy-byoao-migration.ts`

- [ ] **Step 1: Add mocked adapter tests for preview and execution**

Append to `tests/core/legacy-byoao-migration.test.ts`:

```ts
import type { App } from 'obsidian';
import {
  buildByoaoMigrationPreview,
  executeByoaoMigration,
} from '../../src/core/legacy-byoao-migration';

function createMockApp(initialFiles: Record<string, string>): App {
  const files = new Map(Object.entries(initialFiles));
  const dirs = new Set<string>();

  for (const path of files.keys()) {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }

  const adapter = {
    exists: async (path: string) => files.has(path) || dirs.has(path),
    read: async (path: string) => {
      const content = files.get(path);
      if (content === undefined) throw new Error(`Missing file: ${path}`);
      return content;
    },
    write: async (path: string, content: string) => {
      files.set(path, content);
      const parts = path.split('/');
      for (let i = 1; i < parts.length; i += 1) {
        dirs.add(parts.slice(0, i).join('/'));
      }
    },
    mkdir: async (path: string) => {
      dirs.add(path);
    },
    list: async (path: string) => {
      const prefix = `${path}/`;
      const listedFiles: string[] = [];
      const listedFolders = new Set<string>();

      for (const file of files.keys()) {
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        const first = rest.split('/')[0];
        if (rest.includes('/')) listedFolders.add(`${path}/${first}`);
        else listedFiles.push(file);
      }

      for (const dir of dirs) {
        if (!dir.startsWith(prefix)) continue;
        const rest = dir.slice(prefix.length);
        if (!rest || rest.includes('/')) continue;
        listedFolders.add(`${path}/${rest}`);
      }

      return { files: listedFiles.sort(), folders: [...listedFolders].sort() };
    },
  };

  return {
    vault: {
      adapter,
      getFileByPath: (path: string) => files.has(path) ? ({ path } as never) : null,
      cachedRead: async (file: { path: string }) => files.get(file.path) || '',
    },
    __files: files,
  } as unknown as App;
}

describe('buildByoaoMigrationPreview', () => {
  it('reports preserved, imported, created, skipped, and warning items', async () => {
    const app = createMockApp({
      '.byoao/manifest.json': '{bad json',
      '.agents/skills/ask/SKILL.md': 'agents ask',
      '.opencode/skills/ask/SKILL.md': 'opencode ask',
      '.opencode/skills/trace/SKILL.md': 'trace',
      'SCHEMA.md': 'existing schema',
      'INDEX.base': 'existing index',
      'AGENTS.md': 'BYOAO vault',
      'skills-lock.json': '{bad json',
    });

    const preview = await buildByoaoMigrationPreview(app);

    expect(preview.detected).toBe(true);
    expect(preview.preserve).toContain('SCHEMA.md');
    expect(preview.preserve).toContain('INDEX.base');
    expect(preview.importSkills).toContain('trace');
    expect(preview.skip).toContain('ask exists in .agents/skills; skipped .opencode/skills copy');
    expect(preview.create).toContain('.knowlery/manifest.json');
    expect(preview.create).toContain('KNOWLEDGE.md');
    expect(preview.warnings).toEqual([
      'Could not parse .byoao/manifest.json; migration will continue.',
      'Could not parse skills-lock.json; Knowlery will rebuild it.',
    ]);
  });
});

describe('executeByoaoMigration', () => {
  it('does not overwrite existing root files and is safe to run twice', async () => {
    const app = createMockApp({
      '.byoao/manifest.json': '{"version":"2.0.12"}',
      '.agents/skills/ask/SKILL.md': 'agents ask',
      '.opencode/skills/trace/SKILL.md': 'trace skill',
      'SCHEMA.md': 'keep schema',
      'INDEX.base': 'keep index',
      'AGENTS.md': 'BYOAO vault',
    });

    await executeByoaoMigration(app, { kbName: 'Jay WorkSpace' });
    await executeByoaoMigration(app, { kbName: 'Jay WorkSpace' });

    const files = (app as unknown as { __files: Map<string, string> }).__files;
    expect(files.get('SCHEMA.md')).toBe('keep schema');
    expect(files.get('INDEX.base')).toBe('keep index');
    expect(files.get('.agents/skills/trace/SKILL.md')).toBe('trace skill');
    expect(files.get('.claude/skills/trace/SKILL.md')).toBe('trace skill');
    expect(files.get('.knowlery/manifest.json')).toContain('"platform": "claude-code"');
    expect(files.get('skills-lock.json')).toContain('"trace"');
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- tests/core/legacy-byoao-migration.test.ts
```

Expected: FAIL because `buildByoaoMigrationPreview` and `executeByoaoMigration` are not implemented.

- [ ] **Step 3: Implement preview and execution**

Extend `src/core/legacy-byoao-migration.ts` with these imports:

```ts
import { KNOWLEDGE_DIRS, type Manifest } from '../types';
import { BUNDLED_SKILLS } from '../assets/skills';
import { RULE_TEMPLATES } from '../assets/rules';
import { generateClaudeMd, generateKnowledgeMd } from '../assets/templates';
import { ensureDir, writeFile } from './vault-io';
```

Add these types and functions:

```ts
const KNOWLERY_MANIFEST_PATH = '.knowlery/manifest.json';
const AGENTS_SKILLS_DIR = '.agents/skills';
const OPENCODE_SKILLS_DIR = '.opencode/skills';
const CLAUDE_SKILLS_DIR = '.claude/skills';

export interface ByoaoMigrationPreview {
  detected: boolean;
  signals: string[];
  create: string[];
  preserve: string[];
  importSkills: string[];
  installBundledSkills: string[];
  skip: string[];
  warnings: string[];
}

export interface ExecuteByoaoMigrationOptions {
  kbName: string;
}

export async function buildByoaoMigrationPreview(app: App): Promise<ByoaoMigrationPreview> {
  const detected = await detectByoaoLegacyVault(app);
  const adapter = app.vault.adapter;
  const warnings: string[] = [];
  const preserve: string[] = [];
  const create: string[] = [];

  for (const path of ['SCHEMA.md', 'INDEX.base', 'AGENTS.md', '.byoao/manifest.json', '.opencode']) {
    if (await adapter.exists(normalizePath(path))) preserve.push(path);
  }

  for (const path of [KNOWLERY_MANIFEST_PATH, 'KNOWLEDGE.md', '.claude/CLAUDE.md']) {
    if (!(await adapter.exists(normalizePath(path)))) create.push(path);
    else preserve.push(path);
  }

  for (const dir of KNOWLEDGE_DIRS) {
    if (await adapter.exists(normalizePath(dir))) preserve.push(`${dir}/`);
    else create.push(`${dir}/`);
  }

  const agentsSkills = await listSkillNames(app, AGENTS_SKILLS_DIR);
  const opencodeSkills = await listSkillNames(app, OPENCODE_SKILLS_DIR);
  const mergePlan = buildSkillMergePlan({
    existingAgentsSkills: agentsSkills,
    existingOpenCodeSkills: opencodeSkills,
    bundledSkillNames: BUNDLED_SKILLS.map((skill) => skill.name),
  });

  const byoaoManifest = await readJsonBestEffort(app, '.byoao/manifest.json');
  if (byoaoManifest.exists && !byoaoManifest.ok) {
    warnings.push('Could not parse .byoao/manifest.json; migration will continue.');
  }

  const skillsLock = await readJsonBestEffort(app, 'skills-lock.json');
  if (skillsLock.exists && !skillsLock.ok) {
    warnings.push('Could not parse skills-lock.json; Knowlery will rebuild it.');
  }

  return {
    detected: detected.isLegacyByoao,
    signals: detected.signals,
    create: sortedUnique(create),
    preserve: sortedUnique(preserve),
    importSkills: mergePlan.importFromOpenCode,
    installBundledSkills: mergePlan.installBundled,
    skip: mergePlan.conflicts.map((conflict) => (
      `${conflict.name} exists in .agents/skills; skipped .opencode/skills copy`
    )),
    warnings,
  };
}

export async function executeByoaoMigration(
  app: App,
  options: ExecuteByoaoMigrationOptions,
): Promise<ByoaoMigrationPreview> {
  const adapter = app.vault.adapter;

  for (const dir of KNOWLEDGE_DIRS) {
    await ensureDir(app, dir);
  }
  await ensureDir(app, '.knowlery');
  await ensureDir(app, '.agents');
  await ensureDir(app, AGENTS_SKILLS_DIR);
  await ensureDir(app, '.agents/rules');
  await ensureDir(app, '.claude');
  await ensureDir(app, '.claude/rules');
  await ensureDir(app, CLAUDE_SKILLS_DIR);

  await writeFileIfMissing(app, 'KNOWLEDGE.md', generateKnowledgeMd(options.kbName));
  await writeFileIfMissing(app, '.claude/CLAUDE.md', generateClaudeMd());
  await installMissingDefaultRules(app);

  const agentsSkills = await listSkillNames(app, AGENTS_SKILLS_DIR);
  const opencodeSkills = await listSkillNames(app, OPENCODE_SKILLS_DIR);
  const mergePlan = buildSkillMergePlan({
    existingAgentsSkills: agentsSkills,
    existingOpenCodeSkills: opencodeSkills,
    bundledSkillNames: BUNDLED_SKILLS.map((skill) => skill.name),
  });

  for (const name of mergePlan.importFromOpenCode) {
    const content = await adapter.read(normalizePath(`${OPENCODE_SKILLS_DIR}/${name}/SKILL.md`));
    await writeFileIfMissing(app, `${AGENTS_SKILLS_DIR}/${name}/SKILL.md`, content);
  }

  for (const name of mergePlan.installBundled) {
    const bundled = BUNDLED_SKILLS.find((skill) => skill.name === name);
    if (bundled) {
      await writeFileIfMissing(app, `${AGENTS_SKILLS_DIR}/${name}/SKILL.md`, bundled.content);
    }
  }

  const finalSkillNames = await listSkillNames(app, AGENTS_SKILLS_DIR);
  for (const name of finalSkillNames) {
    const sourcePath = normalizePath(`${AGENTS_SKILLS_DIR}/${name}/SKILL.md`);
    if (!(await adapter.exists(sourcePath))) continue;
    const content = await adapter.read(sourcePath);
    await writeFile(app, `${CLAUDE_SKILLS_DIR}/${name}/SKILL.md`, content);
  }

  const existingLock = await readJsonBestEffort(app, 'skills-lock.json');
  const lock = normalizeLegacySkillsLock({
    existingLock: existingLock.value,
    finalSkillNames,
    bundledSkillNames: BUNDLED_SKILLS.map((skill) => skill.name),
  });
  await writeFile(app, 'skills-lock.json', JSON.stringify(lock, null, 2));

  const now = new Date().toISOString();
  const manifest: Manifest = {
    version: '0.1.0',
    platform: 'claude-code',
    kbName: options.kbName,
    createdAt: now,
    updatedAt: now,
  };
  await writeFile(app, KNOWLERY_MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  return buildByoaoMigrationPreview(app);
}

async function installMissingDefaultRules(app: App): Promise<void> {
  for (const template of RULE_TEMPLATES) {
    await writeFileIfMissing(app, `.claude/rules/${template.filename}`, template.content);
  }
}

async function writeFileIfMissing(app: App, path: string, content: string): Promise<void> {
  const normalized = normalizePath(path);
  if (await app.vault.adapter.exists(normalized)) return;
  const parent = normalized.split('/').slice(0, -1).join('/');
  if (parent) await ensureDir(app, parent);
  await writeFile(app, normalized, content);
}

async function listSkillNames(app: App, dir: string): Promise<string[]> {
  const normalized = normalizePath(dir);
  if (!(await app.vault.adapter.exists(normalized))) return [];
  const listing = await app.vault.adapter.list(normalized);
  const names: string[] = [];
  for (const folder of listing.folders) {
    const name = folder.split('/').pop();
    if (!name) continue;
    if (await app.vault.adapter.exists(normalizePath(`${folder}/SKILL.md`))) {
      names.push(name);
    }
  }
  return sortedUnique(names);
}

async function readJsonBestEffort(app: App, path: string): Promise<{
  exists: boolean;
  ok: boolean;
  value: unknown;
}> {
  const normalized = normalizePath(path);
  if (!(await app.vault.adapter.exists(normalized))) {
    return { exists: false, ok: true, value: null };
  }

  try {
    return { exists: true, ok: true, value: JSON.parse(await app.vault.adapter.read(normalized)) };
  } catch {
    return { exists: true, ok: false, value: null };
  }
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run:

```bash
npm test -- tests/core/legacy-byoao-migration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/core/legacy-byoao-migration.ts tests/core/legacy-byoao-migration.test.ts
git commit -m "feat: add conservative byoao migration core"
```

---

### Task 3: Wire Migration Mode Into Setup Wizard

**Files:**
- Modify: `src/modals/setup-wizard.tsx`

- [ ] **Step 1: Import migration APIs and types**

Add imports near the existing setup imports:

```ts
import {
  buildByoaoMigrationPreview,
  executeByoaoMigration,
  type ByoaoMigrationPreview,
} from '../core/legacy-byoao-migration';
```

- [ ] **Step 2: Add wizard mode state**

Inside `SetupWizardContent`, after `existingManifest` state:

```ts
  const [migrationPreview, setMigrationPreview] = useState<ByoaoMigrationPreview | null>(null);
  const [setupMode, setSetupMode] = useState<'normal' | 'byoao-migration'>('normal');
```

- [ ] **Step 3: Load migration preview during initial manifest check**

Replace the existing initial `readManifest` effect with:

```ts
  useEffect(() => {
    let cancelled = false;

    async function loadVaultState() {
      const manifest = await readManifest(plugin.app);
      if (cancelled) return;

      if (manifest) {
        setExistingManifest(manifest);
        setPlatform(manifest.platform);
        setLoading(false);
        return;
      }

      const preview = await buildByoaoMigrationPreview(plugin.app);
      if (cancelled) return;

      setMigrationPreview(preview);
      if (preview.detected) {
        setSetupMode('byoao-migration');
        setPlatform('claude-code');
      }
      setLoading(false);
    }

    void loadVaultState();

    return () => {
      cancelled = true;
    };
  }, [plugin.app]);
```

- [ ] **Step 4: Add migration handler**

Add this handler near `handleSetup`:

```ts
  const handleMigration = async () => {
    setError(null);
    setPhase('running');
    setCompletedSteps(new Set(getSetupSteps().map((step) => step.step)));
    setOptionalInstallRuns([]);

    try {
      const preview = await executeByoaoMigration(plugin.app, {
        kbName: plugin.settings.kbName,
      });
      setMigrationPreview(preview);
      plugin.settings.platform = 'claude-code';
      await plugin.saveSettings();
      setPhase('done');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setPhase('preview');
    }
  };
```

- [ ] **Step 5: Add migration preview branch in preview UI**

At the start of the `phase === 'preview'` branch, before the normal setup return, add:

```tsx
  if (phase === 'preview' && setupMode === 'byoao-migration' && migrationPreview) {
    return (
      <div className="knowlery-wizard__phase">
        <PhaseSteps current="preview" />

        <div className="knowlery-wizard__body">
          <p className="knowlery-wizard__intro">
            Knowlery found an existing BYOAO vault. Migration will preserve your current files,
            import legacy skills, and configure Claude Code.
          </p>

          {error && (
            <div className="knowlery-wizard__error">
              <span className="knowlery-wizard__error-icon">
                <IconAlertCircle size={16} />
              </span>
              <span>{error}</span>
            </div>
          )}

          <div className="knowlery-wizard__preview-list">
            <PreviewSection title="Detected BYOAO signals" icon={<IconCheckCircle size={16} />} defaultOpen>
              <ul className="knowlery-wizard__dir-list">
                {migrationPreview.signals.map((signal) => <li key={signal}>{signal}</li>)}
              </ul>
            </PreviewSection>

            <PreviewSection title={`Skills to import (${migrationPreview.importSkills.length})`} icon={<IconWrench size={16} />} defaultOpen>
              <div className="knowlery-wizard__skill-grid">
                {migrationPreview.importSkills.slice(0, 8).map((name) => (
                  <div key={name} className="knowlery-wizard__skill-item">
                    <span className="knowlery-wizard__skill-icon"><SkillIcon name={name} size={14} /></span>
                    <span>{name}</span>
                  </div>
                ))}
                {migrationPreview.importSkills.length === 0 && <p>No legacy OpenCode skills need importing.</p>}
                {migrationPreview.importSkills.length > 8 && (
                  <div className="knowlery-wizard__skill-more">
                    ... and {migrationPreview.importSkills.length - 8} more
                  </div>
                )}
              </div>
            </PreviewSection>

            <PreviewSection title="Files to create or repair" icon={<IconFolder size={16} />}>
              <ul className="knowlery-wizard__dir-list">
                {migrationPreview.create.map((path) => <li key={path}><code>{path}</code></li>)}
              </ul>
            </PreviewSection>

            <PreviewSection title="Files preserved" icon={<IconSettings size={16} />}>
              <ul className="knowlery-wizard__dir-list">
                {migrationPreview.preserve.map((path) => <li key={path}><code>{path}</code></li>)}
              </ul>
            </PreviewSection>

            {(migrationPreview.skip.length > 0 || migrationPreview.warnings.length > 0) && (
              <PreviewSection title="Notes and warnings" icon={<IconAlertCircle size={16} />}>
                <ul className="knowlery-wizard__dir-list">
                  {migrationPreview.skip.map((item) => <li key={item}>{item}</li>)}
                  {migrationPreview.warnings.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </PreviewSection>
            )}
          </div>
        </div>

        <div className="knowlery-wizard__footer">
          <button type="button" className="knowlery-btn knowlery-btn--ghost" onClick={() => setSetupMode('normal')}>
            Use normal setup
          </button>
          <button type="button" className="knowlery-btn knowlery-btn--primary" onClick={handleMigration}>
            Migrate to Knowlery
            <IconArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }
```

- [ ] **Step 6: Adjust running and done copy for migration**

In the running branch, change the footer hint to:

```tsx
          <span className="knowlery-wizard__footer-hint">
            {setupMode === 'byoao-migration' ? 'Migrating your vault...' : 'Setting up your vault...'}
          </span>
```

In the done branch, change title and description to:

```tsx
          <p className="knowlery-wizard__done-title">
            {setupMode === 'byoao-migration'
              ? 'BYOAO migration complete!'
              : isReinstall ? 'Vault updated!' : 'Your vault is ready!'}
          </p>
          <p className="knowlery-wizard__done-desc">
            {setupMode === 'byoao-migration'
              ? 'Knowlery preserved your BYOAO/OpenCode files, imported legacy skills, and configured Claude Code.'
              : <>Knowlery has {isReinstall ? 'updated' : 'installed'} {BUNDLED_SKILLS.length} skills
                and configured your vault for {platform === 'claude-code' ? 'Claude Code' : 'OpenCode'}.</>}
          </p>
```

- [ ] **Step 7: Run typecheck/build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/modals/setup-wizard.tsx
git commit -m "feat: surface byoao migration in setup wizard"
```

---

### Task 4: Add Final Verification and Manual Test Notes

**Files:**
- Modify: `docs/superpowers/specs/2026-05-07-byoao-conservative-migration-design.md` if implementation discovers a small clarification.
- No code change unless tests reveal an issue.

- [ ] **Step 1: Run focused migration tests**

Run:

```bash
npm test -- tests/core/legacy-byoao-migration.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and `main.js` generated.

- [ ] **Step 4: Manual verification in an Obsidian test vault**

Use a copy of a BYOAO vault, not the live user vault. Verify these conditions:

```text
1. Enable Knowlery in the copied BYOAO vault.
2. Setup wizard title/body presents migration, not normal setup.
3. Preview lists .byoao/manifest.json or .opencode/skills as detected signals.
4. Click "Migrate to Knowlery".
5. Confirm .knowlery/manifest.json exists and contains "platform": "claude-code".
6. Confirm SCHEMA.md and INDEX.base contents are unchanged.
7. Confirm .agents/skills contains previous legacy skills.
8. Confirm .claude/skills mirrors .agents/skills.
9. Confirm .byoao and .opencode still exist.
10. Reopen Knowlery and confirm the setup wizard is not shown again.
```

- [ ] **Step 5: Document manual verification gaps in final response**

If manual Obsidian verification is not run, state:

```text
Manual Obsidian vault verification still needed: setup wizard rendering, Claudian session startup, Claude Code reading .claude/CLAUDE.md, and INDEX.base opening in Obsidian Bases.
```

- [ ] **Step 6: Commit any final test or docs adjustment**

Only if files changed:

```bash
git add <changed-files>
git commit -m "test: verify byoao migration flow"
```

---

## Self-Review

Spec coverage:

- Legacy BYOAO detection is covered by Task 1 and Task 2.
- One-click migration UI is covered by Task 3.
- Conservative no-overwrite behavior is covered by Task 2 mocked execution tests.
- Skill import order and conflict behavior are covered by Task 1 and Task 2.
- Lock normalization is covered by Task 1.
- Manual verification requirements are covered by Task 4.
- Non-goals are preserved by execution tests and explicit UI copy.

Placeholder scan:

- No open-ended implementation steps remain.
- Code-changing steps include concrete code blocks.
- Test steps include exact commands and expected outcomes.

Type consistency:

- `ByoaoMigrationPreview`, `buildByoaoMigrationPreview`, and `executeByoaoMigration` are defined in the core module before wizard usage.
- `setupMode` values are consistently `'normal' | 'byoao-migration'`.
- Skill lock output matches the existing `SkillsLock` schema in `src/types.ts`.
