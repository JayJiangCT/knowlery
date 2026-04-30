import { App, normalizePath } from 'obsidian';
import type {
  InstallExecutionState,
  Manifest,
  OptionalInstallSelection,
  Platform,
} from '../types';
import { KNOWLEDGE_DIRS } from '../types';
import { BUNDLED_SKILLS } from '../assets/skills';
import { generateIndexBase, generateKnowledgeMd, generateSchemaMd } from '../assets/templates';
import { generatePlatformConfig } from './platform-adapter';
import { installAllBuiltinSkills, buildInitialSkillsLock, saveSkillsLock } from './skill-manager';
import { installDefaultRules } from './rule-manager';
import { runOptionalInstalls } from './environment-install';
import { ensureDir, writeFile } from './vault-io';

const KNOWLERY_DIR = '.knowlery';
const MANIFEST_PATH = `${KNOWLERY_DIR}/manifest.json`;

export type SetupStep =
  | 'directories'
  | 'knowledge-files'
  | 'skills'
  | 'platform-config'
  | 'lock-files';

export interface SetupProgress {
  step: SetupStep;
  label: string;
  done: boolean;
}

export interface ExecuteSetupOptions {
  optionalInstalls?: OptionalInstallSelection;
  nodePath?: string;
  onOptionalInstallUpdate?: (state: InstallExecutionState) => void;
}

export function getSetupSteps(): SetupProgress[] {
  return [
    { step: 'directories', label: 'Creating knowledge directories', done: false },
    { step: 'knowledge-files', label: 'Writing KNOWLEDGE.md, SCHEMA.md, and INDEX.base', done: false },
    { step: 'skills', label: `Installing ${BUNDLED_SKILLS.length} built-in skills`, done: false },
    { step: 'platform-config', label: 'Generating agent configuration', done: false },
    { step: 'lock-files', label: 'Writing configuration files', done: false },
  ];
}

export async function executeSetup(
  app: App,
  platform: Platform,
  kbName: string,
  onProgress: (step: SetupStep) => void,
  options: ExecuteSetupOptions = {},
): Promise<void> {
  onProgress('directories');
  for (const dir of KNOWLEDGE_DIRS) {
    await ensureDir(app, dir);
  }

  onProgress('knowledge-files');
  await writeFile(app, 'KNOWLEDGE.md', generateKnowledgeMd(kbName));
  await writeFile(app, 'SCHEMA.md', generateSchemaMd());
  await writeFile(app, 'INDEX.base', generateIndexBase());

  onProgress('skills');
  await installAllBuiltinSkills(app);

  onProgress('platform-config');
  await generatePlatformConfig(app, platform, kbName);
  await installDefaultRules(app, platform);

  onProgress('lock-files');
  const lock = buildInitialSkillsLock();
  await saveSkillsLock(app, lock);
  await writeManifest(app, platform, kbName);

  if (hasOptionalInstalls(options.optionalInstalls)) {
    void runOptionalInstalls({
      app,
      platform,
      selection: options.optionalInstalls,
      nodePath: options.nodePath,
      onUpdate: options.onOptionalInstallUpdate,
    }).catch(() => {
      // Optional installs report their own failures through per-item updates.
    });
  }
}

async function writeManifest(app: App, platform: Platform, kbName: string): Promise<void> {
  const existing = await readManifest(app);
  const now = new Date().toISOString();
  const manifest: Manifest = {
    version: '0.1.0',
    platform,
    kbName,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await ensureDir(app, KNOWLERY_DIR);
  const path = normalizePath(MANIFEST_PATH);
  await app.vault.adapter.write(path, JSON.stringify(manifest, null, 2));
}

export async function readManifest(app: App): Promise<Manifest | null> {
  const path = normalizePath(MANIFEST_PATH);
  if (!(await app.vault.adapter.exists(path))) return null;
  try {
    const content = await app.vault.adapter.read(path);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function isVaultInitialized(app: App): Promise<boolean> {
  return app.vault.adapter.exists(normalizePath(MANIFEST_PATH));
}

export async function writeManifestUpdate(
  app: App,
  updates: Partial<Pick<Manifest, 'kbName' | 'platform'>>,
): Promise<void> {
  const manifest = await readManifest(app);
  if (!manifest) return;
  Object.assign(manifest, updates, { updatedAt: new Date().toISOString() });
  await ensureDir(app, KNOWLERY_DIR);
  const path = normalizePath(MANIFEST_PATH);
  await app.vault.adapter.write(path, JSON.stringify(manifest, null, 2));
}

function hasOptionalInstalls(selection?: OptionalInstallSelection): selection is OptionalInstallSelection {
  return Boolean(selection?.platformCli || selection?.claudian || selection?.skillsTooling);
}
