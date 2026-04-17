import { App, normalizePath, TFile, TFolder } from 'obsidian';
import type { SkillInfo, SkillsLock, SkillLockEntry } from '../types';
import { BUNDLED_SKILLS, type BundledSkill } from '../assets/skills';
import matter from 'gray-matter';

const SKILLS_DIR = '.agents/skills';
const CLAUDE_SKILLS_DIR = '.claude/skills';
const LOCK_FILE = 'skills-lock.json';

export async function installAllBuiltinSkills(app: App): Promise<void> {
  await ensureDir(app, normalizePath(SKILLS_DIR));
  await ensureDir(app, normalizePath(CLAUDE_SKILLS_DIR));

  for (const skill of BUNDLED_SKILLS) {
    await writeSkillFile(app, skill.name, skill.content);
    await createSkillSymlink(app, skill.name);
  }
}

async function writeSkillFile(app: App, name: string, content: string): Promise<void> {
  const dirPath = normalizePath(`${SKILLS_DIR}/${name}`);
  await ensureDir(app, dirPath);

  const filePath = normalizePath(`${SKILLS_DIR}/${name}/SKILL.md`);
  const existing = app.vault.getFileByPath(filePath);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(filePath, content);
  }
}

export async function createSkillSymlink(app: App, name: string): Promise<void> {
  const symlinkDir = normalizePath(`${CLAUDE_SKILLS_DIR}/${name}`);
  await ensureDir(app, symlinkDir);

  const symlinkPath = normalizePath(`${CLAUDE_SKILLS_DIR}/${name}/SKILL.md`);
  const sourcePath = normalizePath(`${SKILLS_DIR}/${name}/SKILL.md`);

  const sourceFile = app.vault.getFileByPath(sourcePath);
  if (!sourceFile) return;

  const content = await app.vault.cachedRead(sourceFile);
  const existing = app.vault.getFileByPath(symlinkPath);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(symlinkPath, content);
  }
}

export async function loadSkillsLock(app: App): Promise<SkillsLock> {
  const file = app.vault.getFileByPath(normalizePath(LOCK_FILE));
  if (!file) {
    return { version: '1.0.0', skills: {} };
  }
  const content = await app.vault.cachedRead(file);
  return JSON.parse(content);
}

export async function saveSkillsLock(app: App, lock: SkillsLock): Promise<void> {
  const filePath = normalizePath(LOCK_FILE);
  const content = JSON.stringify(lock, null, 2);
  const existing = app.vault.getFileByPath(filePath);
  if (existing) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(filePath, content);
  }
}

export function buildInitialSkillsLock(): SkillsLock {
  const skills: Record<string, SkillLockEntry> = {};
  for (const skill of BUNDLED_SKILLS) {
    skills[skill.name] = {
      source: 'builtin',
      version: '1.0.0',
      disabled: false,
    };
  }
  return { version: '1.0.0', skills };
}

export async function listSkills(app: App): Promise<SkillInfo[]> {
  const lock = await loadSkillsLock(app);
  const skills: SkillInfo[] = [];

  const skillsFolder = app.vault.getFolderByPath(normalizePath(SKILLS_DIR));
  if (!skillsFolder) return skills;

  for (const child of skillsFolder.children) {
    if (!(child instanceof TFolder)) continue;

    const skillFile = app.vault.getFileByPath(
      normalizePath(`${SKILLS_DIR}/${child.name}/SKILL.md`)
    );
    if (!skillFile) continue;

    const content = await app.vault.cachedRead(skillFile);
    const lockEntry = lock.skills[child.name];
    const bundled = BUNDLED_SKILLS.find(s => s.name === child.name);

    let description = '';
    let emoji = '';
    try {
      const parsed = matter(content);
      description = parsed.data.description || '';
    } catch {
      // skip parse errors
    }

    if (bundled) {
      emoji = bundled.emoji;
      if (!description) description = bundled.description;
    }

    skills.push({
      name: child.name,
      source: lockEntry?.source || (bundled ? 'builtin' : 'custom'),
      disabled: lockEntry?.disabled || false,
      forkedFrom: lockEntry?.forkedFrom,
      description,
      emoji,
      content,
    });
  }

  return skills;
}

export async function forkSkill(
  app: App,
  originalName: string,
  newName: string,
  newContent: string,
): Promise<void> {
  await writeSkillFile(app, newName, newContent);
  await createSkillSymlink(app, newName);

  const lock = await loadSkillsLock(app);
  lock.skills[newName] = {
    source: 'custom',
    version: '1.0.0',
    disabled: false,
    forkedFrom: originalName,
  };
  await saveSkillsLock(app, lock);
}

export async function disableSkill(app: App, name: string): Promise<void> {
  const symlinkPath = normalizePath(`${CLAUDE_SKILLS_DIR}/${name}/SKILL.md`);
  const symlinkFile = app.vault.getFileByPath(symlinkPath);
  if (symlinkFile) {
    await app.vault.trash(symlinkFile, true);
  }

  const symlinkDir = app.vault.getFolderByPath(
    normalizePath(`${CLAUDE_SKILLS_DIR}/${name}`)
  );
  if (symlinkDir && symlinkDir.children.length === 0) {
    await app.vault.trash(symlinkDir as any, true);
  }

  const lock = await loadSkillsLock(app);
  if (lock.skills[name]) {
    lock.skills[name].disabled = true;
    await saveSkillsLock(app, lock);
  }
}

export async function enableSkill(app: App, name: string): Promise<void> {
  await createSkillSymlink(app, name);

  const lock = await loadSkillsLock(app);
  if (lock.skills[name]) {
    lock.skills[name].disabled = false;
    await saveSkillsLock(app, lock);
  }
}

export async function deleteSkill(app: App, name: string): Promise<void> {
  const symlinkPath = normalizePath(`${CLAUDE_SKILLS_DIR}/${name}`);
  const symlinkFolder = app.vault.getFolderByPath(symlinkPath);
  if (symlinkFolder) await app.vault.trash(symlinkFolder as any, true);

  const skillPath = normalizePath(`${SKILLS_DIR}/${name}`);
  const skillFolder = app.vault.getFolderByPath(skillPath);
  if (skillFolder) await app.vault.trash(skillFolder as any, true);

  const lock = await loadSkillsLock(app);
  delete lock.skills[name];
  await saveSkillsLock(app, lock);
}

export async function updateSkillContent(
  app: App,
  name: string,
  content: string,
): Promise<void> {
  await writeSkillFile(app, name, content);
  await createSkillSymlink(app, name);
}

async function ensureDir(app: App, path: string): Promise<void> {
  const normalized = normalizePath(path);
  if (!app.vault.getFolderByPath(normalized)) {
    await app.vault.createFolder(normalized);
  }
}
