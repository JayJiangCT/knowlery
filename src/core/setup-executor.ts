import { App, normalizePath } from 'obsidian';
import type { Manifest, Platform } from '../types';
import { KNOWLEDGE_DIRS } from '../types';
import { generateKnowledgeMd, generateSchemaMd } from '../assets/templates';
import { generatePlatformConfig } from './platform-adapter';
import { installAllBuiltinSkills, buildInitialSkillsLock, saveSkillsLock } from './skill-manager';
import { installDefaultRules } from './rule-manager';

export type SetupStep =
  | 'directories'
  | 'knowledge-files'
  | 'skills'
  | 'symlinks'
  | 'platform-config'
  | 'lock-files';

export interface SetupProgress {
  step: SetupStep;
  label: string;
  done: boolean;
}

export function getSetupSteps(): SetupProgress[] {
  return [
    { step: 'directories', label: 'Creating knowledge directories', done: false },
    { step: 'knowledge-files', label: 'Writing KNOWLEDGE.md and SCHEMA.md', done: false },
    { step: 'skills', label: 'Installing 19 built-in skills', done: false },
    { step: 'symlinks', label: 'Creating skill symlinks', done: false },
    { step: 'platform-config', label: 'Generating agent configuration', done: false },
    { step: 'lock-files', label: 'Writing configuration files', done: false },
  ];
}

export async function executeSetup(
  app: App,
  platform: Platform,
  kbName: string,
  onProgress: (step: SetupStep) => void,
): Promise<void> {
  onProgress('directories');
  for (const dir of KNOWLEDGE_DIRS) {
    const path = normalizePath(dir);
    if (!app.vault.getFolderByPath(path)) {
      await app.vault.createFolder(path);
    }
  }

  onProgress('knowledge-files');
  await writeFileIfNotExists(app, 'KNOWLEDGE.md', generateKnowledgeMd(kbName));
  await writeFileIfNotExists(app, 'SCHEMA.md', generateSchemaMd());

  onProgress('skills');
  await installAllBuiltinSkills(app);
  onProgress('symlinks');

  onProgress('platform-config');
  await generatePlatformConfig(app, platform, kbName);
  await installDefaultRules(app, platform);

  onProgress('lock-files');
  const lock = buildInitialSkillsLock();
  await saveSkillsLock(app, lock);
  await writeManifest(app, platform, kbName);
}

async function writeFileIfNotExists(app: App, path: string, content: string): Promise<void> {
  const normalized = normalizePath(path);
  const existing = app.vault.getFileByPath(normalized);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(normalized, content);
  }
}

async function writeManifest(app: App, platform: Platform, kbName: string): Promise<void> {
  const manifest: Manifest = {
    version: '0.1.0',
    platform,
    kbName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const dirPath = normalizePath('.byoao');
  if (!app.vault.getFolderByPath(dirPath)) {
    await app.vault.createFolder(dirPath);
  }

  const filePath = normalizePath('.byoao/manifest.json');
  const content = JSON.stringify(manifest, null, 2);
  const existing = app.vault.getFileByPath(filePath);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(filePath, content);
  }
}

export async function readManifest(app: App): Promise<Manifest | null> {
  const file = app.vault.getFileByPath(normalizePath('.byoao/manifest.json'));
  if (!file) return null;
  const content = await app.vault.cachedRead(file);
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function isVaultInitialized(app: App): boolean {
  return app.vault.getFileByPath(normalizePath('.byoao/manifest.json')) !== null;
}
