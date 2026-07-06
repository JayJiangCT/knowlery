import matter from 'gray-matter';
import type { SkillInfo, SkillsLock, SkillLockEntry, SkillDetail, SkillKind } from '../types';
import type { VaultFs } from './vault-fs';
import { normalizeVaultPath } from './vault-fs';
import { BUNDLED_SKILLS } from '../assets/skills';

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

export async function installAllBuiltinSkills(fs: VaultFs): Promise<void> {
  await fs.mkdir(normalizeVaultPath(SKILLS_DIR));
  await fs.mkdir(normalizeVaultPath(CLAUDE_SKILLS_DIR));

  for (const skill of BUNDLED_SKILLS) {
    await writeSkillFile(fs, skill.name, skill.content);
    await copySkillToClaudeDir(fs, skill.name);
  }
}

/** Write-on-change: repeated syncs must not churn mtimes (spec 0.7 f2, §6.2). */
async function writeIfChanged(fs: VaultFs, path: string, content: string): Promise<void> {
  if ((await fs.exists(path)) && (await fs.read(path)) === content) return;
  await fs.write(path, content);
}

async function writeSkillFile(fs: VaultFs, name: string, content: string): Promise<void> {
  await fs.mkdir(`${SKILLS_DIR}/${name}`);
  await writeIfChanged(fs, `${SKILLS_DIR}/${name}/SKILL.md`, content);
}

export async function copySkillToClaudeDir(fs: VaultFs, name: string): Promise<void> {
  await fs.mkdir(`${CLAUDE_SKILLS_DIR}/${name}`);

  const sourcePath = normalizeVaultPath(`${SKILLS_DIR}/${name}/SKILL.md`);
  if (!(await fs.exists(sourcePath))) {
    return;
  }
  const content = await fs.read(sourcePath);

  await writeIfChanged(fs, `${CLAUDE_SKILLS_DIR}/${name}/SKILL.md`, content);
}

export async function loadSkillsLock(fs: VaultFs): Promise<SkillsLock> {
  if (!(await fs.exists(normalizeVaultPath(LOCK_FILE)))) {
    return { version: '1.0.0', skills: {} };
  }
  const content = await fs.read(normalizeVaultPath(LOCK_FILE));
  return JSON.parse(content) as SkillsLock;
}

export async function saveSkillsLock(fs: VaultFs, lock: SkillsLock): Promise<void> {
  await fs.write(LOCK_FILE, JSON.stringify(lock, null, 2));
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

export async function listSkills(fs: VaultFs): Promise<SkillInfo[]> {
  const lock = await loadSkillsLock(fs);
  const skills: SkillInfo[] = [];

  const dirPath = normalizeVaultPath(SKILLS_DIR);
  if (!(await fs.exists(dirPath))) return skills;

  const listing = await fs.list(dirPath);
  for (const folderPath of listing.folders) {
    const name = folderPath.split('/').pop()!;
    const skillPath = normalizeVaultPath(`${folderPath}/SKILL.md`);
    if (!(await fs.exists(skillPath))) continue;

    const content = await fs.read(skillPath);
    const lockEntry = lock.skills[name];
    const bundled = BUNDLED_SKILLS.find(s => s.name === name);

    let description = '';
    let emoji = '';
    let kind: SkillKind = 'tooling';
    try {
      const parsed = matter(content);
      description = typeof parsed.data.description === 'string' ? parsed.data.description : '';
      const rawKind: unknown = parsed.data.kind;
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
  fs: VaultFs,
  originalName: string,
  newName: string,
  newContent: string,
): Promise<void> {
  await writeSkillFile(fs, newName, newContent);
  await copySkillToClaudeDir(fs, newName);

  const lock = await loadSkillsLock(fs);
  lock.skills[newName] = {
    source: 'custom',
    version: '1.0.0',
    disabled: false,
    forkedFrom: originalName,
  };
  await saveSkillsLock(fs, lock);
}

export async function createSkill(
  fs: VaultFs,
  name: string,
  content: string,
): Promise<void> {
  await fs.mkdir(normalizeVaultPath(SKILLS_DIR));
  await fs.mkdir(normalizeVaultPath(CLAUDE_SKILLS_DIR));
  await fs.mkdir(`${SKILLS_DIR}/${name}`);
  await fs.write(`${SKILLS_DIR}/${name}/SKILL.md`, content);
  await copySkillToClaudeDir(fs, name);

  const lock = await loadSkillsLock(fs);
  lock.skills[name] = {
    source: 'custom',
    version: '1.0.0',
    disabled: false,
  };
  await saveSkillsLock(fs, lock);
}

export async function markSkillInstalledFromRegistry(
  fs: VaultFs,
  name: string,
  registryIdentifier: string,
): Promise<void> {
  const lock = await loadSkillsLock(fs);
  lock.skills[name] = {
    source: 'registry',
    version: lock.skills[name]?.version ?? '1.0.0',
    disabled: lock.skills[name]?.disabled ?? false,
    registryIdentifier,
  };
  await saveSkillsLock(fs, lock);
}

export async function disableSkill(fs: VaultFs, name: string): Promise<void> {
  const filePath = normalizeVaultPath(`${CLAUDE_SKILLS_DIR}/${name}/SKILL.md`);
  if (await fs.exists(filePath)) {
    await fs.remove(filePath);
  }
  const dirPath = normalizeVaultPath(`${CLAUDE_SKILLS_DIR}/${name}`);
  if (await fs.exists(dirPath)) {
    const listing = await fs.list(dirPath);
    if (listing.files.length === 0 && listing.folders.length === 0) {
      await fs.rmdir(dirPath, false);
    }
  }

  const lock = await loadSkillsLock(fs);
  if (lock.skills[name]) {
    lock.skills[name].disabled = true;
    await saveSkillsLock(fs, lock);
  }
}

export async function enableSkill(fs: VaultFs, name: string): Promise<void> {
  await copySkillToClaudeDir(fs, name);

  const lock = await loadSkillsLock(fs);
  if (lock.skills[name]) {
    lock.skills[name].disabled = false;
    await saveSkillsLock(fs, lock);
  }
}

export async function deleteSkill(fs: VaultFs, name: string): Promise<void> {
  const symlinkDir = normalizeVaultPath(`${CLAUDE_SKILLS_DIR}/${name}`);
  if (await fs.exists(symlinkDir)) {
    await fs.rmdir(symlinkDir, true);
  }

  const skillDir = normalizeVaultPath(`${SKILLS_DIR}/${name}`);
  if (await fs.exists(skillDir)) {
    await fs.rmdir(skillDir, true);
  }

  const lock = await loadSkillsLock(fs);
  delete lock.skills[name];
  await saveSkillsLock(fs, lock);
}

export async function updateSkillContent(
  fs: VaultFs,
  name: string,
  content: string,
): Promise<void> {
  skillDetailCache.delete(name);
  await writeSkillFile(fs, name, content);
  await copySkillToClaudeDir(fs, name);
}
