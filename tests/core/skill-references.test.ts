import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { copySkillToClaudeDir, installAllBuiltinSkills, enableSkill, disableSkill, createSkill, forkSkill, deleteSkill, updateSkillContent } from '../../src/core/skill-manager';
import { syncBuiltinSkills } from '../../src/core/migration';

function createMockApp(initialFiles: Record<string, string> = {}): App {
  const files = new Map(Object.entries(initialFiles));
  const dirs = new Set<string>();

  const addParentDirs = (path: string) => {
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  };

  for (const path of files.keys()) addParentDirs(path);

  const adapter = {
    exists: async (path: string) => files.has(path) || dirs.has(path),
    read: async (path: string) => files.get(path) ?? '',
    write: async (path: string, content: string) => {
      addParentDirs(path);
      files.set(path, content);
    },
    mkdir: async (path: string) => {
      dirs.add(path);
    },
    remove: async (path: string) => {
      files.delete(path);
    },
    rmdir: async (path: string, recursive: boolean) => {
      if (recursive) {
        const prefix = `${path}/`;
        for (const key of [...files.keys()]) {
          if (key === path || key.startsWith(prefix)) files.delete(key);
        }
        for (const dir of [...dirs]) {
          if (dir === path || dir.startsWith(prefix)) dirs.delete(dir);
        }
      } else {
        dirs.delete(path);
      }
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
      createFolder: async (path: string) => {
        dirs.add(path);
      },
      getFolderByPath: (path: string) => dirs.has(path) ? ({ path } as never) : null,
      getFileByPath: (path: string) => files.has(path) ? ({ path } as never) : null,
      create: async (path: string, content: string) => {
        addParentDirs(path);
        files.set(path, content);
      },
      modify: async (file: { path: string }, content: string) => {
        files.set(file.path, content);
      },
      cachedRead: async (file: { path: string }) => {
        return files.get(file.path) ?? '';
      },
      read: async (file: { path: string }) => {
        return files.get(file.path) ?? '';
      },
    },
    __files: files,
  } as unknown as App;
}

function getFiles(app: App): Map<string, string> {
  return (app as unknown as { __files: Map<string, string> }).__files;
}

describe('Skill references (L1-L3)', () => {
  it('installs reference files alongside SKILL.md for skills with references', async () => {
    const app = createMockApp();
    await installAllBuiltinSkills(app);
    const files = getFiles(app);

    expect(files.has('.agents/skills/ask/SKILL.md')).toBe(true);
    expect(files.has('.agents/skills/ask/references/gap-resolution.md')).toBe(true);
    expect(files.get('.agents/skills/ask/references/gap-resolution.md')).toContain('Knowledge Gap Resolution Protocol');
  });

  it('copies reference files to .claude/skills/ when skill is enabled', async () => {
    const app = createMockApp();
    await installAllBuiltinSkills(app);
    const files = getFiles(app);

    expect(files.has('.claude/skills/ask/SKILL.md')).toBe(true);
    expect(files.has('.claude/skills/ask/references/gap-resolution.md')).toBe(true);
  });

  it('removes reference files when skill is disabled', async () => {
    const app = createMockApp();
    await installAllBuiltinSkills(app);

    await disableSkill(app, 'ask');
    const files = getFiles(app);

    expect(files.has('.claude/skills/ask/SKILL.md')).toBe(false);
    expect(files.has('.claude/skills/ask/references/gap-resolution.md')).toBe(false);
  });

  it('restores reference files when skill is re-enabled', async () => {
    const app = createMockApp();
    await installAllBuiltinSkills(app);

    await disableSkill(app, 'ask');
    await enableSkill(app, 'ask');
    const files = getFiles(app);

    expect(files.has('.claude/skills/ask/SKILL.md')).toBe(true);
    expect(files.has('.claude/skills/ask/references/gap-resolution.md')).toBe(true);
  });

  it('does not create references directory for skills without references', async () => {
    const app = createMockApp();
    await installAllBuiltinSkills(app);
    const files = getFiles(app);

    expect(files.has('.agents/skills/cook/SKILL.md')).toBe(true);
    const cookRefFile = [...files.keys()].find(
      (k) => k.startsWith('.agents/skills/cook/') && k !== '.agents/skills/cook/SKILL.md'
    );
    expect(cookRefFile).toBeUndefined();
  });
});

