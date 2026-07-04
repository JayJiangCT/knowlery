import type { App } from 'obsidian';
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
import { syncQueryScript } from './query-script';
import type { VaultFs } from './vault-fs';
import { normalizeVaultPath } from './vault-fs';

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
  /** Required only when optionalInstalls is set — tool installs are an Obsidian-shell feature. */
  app?: App;
}

export interface ExecuteSetupResult {
  optionalInstallRuns: InstallExecutionState[];
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
  fs: VaultFs,
  platform: Platform,
  kbName: string,
  onProgress: (step: SetupStep) => void,
  options: ExecuteSetupOptions = {},
): Promise<ExecuteSetupResult> {
  onProgress('directories');
  for (const dir of KNOWLEDGE_DIRS) {
    await fs.mkdir(dir);
  }

  onProgress('knowledge-files');
  await fs.write('KNOWLEDGE.md', generateKnowledgeMd(kbName));
  await fs.write('SCHEMA.md', generateSchemaMd());
  await fs.write('INDEX.base', generateIndexBase());

  onProgress('skills');
  await installAllBuiltinSkills(fs);

  onProgress('platform-config');
  await installDefaultRules(fs, platform);
  await generatePlatformConfig(fs, platform, kbName);

  onProgress('lock-files');
  const lock = buildInitialSkillsLock();
  await saveSkillsLock(fs, lock);
  await syncQueryScript(fs);
  await writeManifest(fs, platform, kbName);

  let optionalInstallRuns: InstallExecutionState[] = [];
  if (hasOptionalInstalls(options.optionalInstalls) && options.app) {
    optionalInstallRuns = await runOptionalInstalls({
      app: options.app,
      platform,
      selection: options.optionalInstalls,
      nodePath: options.nodePath,
      onUpdate: options.onOptionalInstallUpdate,
    });
  }

  return { optionalInstallRuns };
}

async function writeManifest(fs: VaultFs, platform: Platform, kbName: string): Promise<void> {
  const existing = await readManifest(fs);
  const now = new Date().toISOString();
  const manifest: Manifest = {
    version: '0.1.0',
    platform,
    kbName,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await fs.mkdir(KNOWLERY_DIR);
  await fs.write(normalizeVaultPath(MANIFEST_PATH), JSON.stringify(manifest, null, 2));
}

export async function readManifest(fs: VaultFs): Promise<Manifest | null> {
  const path = normalizeVaultPath(MANIFEST_PATH);
  if (!(await fs.exists(path))) return null;
  try {
    const content = await fs.read(path);
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function isVaultInitialized(fs: VaultFs): Promise<boolean> {
  return (await fs.exists(normalizeVaultPath(MANIFEST_PATH)))
    || (await fs.exists(normalizeVaultPath('KNOWLEDGE.md')));
}

export async function writeManifestUpdate(
  fs: VaultFs,
  updates: Partial<Pick<Manifest, 'kbName' | 'platform'>>,
): Promise<void> {
  const manifest = await readManifest(fs);
  if (!manifest) return;
  Object.assign(manifest, updates, { updatedAt: new Date().toISOString() });
  await fs.mkdir(KNOWLERY_DIR);
  await fs.write(normalizeVaultPath(MANIFEST_PATH), JSON.stringify(manifest, null, 2));
}

function hasOptionalInstalls(selection?: OptionalInstallSelection): selection is OptionalInstallSelection {
  return Boolean(selection?.platformCli || selection?.claudian || selection?.skillsTooling);
}
