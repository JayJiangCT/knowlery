import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { generateClaudeMd } from '../../src/assets/templates';
import { generatePlatformConfig } from '../../src/core/platform-adapter';
import { deleteRule, installDefaultRules, writeRule } from '../../src/core/rule-manager';
import { syncClaudeRuleImports } from '../../src/core/rule-imports';

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
    },
    __files: files,
  } as unknown as App;
}

function getFiles(app: App): Map<string, string> {
  return (app as unknown as { __files: Map<string, string> }).__files;
}

describe('Claude rule imports', () => {
  it('renders explicit imports for every Claude rule file', () => {
    const claudeMd = generateClaudeMd([
      'activity-ledger.md',
      'frontend/testing.md',
    ]);

    expect(claudeMd).toContain('@rules/activity-ledger.md');
    expect(claudeMd).toContain('@rules/frontend/testing.md');
  });

  it('regenerates Claude config with installed rules and keeps OpenCode glob instructions', async () => {
    const app = createMockApp();
    await installDefaultRules(app, 'claude-code');
    await generatePlatformConfig(app, 'claude-code', 'My KB');

    const files = getFiles(app);
    expect(files.get('.claude/CLAUDE.md')).toContain('@rules/activity-ledger.md');
    expect(files.get('.claude/CLAUDE.md')).toContain('@rules/citation-required.md');

    await generatePlatformConfig(app, 'opencode', 'My KB');
    expect(files.get('opencode.json')).toContain('.agents/rules/*.md');
  });

  it('syncs Claude rule imports after custom rules are added and deleted', async () => {
    const app = createMockApp({
      '.claude/rules/activity-ledger.md': '# Activity Ledger',
      '.claude/CLAUDE.md': generateClaudeMd(['activity-ledger.md']),
    });

    await writeRule(app, 'claude-code', 'custom-review.md', '# Custom Review');
    expect(getFiles(app).get('.claude/CLAUDE.md')).toContain('@rules/custom-review.md');

    await deleteRule(app, 'claude-code', 'activity-ledger.md');
    const claudeMd = getFiles(app).get('.claude/CLAUDE.md');
    expect(claudeMd).not.toContain('@rules/activity-ledger.md');
    expect(claudeMd).toContain('@rules/custom-review.md');
  });

  it('upgrades an existing Claude config without requiring manual regeneration', async () => {
    const app = createMockApp({
      '.claude/rules/activity-ledger.md': '# Activity Ledger',
      '.claude/rules/custom-review.md': '# Custom Review',
      '.claude/CLAUDE.md': [
        '@../KNOWLEDGE.md',
        '@../SCHEMA.md',
        '@../INDEX.base',
        '',
      ].join('\n'),
    });

    await syncClaudeRuleImports(app);

    const claudeMd = getFiles(app).get('.claude/CLAUDE.md');
    expect(claudeMd).toContain('@../KNOWLEDGE.md');
    expect(claudeMd).toContain('@rules/activity-ledger.md');
    expect(claudeMd).toContain('@rules/custom-review.md');
  });
});
