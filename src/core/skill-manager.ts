import { App, normalizePath } from 'obsidian';
import type { SkillInfo, SkillsLock, SkillLockEntry, SkillDetail, SkillKind } from '../types';
import { BUNDLED_SKILLS } from '../assets/skills';
import matter from 'gray-matter';
import { ensureDir, writeFile, copyDirectory } from './vault-io';

const SKILLS_DIR = '.agents/skills';
const CLAUDE_SKILLS_DIR = '.claude/skills';
const LOCK_FILE = 'skills-lock.json';

const skillDetailCache = new Map<string, SkillDetail>();

function parseSkillBody(content: string): SkillDetail {
  const parsed = matter(content);
  const body = parsed.content;
  const detail: SkillDetail = {};

  // Split body into sections by ## headings
  const parts = body.split(/^## .+$/m);
  const intro = parts[0]?.trim();
  const headings: string[] = [];
  let match: RegExpExecArray | null;
  const headingRe = /^## (.+)$/gm;
  while ((match = headingRe.exec(body)) !== null) {
    headings.push(match[1].trim());
  }

  // parts[0] is content before first heading; parts[1..] correspond to headings[0..]
  headings.forEach((heading, i) => {
    const sectionText = (parts[i + 1] ?? '').trim();
    switch (heading) {
      case 'What it does':
      case 'Introduction':
      case 'Overview':
      case 'Description':
        detail.whatItDoes = sectionText;
        break;
      case 'Best For': {
        detail.bestFor = sectionText
          .split('\n')
          .filter(line => line.startsWith('- '))
          .map(line => line.slice(2).trim());
        break;
      }
      case 'Pro Tip':
        detail.proTip = sectionText;
        break;
      case 'Example': {
        // Extract first fenced code block content
        const fenceMatch = /```[^\n]*\n([\s\S]*?)```/.exec(sectionText);
        if (fenceMatch) {
          detail.example = fenceMatch[1].trimEnd();
        }
        break;
      }
      case 'Parameters': {
        // Parse markdown table rows: | flag | type | description |
        const rows = sectionText
          .split('\n')
          .filter(line => line.startsWith('|') && !line.match(/^\|[-\s|]+\|$/));
        // Skip header row (first row)
        const dataRows = rows.slice(1);
        detail.parameters = dataRows.map(row => {
          const cells = row.split('|').map(c => c.trim()).filter(c => c !== '');
          return {
            flag: cells[0] ?? '',
            type: cells[1] ?? '',
            description: cells[2] ?? '',
          };
        });
        break;
      }
    }
  });

  if (!detail.whatItDoes && intro) {
    detail.whatItDoes = intro;
  }

  return detail;
}

export async function installAllBuiltinSkills(app: App): Promise<void> {
  await ensureDir(app, normalizePath(SKILLS_DIR));
  await ensureDir(app, normalizePath(CLAUDE_SKILLS_DIR));

  for (const skill of BUNDLED_SKILLS) {
    await writeSkillFile(app, skill.name, skill.content, skill.references);
    await copySkillToClaudeDir(app, skill.name);
  }
}

async function writeSkillFile(app: App, name: string, content: string, references?: Record<string, string>): Promise<void> {
  await ensureDir(app, `${SKILLS_DIR}/${name}`);
  await writeFile(app, `${SKILLS_DIR}/${name}/SKILL.md`, content);

  if (references) {
    for (const [relPath, refContent] of Object.entries(references)) {
      const fullPath = `${SKILLS_DIR}/${name}/${relPath}`;
      const parentDir = fullPath.split('/').slice(0, -1).join('/');
      await ensureDir(app, parentDir);
      await writeFile(app, fullPath, refContent);
    }
  }
}

export async function copySkillToClaudeDir(app: App, name: string): Promise<void> {
  const srcDir = normalizePath(`${SKILLS_DIR}/${name}`);
  const destDir = normalizePath(`${CLAUDE_SKILLS_DIR}/${name}`);

  if (!(await app.vault.adapter.exists(srcDir))) return;

  await ensureDir(app, destDir);
  const skillMdPath = `${srcDir}/SKILL.md`;
  const sourceFile = app.vault.getFileByPath(skillMdPath);
  let content: string;
  if (sourceFile) {
    content = await app.vault.cachedRead(sourceFile);
  } else if (await app.vault.adapter.exists(skillMdPath)) {
    content = await app.vault.adapter.read(skillMdPath);
  } else {
    return;
  }
  await writeFile(app, `${destDir}/SKILL.md`, content);

  // Copy any subdirectories (references/, etc.) recursively
  const listing = await app.vault.adapter.list(srcDir);
  for (const folderPath of listing.folders) {
    const relativePath = folderPath.slice(srcDir.length + 1);
    await copyDirectory(app, folderPath, `${destDir}/${relativePath}`);
  }
}

export async function loadSkillsLock(app: App): Promise<SkillsLock> {
  const file = app.vault.getFileByPath(normalizePath(LOCK_FILE));
  if (!file) {
    return { version: '1.0.0', skills: {} };
  }
  const content = await app.vault.read(file);
  return JSON.parse(content);
}

export async function saveSkillsLock(app: App, lock: SkillsLock): Promise<void> {
  await writeFile(app, LOCK_FILE, JSON.stringify(lock, null, 2));
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
  const adapter = app.vault.adapter;

  const dirPath = normalizePath(SKILLS_DIR);
  if (!(await adapter.exists(dirPath))) return skills;

  const listing = await adapter.list(dirPath);
  for (const folderPath of listing.folders) {
    const name = folderPath.split('/').pop()!;
    const skillPath = normalizePath(`${folderPath}/SKILL.md`);
    if (!(await adapter.exists(skillPath))) continue;

    const content = await adapter.read(skillPath);
    const lockEntry = lock.skills[name];
    const bundled = BUNDLED_SKILLS.find(s => s.name === name);

    let description = '';
    let emoji = '';
    let kind: SkillKind = 'tooling';
    try {
      const parsed = matter(content);
      description = parsed.data.description || '';
      const rawKind = parsed.data.kind;
      if (rawKind === 'knowledge' || rawKind === 'tooling') {
        kind = rawKind;
      }
    } catch {
      // skip parse errors
    }

    if (bundled) {
      emoji = bundled.emoji;
      if (!description) description = bundled.description;
    }

    let detail: SkillDetail | undefined;
    const cacheKey = `${name}:${content}`;
    if (skillDetailCache.has(cacheKey)) {
      detail = skillDetailCache.get(cacheKey);
    } else {
      detail = parseSkillBody(content);
      skillDetailCache.set(cacheKey, detail);
    }

    skills.push({
      name,
      source: lockEntry?.source || (bundled ? 'builtin' : 'registry'),
      disabled: lockEntry?.disabled || false,
      forkedFrom: lockEntry?.forkedFrom,
      registryIdentifier: lockEntry?.registryIdentifier,
      description,
      emoji,
      content,
      kind,
      ...(detail !== undefined ? { detail } : {}),
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
  await copySkillToClaudeDir(app, newName);

  const lock = await loadSkillsLock(app);
  lock.skills[newName] = {
    source: 'custom',
    version: '1.0.0',
    disabled: false,
    forkedFrom: originalName,
  };
  await saveSkillsLock(app, lock);
}

export async function createSkill(
  app: App,
  name: string,
  content: string,
): Promise<void> {
  await ensureDir(app, normalizePath(SKILLS_DIR));
  await ensureDir(app, normalizePath(CLAUDE_SKILLS_DIR));
  await ensureDir(app, `${SKILLS_DIR}/${name}`);
  await writeFile(app, `${SKILLS_DIR}/${name}/SKILL.md`, content);
  await copySkillToClaudeDir(app, name);

  const lock = await loadSkillsLock(app);
  lock.skills[name] = {
    source: 'custom',
    version: '1.0.0',
    disabled: false,
  };
  await saveSkillsLock(app, lock);
}

export async function markSkillInstalledFromRegistry(
  app: App,
  name: string,
  registryIdentifier: string,
): Promise<void> {
  const lock = await loadSkillsLock(app);
  lock.skills[name] = {
    source: 'registry',
    version: lock.skills[name]?.version ?? '1.0.0',
    disabled: lock.skills[name]?.disabled ?? false,
    registryIdentifier,
  };
  await saveSkillsLock(app, lock);
}

export async function disableSkill(app: App, name: string): Promise<void> {
  const adapter = app.vault.adapter;
  const dirPath = normalizePath(`${CLAUDE_SKILLS_DIR}/${name}`);
  if (await adapter.exists(dirPath)) {
    await adapter.rmdir(dirPath, true);
  }

  const lock = await loadSkillsLock(app);
  if (lock.skills[name]) {
    lock.skills[name].disabled = true;
    await saveSkillsLock(app, lock);
  }
}

export async function enableSkill(app: App, name: string): Promise<void> {
  await copySkillToClaudeDir(app, name);

  const lock = await loadSkillsLock(app);
  if (lock.skills[name]) {
    lock.skills[name].disabled = false;
    await saveSkillsLock(app, lock);
  }
}

export async function deleteSkill(app: App, name: string): Promise<void> {
  const adapter = app.vault.adapter;
  const symlinkDir = normalizePath(`${CLAUDE_SKILLS_DIR}/${name}`);
  if (await adapter.exists(symlinkDir)) {
    await adapter.rmdir(symlinkDir, true);
  }

  const skillDir = normalizePath(`${SKILLS_DIR}/${name}`);
  if (await adapter.exists(skillDir)) {
    await adapter.rmdir(skillDir, true);
  }

  const lock = await loadSkillsLock(app);
  delete lock.skills[name];
  await saveSkillsLock(app, lock);
}

export async function updateSkillContent(
  app: App,
  name: string,
  content: string,
): Promise<void> {
  skillDetailCache.delete(name);
  await writeSkillFile(app, name, content);
  await copySkillToClaudeDir(app, name);
}