describe('Skill reference migration', () => {
  it('syncs reference files for existing vaults via migration', async () => {
    const app = createMockApp({
      'skills-lock.json': JSON.stringify({
        version: '1.0.0',
        skills: {
          ask: { source: 'builtin', version: '1.0.0', disabled: false },
          cook: { source: 'builtin', version: '1.0.0', disabled: false },
        },
      }),
      '.agents/skills/ask/SKILL.md': '# old ask content',
      '.agents/skills/cook/SKILL.md': '# old cook content',
    });

    await syncBuiltinSkills(app);
    const files = getFiles(app);

    expect(files.has('.agents/skills/ask/SKILL.md')).toBe(true);
    expect(files.has('.agents/skills/ask/references/gap-resolution.md')).toBe(true);
  });

  it('does not overwrite custom or forked skills', async () => {
    const customContent = '# my custom ask skill';
    const app = createMockApp({
      'skills-lock.json': JSON.stringify({
        version: '1.0.0',
        skills: {
          ask: { source: 'custom', version: '1.0.0', disabled: false },
        },
      }),
      '.agents/skills/ask/SKILL.md': customContent,
    });

    await syncBuiltinSkills(app);
    const files = getFiles(app);

    expect(files.get('.agents/skills/ask/SKILL.md')).toBe(customContent);
    expect(files.has('.agents/skills/ask/references/gap-resolution.md')).toBe(false);
  });
});

describe('Skill lifecycle with references', () => {
  it('creates a custom skill without references and copies to .claude/skills/', async () => {
    const app = createMockApp({
      'skills-lock.json': JSON.stringify({ version: '1.0.0', skills: {} }),
    });

    await createSkill(app, 'my-skill', '# My Custom Skill');
    const files = getFiles(app);

    expect(files.has('.agents/skills/my-skill/SKILL.md')).toBe(true);
    expect(files.has('.claude/skills/my-skill/SKILL.md')).toBe(true);
    // No reference files
    const mySkillFiles = [...files.keys()].filter(k => k.startsWith('.agents/skills/my-skill/') && k !== '.agents/skills/my-skill/SKILL.md');
    expect(mySkillFiles).toHaveLength(0);
  });

  it('deletes a skill with references and removes all files', async () => {
    const app = createMockApp();
    await installAllBuiltinSkills(app);

    await deleteSkill(app, 'ask');
    const files = getFiles(app);

    expect(files.has('.agents/skills/ask/SKILL.md')).toBe(false);
    expect(files.has('.agents/skills/ask/references/gap-resolution.md')).toBe(false);
    expect(files.has('.claude/skills/ask/SKILL.md')).toBe(false);
  });

  it('forks a skill without carrying references', async () => {
    const app = createMockApp();
    await installAllBuiltinSkills(app);

    await forkSkill(app, 'ask', 'my-ask', '# My Forked Ask');
    const files = getFiles(app);

    expect(files.has('.agents/skills/my-ask/SKILL.md')).toBe(true);
    // Forked skill gets the forked content, not the original references
    const myAskRefFiles = [...files.keys()].filter(k => k.startsWith('.agents/skills/my-ask/references/'));
    expect(myAskRefFiles).toHaveLength(0);
  });
});

describe('updateSkillContent preserves references', () => {
  it('updates SKILL.md without removing reference files', async () => {
    const app = createMockApp();
    await installAllBuiltinSkills(app);

    await updateSkillContent(app, 'ask', '# Updated ask content');
    const files = getFiles(app);

    // SKILL.md updated
    expect(files.get('.agents/skills/ask/SKILL.md')).toBe('# Updated ask content');
    // Reference file preserved
    expect(files.has('.agents/skills/ask/references/gap-resolution.md')).toBe(true);
  });
});
