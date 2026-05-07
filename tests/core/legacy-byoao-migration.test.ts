import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import {
  buildByoaoMigrationPreview,
  buildSkillMergePlan,
  classifyByoaoLegacySignals,
  executeByoaoMigration,
  normalizeLegacySkillsLock,
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
